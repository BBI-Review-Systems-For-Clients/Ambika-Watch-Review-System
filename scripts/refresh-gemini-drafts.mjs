import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { buildReviewContexts, validateGeminiDrafts, CUSTOMER_POV_SCAFFOLD_WORDS } from '../business-profile.js';
import { requestGeminiDrafts, GeminiRequestError } from '../gemini-client.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DRAFT_KIND = 'customer-pov-template';
const hashContexts = contexts => createHash('sha256').update(JSON.stringify(contexts)).digest('hex');
const manifestFor = (contexts, entries, model) => ({
  schemaVersion: 1, kind: DRAFT_KIND, provider: 'google-gemini', model,
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
  let activeModel = checkpoint?.kind === DRAFT_KIND && checkpoint.model === model && typeof checkpoint.activeModel === 'string' && /^gemini-[a-z0-9.-]+$/.test(checkpoint.activeModel) ? checkpoint.activeModel : model;
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
  if (checkpoint?.kind === DRAFT_KIND && checkpoint.contextHash === contextHash && checkpoint.model === model && Array.isArray(checkpoint.entries)) {
    for (const entry of checkpoint.entries) { try { accept(entry); } catch { /* Invalid checkpoint rows are regenerated. */ } }
  }
  usage.resumedEntries = accepted.size;
  const acceptedWordings = pending => [...accepted.values()].filter(entry => {
    const existing = byId.get(entry.contextId);
    return pending.some(context => context.language === existing.language && context.area === existing.area && context.brand === existing.brand && context.category === existing.category);
  }).map(entry => entry.text).slice(-12);
  const neutralVocabulary = pending => ` Outside the slots and exact business/city names, use ONLY these neutral ${pending[0].language} grammar words (case-insensitive): ${CUSTOMER_POV_SCAFFOLD_WORDS[pending[0].language].join(' ')}.`;
  const batches = [];
  for (const language of ['en', 'hi', 'gu']) {
    const pending = contexts.filter(context => context.language === language && !accepted.has(context.contextId));
    for (let offset = 0; offset < pending.length; offset += batchSize) batches.push(pending.slice(offset, offset + batchSize));
  }
  for (let index = 0; index < batches.length; index++) {
    let pending = batches[index];
    let revisionGuidance = 'Write a first-person customer-POV fill-in template, not shop advice. Use exactly five unresolved slots: [area: supplied area], [brand: supplied brand], [category: categoryPhrase], [recipient], [experience]. Suggested area, brand and category occur only inside their slots. Keep recipient and experience unknown; do not insert papa/friend, staff praise, price feedback or purchase details as facts. All five slots must remain editable before copying.';
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
        if (error instanceof GeminiRequestError && error.code === 'HTTP' && error.status === 429 && activeModel !== 'gemini-3.1-flash-lite') {
          activeModel = 'gemini-3.1-flash-lite';
          onProgress({ batch: index + 1, batches: batches.length, attempt, accepted: accepted.size, total: contexts.length, remainingInBatch: pending.length, modelSwitched: activeModel });
          // A quota rejection returned no content; permit one bounded model
          // switch without consuming the final content-repair attempt.
          attempt--;
          continue;
        }
        const repairable = error instanceof GeminiRequestError && (['INVALID_RESPONSE', 'TRUNCATED', 'NETWORK', 'TIMEOUT'].includes(error.code) || (error.code === 'HTTP' && error.status >= 500));
        if (!repairable || attempt === maxAttempts) throw error;
        onProgress({ batch: index + 1, batches: batches.length, attempt, accepted: accepted.size, total: contexts.length, remainingInBatch: pending.length });
        revisionGuidance = 'Return valid JSON with exactly one matching contextId for EVERY requested context, ASCII Roman first-person template text and one terminal period. Include exactly the five required unresolved bracket slots with exact field names and supplied entity suggestions. Do not fill in a customer experience, recipient or praise; the customer supplies those details.';
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
      await onCheckpoint({ schemaVersion: 1, kind: DRAFT_KIND, model, activeModel, contextHash, entries: [...accepted.values()] });
      onProgress({ batch: index + 1, batches: batches.length, attempt, accepted: accepted.size, total: contexts.length, remainingInBatch: pending.length });
      const avoid = acceptedWordings(pending);
      revisionGuidance = `Repair the rejected contexts. Preserve exact IDs and all five bracketed fields [area: supplied area], [brand: supplied brand], [category: categoryPhrase], [recipient], [experience]. Write a different first-person customer-POV sentence with only ONE final period and ASCII Roman text. Area/brand/category appear only inside their brackets; recipient and experience remain unknown. No positive or negative feedback, relatives, price/stock or satisfaction claims outside placeholders.${neutralVocabulary(pending.length ? pending : batches[index])} Validation notes: ${errors.join('; ')}. Already accepted wordings to avoid: ${JSON.stringify(avoid)}.`.slice(0, 3900);
    }
    if (pending.length) throw new Error(`Gemini batch ${index + 1} still has ${pending.length} invalid sentences; the previous published data is unchanged.`);
  }
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
    onCheckpoint: async data => {
      await mkdir(dirname(checkpointPath), { recursive: true });
      await writeFile(checkpointPath, JSON.stringify(data), { mode: 0o600 });
    },
    onProgress: progress => console.log(`${progress.modelSwitched ? `Switching to ${progress.modelSwitched} after the primary model's quota response. ` : ''}Gemini batch ${progress.batch}/${progress.batches}, attempt ${progress.attempt}: ${progress.accepted}/${progress.total} accepted${progress.remainingInBatch ? `; repairing ${progress.remainingInBatch}` : ''}.`),
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
