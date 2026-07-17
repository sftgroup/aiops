// ─── Account ─────────────────────────────────────────────
export interface Account {
  id: string;
  _id: string;
  platform: string;
  screenName: string;
  name?: string;
  username?: string;
  createdAt: string;
  [key: string]: unknown;
}

// ─── Content ─────────────────────────────────────────────
export interface Content {
  id: string;
  _id?: string;
  title?: string;
  subject?: string;
  text?: string;
  imageUrl?: string;
  type?: string;
  status?: string;
  createdAt: string;
  [key: string]: unknown;
}

// ─── Publish ─────────────────────────────────────────────
export interface PublishResult {
  status: 'published' | 'failed';
  accountId?: string;
  error?: string;
  data?: { id?: string; [key: string]: unknown };
}

export interface PublishRecord {
  id: string;
  status: string;
  screenName?: string;
  text?: string;
  createdAt: string;
  result?: { data?: { id?: string }; error?: string };
}

// ─── WebSocket / Task messages ───────────────────────────
export interface WsTaskMessage {
  type?: string;
  taskId?: string;
  step?: string;
  status?: string;
  progress?: number;
  message?: string;
  iteration?: number;
  total?: number;
  url?: string;
  error?: string;
  wanProgress?: number;
  employee?: string;
}

// ─── Generation entries (ContentPage) ────────────────────
export interface GenerationEntry {
  step: string;
  prompt: string;
  text: string;
  taskId: string;
  startedAt: number;
}

// ─── API response wrappers ──────────────────────────────
export type ApiResponse<T> = T;
export type ApiResponseList<T> = T[];

// ─── Stats ────────────────────────────────────────────────
export interface Stats {
  totalVideos: number;
  totalTexts: number;
  published: number;
  pendingPublish: number;
  accounts: number;
  platforms: string[];
}
