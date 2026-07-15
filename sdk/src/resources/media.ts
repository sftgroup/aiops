import {
  MediaGenerateParams,
  MediaGenerateResponse,
  MediaStatusResponse,
  RequestMethod,
} from "../types.js";

type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;

export class MediaResource {
  constructor(private request: RequestFn) {}

  generateVideo(params: MediaGenerateParams): Promise<MediaGenerateResponse> {
    return this.request<MediaGenerateResponse>("POST", "/api/ai-media/video", params);
  }

  getVideoStatus(taskId: string): Promise<MediaStatusResponse> {
    return this.request<MediaStatusResponse>("GET", `/api/ai-media/video/status/${taskId}`);
  }

  generatePoster(params: MediaGenerateParams): Promise<MediaGenerateResponse> {
    return this.request<MediaGenerateResponse>("POST", "/api/ai-media/poster", params);
  }

  getPosterStatus(taskId: string): Promise<MediaStatusResponse> {
    return this.request<MediaStatusResponse>("GET", `/api/ai-media/poster/status/${taskId}`);
  }

  getPosterModels(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/ai-media/poster/models");
  }

  getPosterSizes(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/ai-media/poster/sizes");
  }

  getPosterStyles(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/ai-media/poster/styles");
  }
}
