import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { buildReviewContexts, validateGeminiDrafts, CUSTOMER_POV_SCAFFOLD_WORDS } from '../business-profile.js';
import { requestGeminiDrafts, GeminiRequestError } from '../gemini-client.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DRAFT_KIND = 'customer-pov-template';
const MANIFEST_SCHEMA = 2;
const hashContexts = contexts => createHash('sha256').update(JSON.stringify(contexts)).digest('hex');
const manifestFor = (contexts, entries, model) => ({
  schemaVersion: MANIFEST_SCHEMA, kind: DRAFT_KIND, provider: 'google-gemini', model,
  generatedAt: new Date().toISOString(), contextHash: hashContexts(contexts), entries,
});

/** Full model output is staged privately; failed batches never replace the catalog. */
export async function generateGeminiManifest({
  contexts = buildReviewContexts(), apiKey, model = 'gemini-2.5-flash',
  request = requestGeminiDrafts, batchSize = 40, maxAttempts = 3,
  checkpoint, onCheckpoint = async () => {}, onProgress = () => {},
} = {}) {
  if (!apiKey || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100
    || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error('Configure the private Gemini key and valid bounded generation settings.');
  }
  const contextHash = hashContexts(contexts);
  const byId = new Map(contexts.map(context => [context.contextId, context]));
  const accepted = new Map();
  const compatibleCheckpoint = checkpoint?.schemaVersion === MANIFEST_SCHEMA && checkpoint.kind === DRAFT_KIND && checkpoint.contextHash === contextHash && checkpoint.model === model;
  let activeModel = compatibleCheckpoint && typeof checkpoint.activeModel === 'string' && /^gemini-[a-z0-9.-]+$/.test(checkpoint.activeModel) ? checkpoint.activeModel : model;
  const usedText = new Set();
  const usage = { requests: 0, inputTokens: 0, outputTokens: 0, resumedEntries: 0, modelsAttempted: [], scope: 'Requests attempted in this API run; token counts cover parsed successful responses only. Compatible accepted sentences may be resumed.' };
  const accept = (entry, generatedBy = model) => {
    const context = byId.get(entry.contextId);
    if (!context || accepted.has(entry.contextId)) return false;
    const [validated] = validateGeminiDrafts([context], manifestFor([context], [{ ...entry, model: entry.model || generatedBy }], model));
    const normalized = validated.text.toLowerCase();
    if (usedText.has(normalized)) throw new Error('Duplicate generated sentence');
    accepted.set(entry.contextId, validated);
    usedText.add(normalized);
    return true;
  };
  if (compatibleCheckpoint && Array.isArray(checkpoint.entries)) {
    for (const entry of checkpoint.entries) { try { accept(entry); } catch { /* Invalid checkpoint rows are regenerated. */ } }
  }
  usage.resumedEntries = accepted.size;
  const acceptedWordings = pending => [...new Set([...accepted.values()].filter(entry => {
    const existing = byId.get(entry.contextId);
    return pending.some(context => context.language === existing.language && context.area === existing.area && context.category === existing.category && context.categoryPhrase === existing.categoryPhrase);
  }).map(entry => entry.text.replace(/\[area: [^\]]+\]/g, '[area: AREA]').replace(/\[category: [^\]]+\]/g, '[category: PHRASE]')))].slice(-10);
  const neutralVocabulary = pending => ` Outside the slots and exact business/city names, use ONLY these neutral ${pending[0].language} grammar words (case-insensitive): ${CUSTOMER_POV_SCAFFOLD_WORDS[pending[0].language].join(' ')}.`;
  const batches = [];
  const unfinished = [];
  for (const language of ['en', 'hi', 'gu']) {
    const pending = contexts.filter(context => context.language === language && !accepted.has(context.contextId));
    for (let offset = 0; offset < pending.length; offset += batchSize) batches.push(pending.slice(offset, offset + batchSize));
  }
  for (let index = 0; index < batches.length; index++) {
    let pending = batches[index];
    let revisionGuidance = 'Write fresh first-person customer-POV fill-in templates with exactly four slots: [area: supplied area], [category: assigned categoryPhrase], [recipient], [experience]. No product-brand name, field or placeholder is permitted. Follow the supplied styleIndex to vary full sentence grammar; use the assigned generic categoryPhrase exactly. Keep recipient and experience unresolved, with no relatives, praise, price feedback or purchase details added as facts. Existing sentence shapes use AREA/PHRASE as abstract markers: restore each context\'s exact area/categoryPhrase while writing different surrounding grammar.';
    revisionGuidance += neutralVocabulary(pending);
    const priorWordings = acceptedWordings(pending);
    if (priorWordings.length) revisionGuidance += ` Write different surrounding grammar from these already accepted templates: ${JSON.stringify(priorWordings)}.`;
    revisionGuidance = revisionGuidance.slice(0, 3900);
    for (let attempt = 1; attempt <= maxAttempts && pending.length; attempt++) {
      let result;
      usage.requests++;
      const requestModel = activeModel;
      if (!usage.modelsAttempted.includes(requestModel)) usage.modelsAttempted.push(requestModel);
      try { result = await request({ contexts: pending, apiKey, model: requestModel, timeoutMs: 55000, revisionGuidance }); }
      catch (error) {
        if (error instanceof GeminiRequestError && error.code === 'HTTP'
          && (error.status === 429 || (error.status === 503 && attempt === maxAttempts))
          && activeModel !== 'gemini-3.1-flash-lite') {
          activeModel = 'gemini-3.1-flash-lite';
          onProgress({ batch: index + 1, batches: batches.length, attempt, accepted: accepted.size, total: contexts.length, remainingInBatch: pending.length, modelSwitched: activeModel,
            modelSwitchReason: error.status === 429 ? 'quota' : 'provider-unavailable' });
          // The quota/unavailable response returned no content; permit one bounded model
          // switch without consuming the final content-repair attempt.
          attempt--;
          continue;
        }
        const repairable = error instanceof GeminiRequestError && (['INVALID_RESPONSE', 'TRUNCATED', 'NETWORK', 'TIMEOUT'].includes(error.code) || (error.code === 'HTTP' && error.status >= 500));
        if (!repairable || attempt === maxAttempts) throw error;
        onProgress({ batch: index + 1, batches: batches.length, attempt, accepted: accepted.size, total: contexts.length, remainingInBatch: pending.length });
        revisionGuidance = 'Return valid JSON with exactly one matching contextId for EVERY requested context, ASCII Roman first-person template text and one terminal period. Include exactly the four required unresolved bracket slots and the assigned categoryPhrase; omit all product-brand names and fields. Do not fill in a customer experience, recipient or praise.';
        continue;
      }
      usage.inputTokens += result.usage?.inputTokens || 0;
      usage.outputTokens += result.usage?.outputTokens || 0;
      const errors = [];
      for (const entry of result.entries) {
        try { accept(entry, requestModel); }
        catch (error) { errors.push(`${entry.contextId}: ${error.message}`); }
      }
      pending = pending.filter(context => !accepted.has(context.contextId));
      await onCheckpoint({ schemaVersion: MANIFEST_SCHEMA, kind: DRAFT_KIND, model, activeModel, contextHash, entries: [...accepted.values()] });
      onProgress({ batch: index + 1, batches: batches.length, attempt, accepted: accepted.size, total: contexts.length, remainingInBatch: pending.length,
        validationErrors: [...new Set(errors.map(message => message.replace(/^[a-f0-9]{20}: /, '').replace(/ for [a-f0-9]{20}/g, '')))].slice(0, 3) });
      const avoid = acceptedWordings(pending);
      revisionGuidance = `Repair the rejected contexts with exactly four slots [area: supplied area], [category: assigned categoryPhrase], [recipient], [experience]. Use fresh past-visit grammar and only ONE final period in ASCII Roman text. No product-brand names/fields/placeholders or invented feedback, relatives, prices or satisfaction. Keep the exact assigned categoryPhrase and distinguish styleIndex. AREA/PHRASE in existing shapes are abstract: restore this context's exact area and categoryPhrase.${neutralVocabulary(pending.length ? pending : batches[index])} Validation notes: ${errors.slice(0, 8).join('; ')}. Already accepted sentence shapes to avoid: ${JSON.stringify(avoid)}.`.slice(0, 3900);
    }
    if (pending.length) unfinished.push({ batch: index + 1, count: pending.length });
  }
  if (unfinished.length) throw new Error(`Gemini has ${unfinished.reduce((sum, item) => sum + item.count, 0)} invalid sentences across ${unfinished.length} batches; accepted private checkpoints were retained and the published data is unchanged.`);
  const entries = contexts.map(context => accepted.get(context.contextId));
  const manifest = { ...manifestFor(contexts, entries, model), modelsUsed: [...new Set(entries.map(entry => entry.model))], usage };
  validateGeminiDrafts(contexts, manifest);
  return manifest;
}

