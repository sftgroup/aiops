import { AIOpsClientConfig, RequestMethod } from "./types.js";
import { AIOpsError } from "./error.js";
import { ContentResource } from "./resources/content.js";
import { TTSResource } from "./resources/tts.js";
import { QuotaResource } from "./resources/quota.js";
import { MediaResource } from "./resources/media.js";
import { DashboardResource } from "./resources/dashboard.js";

export class AIOpsClient {
  private apiKey?: string;
  private token?: string;
  private baseUrl: string;

  public content: ContentResource;
  public tts: TTSResource;
  public quota: QuotaResource;
  public media: MediaResource;
  public dashboard: DashboardResource;

  constructor(config: AIOpsClientConfig) {
    if (!config.apiKey && !config.token) {
      throw new AIOpsError(
        "Either apiKey or token must be provided",
        "MISSING_AUTH",
        0
      );
    }

    this.apiKey = config.apiKey;
    this.token = config.token;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");

    this.content = new ContentResource(this.request.bind(this));
    this.tts = new TTSResource(this.request.bind(this));
    this.quota = new QuotaResource(this.request.bind(this));
    this.media = new MediaResource(this.request.bind(this));
    this.dashboard = new DashboardResource(this.request.bind(this));
  }

  private async request<T>(
    method: RequestMethod,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new AIOpsError(
        "Network request failed",
        "NETWORK_ERROR",
        0
      );
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = null;
      }

      const message =
        (errorBody as { message?: string })?.message ||
        `Request failed with status ${response.status}`;

      throw new AIOpsError(message, "API_ERROR", response.status, errorBody);
    }

    return response.json() as Promise<T>;
  }
}
