import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIENCE_IDS, getExperienceOptions, getOnDeviceExperienceOptions } from '../experience-options.js';

const indexes = { selection: 0, staff: 1, value: 2, quick: 3, mixed: 4, improve: 0 };
const sortedIds = [...EXPERIENCE_IDS].sort();
const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

function assertAllExperiences(options) {
  assert.deepEqual(options.map(option => option.id).sort(), sortedIds);
  assert.ok(options.some(option => option.id === 'mixed'));
  assert.ok(options.some(option => option.id === 'improve'));
  for (const option of options) {
    assert.equal(typeof option.label, 'string');
    assert.ok(option.label.trim());
    assert.ok(option.label.length <= 35, option.label);
    assert.doesNotMatch(option.label, /five.star|5.star|bought|purchased|highly recommend/i);
  }
}

test('all six experiences, including mixed and critical, survive every randomized run', () => {
  assert.ok(Object.isFrozen(EXPERIENCE_IDS));
  for (let i = 0; i < 100; i += 1) assertAllExperiences(getExperienceOptions());
});

test('every language has five distinct, short vetted variants for every semantic ID', () => {
  for (const language of ['en', 'hi', 'gu']) {
    const variants = new Map(EXPERIENCE_IDS.map(id => [id, new Set()]));
    for (let index = 0; index < 5; index += 1) {
      const options = getExperienceOptions({ language, random: () => (index + 0.5) / 5 });
      assertAllExperiences(options);
      for (const { id, label } of options) {
        variants.get(id).add(label);
        assert.doesNotMatch(label, /[\u0900-\u097f\u0a80-\u0aff]/u);
      }
    }
    for (const pool of variants.values()) assert.equal(pool.size, 5);
  }
});

test('injected randomness deterministically controls wording and order', () => {
  const first = getExperienceOptions({ random: () => 0 });
  assert.deepEqual(first.map(option => option.id), ['staff', 'value', 'quick', 'mixed', 'improve', 'selection']);
  assert.equal(first.find(option => option.id === 'selection').label, 'Good collection');
  const last = getExperienceOptions({ random: () => 0.999 });
  assert.deepEqual(last.map(option => option.id), EXPERIENCE_IDS);
  assert.equal(last.find(option => option.id === 'selection').label, 'A collection I liked');
  assert.deepEqual(getExperienceOptions({ language: 'unknown', random: () => 0 }), first);
  assert.deepEqual(getExperienceOptions({ language: '__proto__', random: () => 0 }), first);
});

test('Fisher–Yates yields each of the 720 orders once across equally likely swap paths', () => {
  const orders = new Set();
  function visit(choices = [], size = 6) {
    if (size === 1) {
      const values = [...Array(6).fill(0), ...choices];
      const options = getExperienceOptions({ random: () => values.shift() });
      orders.add(options.map(option => option.id).join(','));
      return;
    }
    for (let index = 0; index < size; index += 1) visit([...choices, (index + 0.5) / size], size - 1);
  }
  visit();
  assert.equal(orders.size, 720);
});

test('an installed model receives the approved catalog and selects only valid existing labels', async () => {
  let promptText;
  let destroyed = 0;
  let created = 0;
  let availabilityOptions;
  const result = await getOnDeviceExperienceOptions({
    random: () => 0.999,
    LanguageModel: {
      availability: async options => { availabilityOptions = options; return 'available'; },
      create: async options => {
        created += 1;
        assert.equal(options.signal.aborted, false);
        const { signal, ...modelOptions } = options;
        assert.deepEqual(modelOptions, availabilityOptions);
        return {
          prompt: async (prompt, options) => {
            assert.equal(options.signal.aborted, false);
            promptText = prompt;
            return JSON.stringify(indexes);
          },
          destroy: () => { destroyed += 1; },
        };
      },
    },
  });
  assert.equal(created, 1);
  assert.equal(destroyed, 1);
  assert.equal(result.usedAI, true);
  assertAllExperiences(result.options);
  const catalog = JSON.parse(promptText.split('Approved phrase catalog: ')[1]);
  assert.match(promptText, /Do not generate reviews/);
  for (const { id, label } of result.options) assert.equal(label, catalog[id][indexes[id]]);
});

