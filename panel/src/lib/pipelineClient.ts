const API_PREFIX = '/api';

function authHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function parseErrorBody(r: Response): Promise<string> {
  try {
    const body = await r.json();
    return body.error || body.message || `请求失败 (${r.status})`;
  } catch {
    try {
      const text = await r.text();
      return text || `请求失败 (${r.status})`;
    } catch {
      return `请求失败 (${r.status})`;
    }
  }
}

/** Fetch the overall AI pipeline status (API key states & quotas) */
export async function getPipelineStatus(token: string | null): Promise<PipelineStatus> {
  const r = await fetch(`${API_PREFIX}/pipeline/status`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(await parseErrorBody(r));
  return r.json();
}

/** Generate copywriting content */
export async function generateContent(
  token: string | null,
  params: { topic: string; platform: string; style: string }
): Promise<ContentResult> {
  const r = await fetch(`${API_PREFIX}/content/generate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(await parseErrorBody(r));
  return r.json();
}

/** Synthesize text to speech */
export async function synthesizeSpeech(
  token: string | null,
  params: { text: string; voice: string }
): Promise<TTSResult> {
  const r = await fetch(`${API_PREFIX}/tts/synthesize`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(await parseErrorBody(r));
  return r.json();
}

/** Fetch previously generated content list */
export async function fetchContentList(token: string | null): Promise<ContentItem[]> {
  const r = await fetch(`${API_PREFIX}/content/list`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(await parseErrorBody(r));
  return r.json();
}

/** Fetch previously generated TTS list */
export async function fetchTTSList(token: string | null): Promise<TTSItem[]> {
  const r = await fetch(`${API_PREFIX}/tts/list`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(await parseErrorBody(r));
  return r.json();
}

/** Fetch available voices for TTS */
export async function fetchVoices(token: string | null): Promise<Voice[]> {
  const r = await fetch(`${API_PREFIX}/tts/voices`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(await parseErrorBody(r));
  const data = await r.json();
  // API returns { voices: [...], langs: [...] }
  return Array.isArray(data) ? data : (data.voices || []);
}

/** Validate an API key for a given service */
export async function validateKey(
  token: string | null,
  params: { service: string; key: string }
): Promise<{ status: string; message: string }> {
  const r = await fetch(`${API_PREFIX}/pipeline/validate-key`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(await parseErrorBody(r));
  return r.json();
}

// ── Type Definitions ──

export interface PipelineStatus {
  keys: Record<string, { valid: boolean; label: string }>;
  quotas: Record<string, { used: number; total: number; label: string }>;
}

export interface ContentResult {
  content: string;
  id?: string;
}

export interface TTSResult {
  audioUrl: string;
  duration?: number;
  id?: string;
}

export interface ContentItem {
  id: string;
  topic: string;
  platform: string;
  style: string;
  content: string;
  createdAt: string;
}

export interface TTSItem {
  id: string;
  text: string;
  voice: string;
  audioUrl: string;
  createdAt: string;
}

export interface Voice {
  id: string;
  name: string;
  gender?: string;
  language?: string;
}
