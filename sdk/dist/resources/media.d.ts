import { MediaGenerateParams, MediaGenerateResponse, MediaStatusResponse, RequestMethod } from "../types.js";
type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;
export declare class MediaResource {
    private request;
    constructor(request: RequestFn);
    generateVideo(params: MediaGenerateParams): Promise<MediaGenerateResponse>;
    getVideoStatus(taskId: string): Promise<MediaStatusResponse>;
    generatePoster(params: MediaGenerateParams): Promise<MediaGenerateResponse>;
    getPosterStatus(taskId: string): Promise<MediaStatusResponse>;
    getPosterModels(): Promise<unknown>;
    getPosterSizes(): Promise<unknown>;
    getPosterStyles(): Promise<unknown>;
}
export {};
