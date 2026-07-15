import {
  ContentGenerateParams,
  ContentGenerateResponse,
  ContentListParams,
  ContentListResponse,
  ContentPlatformsResponse,
  ContentStylesResponse,
  RequestMethod,
} from "../types.js";

type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;

export class ContentResource {
  constructor(private request: RequestFn) {}

  generate(params: ContentGenerateParams): Promise<ContentGenerateResponse> {
    return this.request<ContentGenerateResponse>("POST", "/api/content/generate", params);
  }

  list(params?: ContentListParams): Promise<ContentListResponse> {
    const query = params ? "?" + new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString() : "";
    return this.request<ContentListResponse>("GET", `/api/content/list${query}`);
  }

  platforms(): Promise<ContentPlatformsResponse> {
    return this.request<ContentPlatformsResponse>("GET", "/api/content/platforms");
  }

  styles(): Promise<ContentStylesResponse> {
    return this.request<ContentStylesResponse>("GET", "/api/content/styles");
  }
}
