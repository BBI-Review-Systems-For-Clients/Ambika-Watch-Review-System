import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {buildReviewContexts,validateGeminiDrafts} from '../business-profile.js';
import {GeminiRequestError} from '../gemini-client.js';
import {generateGeminiManifest,refreshGeminiFile} from '../scripts/refresh-gemini-drafts.mjs';

const contexts=buildReviewContexts().filter(x=>x.language==='en'&&x.category==='women').slice(0,3);
const model='gemini-2.5-flash';
const key='test-private-credential';
const row=context=>({contextId:context.contextId,text:`I came from [area: ${context.area}] to Ambika Watch & Gift, Surat to buy ${/s$/.test(context.categoryPhrase)?'':'a '}[category: ${context.categoryPhrase}] for [recipient], and [experience].`,categoryPhrase:context.categoryPhrase});
const response=input=>({entries:input.map(row),usage:{inputTokens:100,outputTokens:50}});

async function temporaryFile(t){
 const parent=fileURLToPath(new URL('../work/',import.meta.url));
 await mkdir(parent,{recursive:true});
 const dir=await mkdtemp(join(parent,'gemini-refresh-test-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 return join(dir,'gemini-drafts.json');
}

test('validated Gemini refresh stages complete context-ordered sentences and nonsecret provenance',async()=>{
 const result=await generateGeminiManifest({contexts,apiKey:key,model,batchSize:2,request:async({contexts:input})=>response(input)});
 assert.equal(result.entries.length,3);
 assert.equal(result.kind,'customer-pov-template');
 assert.equal(result.schemaVersion,2);
 assert.deepEqual(result.entries.map(x=>x.contextId),contexts.map(x=>x.contextId));
 assert.equal(result.usage.requests,2);
 assert.equal(result.usage.inputTokens,200);
 assert.ok(!JSON.stringify(result).includes(key));
 assert.deepEqual(validateGeminiDrafts(contexts,result),result.entries);
});

test('repair regenerates only rejected sentences while retaining accepted model output',async()=>{
 const batches=[];
 const checkpoints=[];
 const result=await generateGeminiManifest({contexts,apiKey:key,model,onCheckpoint:async value=>checkpoints.push(value),request:async({contexts:input,revisionGuidance})=>{
  batches.push(input.map(x=>x.contextId));
  const result=response(input);
  if(batches.length===1) result.entries[0]={...result.entries[0],text:'I bought the watch.'};
  else assert.match(revisionGuidance,/Repair/);
  return result;
 }});
 assert.equal(batches.length,2);
 assert.deepEqual(batches[1],[contexts[0].contextId]);
 assert.equal(checkpoints[0].entries.length,2);
 assert.equal(result.entries.length,3);
});

test('failed API or validation preserves the previously published manifest byte for byte',async t=>{
 const target=await temporaryFile(t);
 const original='previous verified content\n';
 await writeFile(target,original);
 for(const request of [async()=>{throw new Error('Provider unavailable');},async({contexts:input})=>({entries:input.map(context=>({...row(context),text:'I bought this watch.'})),usage:{}})]){
  await assert.rejects(refreshGeminiFile({outputPath:target,contexts,apiKey:key,model,request,maxAttempts:1}));
  assert.equal(await readFile(target,'utf8'),original);
 }
});

test('successful refresh replaces the staged file only after all contexts pass',async t=>{
 const target=await temporaryFile(t);
 await writeFile(target,'old');
 const manifest=await refreshGeminiFile({outputPath:target,contexts,apiKey:key,model,request:async({contexts:input})=>response(input)});
 assert.deepEqual(JSON.parse(await readFile(target,'utf8')),manifest);
 await assert.rejects(readFile(target+'.pending'),{code:'ENOENT'});
});

test('a rejected early batch does not discard valid later batches or replace published content',async t=>{
 const target=await temporaryFile(t);const original='previous published content\n';await writeFile(target,original);
 const checkpoints=[];let calls=0;
 await assert.rejects(refreshGeminiFile({outputPath:target,contexts:contexts.slice(0,2),apiKey:key,model,batchSize:1,maxAttempts:1,
  onCheckpoint:async value=>checkpoints.push(value),request:async({contexts:input})=>{
   calls++;const result=response(input);if(input[0].contextId===contexts[0].contextId)result.entries[0].text='Invalid draft.';return result;
  }}),/invalid sentences across/);
 assert.equal(calls,2);
 assert.deepEqual(checkpoints.at(-1).entries.map(x=>x.contextId),[contexts[1].contextId]);
 assert.equal(await readFile(target,'utf8'),original);
});

test('valid private checkpoints resume without calling Gemini again for accepted contexts',async()=>{
 const checkpoint={schemaVersion:2,kind:'customer-pov-template',contextHash:createHash('sha256').update(JSON.stringify(contexts)).digest('hex'),model,entries:[row(contexts[0])]};
 let requested;
 const result=await generateGeminiManifest({contexts,apiKey:key,model,checkpoint,request:async({contexts:input})=>{requested=input;return response(input);}});
 assert.deepEqual(requested.map(x=>x.contextId),contexts.slice(1).map(x=>x.contextId));
 assert.equal(result.entries.length,3);
});

test('old five-field checkpoints cannot resume into the four-field catalog',async()=>{
 const checkpoint={schemaVersion:1,kind:'customer-pov-template',contextHash:createHash('sha256').update(JSON.stringify(contexts)).digest('hex'),model,entries:[row(contexts[0])],activeModel:'gemini-3.1-flash-lite'};
 let requested;
 const result=await generateGeminiManifest({contexts,apiKey:key,model,checkpoint,request:async({contexts:input,model:requestedModel})=>{
  requested=input;assert.equal(requestedModel,model);return response(input);
 }});
 assert.equal(requested.length,contexts.length);
 assert.equal(result.usage.resumedEntries,0);
});

test('a malformed transport response gets a bounded retry without losing valid staging',async()=>{
 let attempts=0;
 const manifest=await generateGeminiManifest({contexts,apiKey:key,model,maxAttempts:2,request:async({contexts:input})=>{
  attempts++;
  if(attempts===1) throw new GeminiRequestError('INVALID_RESPONSE','Malformed provider response');
  return response(input);
 }});
 assert.equal(attempts,2);
 assert.equal(manifest.entries.length,3);
 assert.equal(manifest.usage.requests,2);
});

test('model quota fallback preserves actual per-sentence Gemini model provenance',async()=>{
 let attempts=0;
 const manifest=await generateGeminiManifest({contexts,apiKey:key,model,maxAttempts:3,request:async({contexts:input,model:requestedModel})=>{
  attempts++;
  if(attempts===1){assert.equal(requestedModel,model);throw new GeminiRequestError('HTTP','Quota reached',429);}
  assert.equal(requestedModel,'gemini-3.1-flash-lite');
  return response(input);
 }});
 assert.equal(attempts,2);
 assert.deepEqual(manifest.modelsUsed,['gemini-3.1-flash-lite']);
 assert.ok(manifest.entries.every(entry=>entry.model==='gemini-3.1-flash-lite'));
});

test('a primary quota rejection permits one bounded model switch on the final content attempt',async()=>{
 let attempts=0;
 const manifest=await generateGeminiManifest({contexts,apiKey:key,model,maxAttempts:1,request:async({contexts:input,model:requestedModel})=>{
  attempts++;
  if(requestedModel===model) throw new GeminiRequestError('HTTP','Quota reached',429);
  assert.equal(requestedModel,'gemini-3.1-flash-lite');
  return response(input);
 }});
 assert.equal(attempts,2);
 assert.equal(manifest.usage.requests,2);
 assert.deepEqual(manifest.modelsUsed,['gemini-3.1-flash-lite']);
});

test('quota failure in both models stops without a model-switch loop',async()=>{
 let attempts=0;
 await assert.rejects(generateGeminiManifest({contexts,apiKey:key,model,maxAttempts:1,request:async()=>{
  attempts++;
  throw new GeminiRequestError('HTTP','Quota reached',429);
 }}),error=>error.status===429);
 assert.equal(attempts,2);
});