test('malformed, incomplete, extra, duplicate and out-of-range AI output falls back honestly', async () => {
  const invalid = [
    'not JSON', '```json\n{}\n```', 'null', '[]', '{}',
    JSON.stringify({ ...indexes, unknown: 0 }),
    JSON.stringify({ ...indexes, staff: 5 }),
    JSON.stringify({ ...indexes, staff: -1 }),
    JSON.stringify({ ...indexes, staff: 1.5 }),
    JSON.stringify({ ...indexes, staff: '1' }),
    `{"selection":0,"selection":1,"staff":1,"value":2,"quick":3,"mixed":4,"improve":0}`,
  ];
  for (const raw of invalid) {
    let destroyed = 0;
    const result = await getOnDeviceExperienceOptions({
      random: () => 0.25,
      LanguageModel: {
        availability: async () => 'available',
        create: async () => ({ prompt: async () => raw, destroy: () => { destroyed += 1; } }),
      },
    });
    assert.equal(result.usedAI, false);
    assert.equal(destroyed, 1);
    assert.deepEqual(result.options, getExperienceOptions({ random: () => 0.25 }));
  }
});

test('unavailable, downloadable, downloading and unknown states never create or download a model', async () => {
  for (const state of ['unavailable', 'downloadable', 'downloading', 'unknown', undefined]) {
    let created = 0;
    const result = await getOnDeviceExperienceOptions({
      LanguageModel: { availability: async () => state, create: () => { created += 1; throw new Error('must not create'); } },
    });
    assert.equal(created, 0);
    assert.equal(result.usedAI, false);
    assertAllExperiences(result.options);
  }
});

test('unsupported languages and missing APIs use local options without touching a model', async () => {
  for (const language of ['hi', 'gu', 'unknown']) {
    const result = await getOnDeviceExperienceOptions({
      language,
      random: () => 0.1,
      LanguageModel: { availability: () => { throw new Error('must not inspect'); }, create: () => { throw new Error('must not create'); } },
    });
    assert.equal(result.usedAI, false);
    assert.deepEqual(result.options, getExperienceOptions({ language, random: () => 0.1 }));
  }
  const result = await getOnDeviceExperienceOptions();
  assert.equal(result.usedAI, false);
  assertAllExperiences(result.options);
});

test('model errors keep every local experience and destroy an opened session', async () => {
  let destroyed = 0;
  const result = await getOnDeviceExperienceOptions({
    LanguageModel: {
      availability: async () => 'available',
      create: async () => ({ prompt: async () => { throw new Error('model failed'); }, destroy: () => { destroyed += 1; } }),
    },
  });
  assert.equal(result.usedAI, false);
  assert.equal(destroyed, 1);
  assertAllExperiences(result.options);
});

test('a two-second timeout destroys a session that finishes creating late', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let finishCreation;
  let destroyed = 0;
  let prompts = 0;
  const pending = getOnDeviceExperienceOptions({
    LanguageModel: {
      availability: async () => 'available',
      create: () => new Promise(resolve => { finishCreation = resolve; }),
    },
  });
  await flush();
  assert.equal(typeof finishCreation, 'function');
  context.mock.timers.tick(2000);
  const result = await pending;
  assert.equal(result.usedAI, false);
  assertAllExperiences(result.options);
  finishCreation({ prompt: () => { prompts += 1; }, destroy: () => { destroyed += 1; } });
  await flush();
  assert.equal(destroyed, 1);
  assert.equal(prompts, 0);
});

test('a prompt timeout aborts the operation and destroys its session', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let promptSignal;
  let destroyed = 0;
  const pending = getOnDeviceExperienceOptions({
    LanguageModel: {
      availability: async () => 'available',
      create: async () => ({
        prompt: (_, { signal }) => { promptSignal = signal; return new Promise(() => {}); },
        destroy: () => { destroyed += 1; },
      }),
    },
  });
  await flush();
  assert.equal(promptSignal.aborted, false);
  context.mock.timers.tick(2000);
  assert.equal((await pending).usedAI, false);
  assert.equal(promptSignal.aborted, true);
  assert.equal(destroyed, 1);
});

test('pre-aborted input never inspects or creates a model', async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await getOnDeviceExperienceOptions({
    signal: controller.signal,
    LanguageModel: { availability: () => { throw new Error('must not inspect'); }, create: () => { throw new Error('must not create'); } },
  });
  assert.equal(result.usedAI, false);
  assertAllExperiences(result.options);
});

test('caller cancellation preserves local options and cleans up late model creation', async () => {
  const controller = new AbortController();
  let finishCreation;
  let destroyed = 0;
  const pending = getOnDeviceExperienceOptions({
    signal: controller.signal,
    LanguageModel: {
      availability: async () => 'available',
      create: () => new Promise(resolve => { finishCreation = resolve; }),
    },
  });
  await flush();
  controller.abort();
  assert.equal((await pending).usedAI, false);
  finishCreation({ destroy: () => { destroyed += 1; } });
  await flush();
  assert.equal(destroyed, 1);
});
