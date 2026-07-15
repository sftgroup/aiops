import { ContentGenerateParams, ContentGenerateResponse, ContentListParams, ContentListResponse, ContentPlatformsResponse, ContentStylesResponse, RequestMethod } from "../types.js";
type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;
export declare class ContentResource {
    private request;
    constructor(request: RequestFn);
    generate(params: ContentGenerateParams): Promise<ContentGenerateResponse>;
    list(params?: ContentListParams): Promise<ContentListResponse>;
    platforms(): Promise<ContentPlatformsResponse>;
    styles(): Promise<ContentStylesResponse>;
}
export {};
