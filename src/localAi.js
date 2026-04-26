import { db } from './store.js';

const SETTINGS_KEY = 'local_ai_settings';
export const LOCAL_AI_MODELS = [
  {
    id: 'gemma-4-e2b-it-web',
    label: 'Gemma 4 E2B IT Web (recommended)',
    shortLabel: 'Gemma 4 E2B IT Web',
    repo: 'litert-community/gemma-4-E2B-it-litert-lm',
    modelUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task',
    size: '2 GB',
    note: 'Instruction-tuned E2B web task model for Chrome/WebGPU. Best balance for browser-side workshop grouping.',
  },
];

const DEFAULT_SETTINGS = {
  mode: 'heuristic',
  modelId: LOCAL_AI_MODELS[0].id,
  modelUrl: LOCAL_AI_MODELS[0].modelUrl,
  maxTokens: 900,
  temperature: 0.25,
  topK: 64,
};

let llmInstance = null;
let llmModelUrl = '';

export function getLocalAiSettings() {
  return { ...DEFAULT_SETTINGS, ...(db.get(SETTINGS_KEY, {}) || {}) };
}

export function saveLocalAiSettings(settings) {
  const next = { ...getLocalAiSettings(), ...settings };
  db.set(SETTINGS_KEY, next);
  return next;
}

export async function getLocalAiCapability() {
  const webGpu = typeof navigator !== 'undefined' && !!navigator.gpu;
  const cacheApi = typeof caches !== 'undefined';
  return {
    webGpu,
    cacheApi,
    supported: webGpu,
    message: webGpu
      ? 'WebGPU available'
      : 'This browser does not expose WebGPU. Use Chrome/Edge desktop or keep quick grouping.',
  };
}

export async function cacheModelAsset(modelUrl, onProgress) {
  if (!modelUrl) throw new Error('Missing model URL');
  if (typeof caches === 'undefined') throw new Error('Cache API is not available');
  const cache = await caches.open('kc-local-ai-models-v1');
  const cached = await cache.match(modelUrl);
  if (cached) {
    onProgress?.({ loaded: 1, total: 1, pct: 100, cached: true });
    return { cached: true };
  }

  const res = await fetch(modelUrl, { mode: 'cors' });
  if (!res.ok) throw new Error(`Model download failed: HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length') || 0);
  if (!res.body || !total) {
    await cache.put(modelUrl, res.clone());
    onProgress?.({ loaded: total || 1, total: total || 1, pct: 100, cached: false });
    return { cached: false };
  }

  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.({ loaded, total, pct: Math.round((loaded / total) * 100), cached: false });
  }

  const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' });
  const cachedRes = new Response(blob, { headers: res.headers });
  await cache.put(modelUrl, cachedRes);
  return { cached: false };
}

async function loadMediaPipeModule() {
  return import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest');
}

export async function warmLocalModel(settings = getLocalAiSettings()) {
  const capability = await getLocalAiCapability();
  if (!capability.supported) throw new Error(capability.message);
  if (llmInstance && llmModelUrl === settings.modelUrl) return llmInstance;

  const { FilesetResolver, LlmInference } = await loadMediaPipeModule();
  const genai = await FilesetResolver.forGenAiTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm',
  );
  llmInstance = await LlmInference.createFromOptions(genai, {
    baseOptions: { modelAssetPath: settings.modelUrl },
    maxTokens: Number(settings.maxTokens || DEFAULT_SETTINGS.maxTokens),
    topK: Number(settings.topK || DEFAULT_SETTINGS.topK),
    temperature: Number(settings.temperature ?? DEFAULT_SETTINGS.temperature),
    randomSeed: 42,
  });
  llmModelUrl = settings.modelUrl;
  return llmInstance;
}

const stripFences = (text) => String(text || '')
  .replace(/```json/gi, '')
  .replace(/```/g, '')
  .trim();

function parseGroups(text) {
  const cleaned = stripFences(text);
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error('Model did not return JSON');
  const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
  const groups = Array.isArray(parsed.groups) ? parsed.groups : [];
  return groups
    .map(g => ({
      name: String(g.name || '').trim() || 'Group',
      items: Array.isArray(g.items) ? g.items.map(x => String(x).trim()).filter(Boolean) : [],
    }))
    .filter(g => g.items.length);
}

export function heuristicGroupResponses(entries, lang = 'zh') {
  const tokenOf = (text) => {
    const cleaned = String(text || '')
      .toLowerCase()
      .replace(/[^\p{Script=Han}\p{Letter}\p{Number}\s]/gu, ' ')
      .trim();
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    if (words.length) return words.sort((a, b) => b.length - a.length)[0];
    return cleaned.slice(0, 2) || (lang === 'zh' ? '其他' : 'Other');
  };
  const grouped = new Map();
  entries.forEach(item => {
    const key = tokenOf(item);
    grouped.set(key, [...(grouped.get(key) || []), item]);
  });
  return [...grouped.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8)
    .map(([name, items]) => ({ name, items }));
}

export async function groupResponsesWithLocalModel(entries, settings = getLocalAiSettings(), lang = 'zh') {
  const model = await warmLocalModel(settings);
  const prompt = `<start_of_turn>user
You are helping a workshop host group short word-cloud responses.
Group semantically similar responses into 3 to 8 concise groups.
Return ONLY valid JSON. Do not add markdown.
JSON shape:
{"groups":[{"name":"short group name","items":["exact original response"]}]}

Rules:
- Every original response must appear exactly once.
- Keep group names short and useful for facilitation.
- Use ${lang === 'zh' ? 'Traditional Chinese' : 'English'} group names when possible.

Responses:
${entries.map((x, i) => `${i + 1}. ${x}`).join('\n')}
<end_of_turn>
<start_of_turn>model
`;
  const response = await model.generateResponse(prompt);
  const groups = parseGroups(response);
  if (!groups.length) throw new Error('No groups returned');
  return groups;
}