export async function refreshGeminiFile({ outputPath, contexts, apiKey, model, request, batchSize, maxAttempts, checkpoint, onCheckpoint, onProgress }) {
  const manifest = await generateGeminiManifest({ contexts, apiKey, model, request, batchSize, maxAttempts, checkpoint, onCheckpoint, onProgress });
  const target = resolve(outputPath);
  const pending = target + '.pending';
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(pending, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    await rename(pending, target);
  } catch (error) {
    await unlink(pending).catch(() => {});
    throw new Error('Could not atomically save validated Gemini drafts.');
  }
  return manifest;
}

async function main() {
  // .env is ignored, mode 0600, local to the private maintenance workspace.
  try { process.loadEnvFile(resolve(ROOT, '.env')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not read private Gemini configuration.'); }
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) throw new Error('Set GEMINI_API_KEY in the private maintenance environment before generation.');
  const checkpointPath = resolve(ROOT, 'work/gemini-checkpoint.json');
  let checkpoint;
  if (process.argv.includes('--resume')) {
    try { checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8')); }
    catch { /* A completed prior manifest is not a checkpoint: scheduled refreshes must generate new wording. */ }
  }
  const manifest = await refreshGeminiFile({
    outputPath: resolve(ROOT, 'gemini-drafts.json'), apiKey, model, checkpoint,
    batchSize: process.env.GEMINI_BATCH_SIZE === undefined ? undefined : Number(process.env.GEMINI_BATCH_SIZE),
    onCheckpoint: async data => {
      await mkdir(dirname(checkpointPath), { recursive: true });
      await writeFile(checkpointPath, JSON.stringify(data), { mode: 0o600 });
    },
    onProgress: progress => {
      console.log(`${progress.modelSwitched ? `Switching to ${progress.modelSwitched} after the primary model's ${progress.modelSwitchReason === 'provider-unavailable' ? 'unavailable' : 'quota'} response. ` : ''}Gemini batch ${progress.batch}/${progress.batches}, attempt ${progress.attempt}: ${progress.accepted}/${progress.total} accepted${progress.remainingInBatch ? `; repairing ${progress.remainingInBatch}` : ''}.`);
      if (progress.validationErrors?.length) console.log(`Validation: ${progress.validationErrors.join('; ')}`.replaceAll(apiKey, '[REDACTED]'));
    },
  });
  await unlink(checkpointPath).catch(() => {});
  console.log(`Validated ${manifest.entries.length} Gemini customer-POV fill-in templates with ${manifest.modelsUsed.join(', ')}; credentials were not written to generated data.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // Provider/network exceptions never include bodies, headers or credentials.
    if (error instanceof GeminiRequestError) console.error(`Gemini generation stopped (${error.code}${error.status ? `, HTTP ${error.status}` : ''}): ${error.message}; existing public data was preserved.`.replaceAll(process.env.GEMINI_API_KEY || '\0', '[REDACTED]'));
    else console.error(String(error.message).replaceAll(process.env.GEMINI_API_KEY || '\0', '[REDACTED]'));
    process.exitCode = 1;
  });
}
