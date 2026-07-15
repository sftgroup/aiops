import { AIOpsClientConfig } from "./types.js";
import { ContentResource } from "./resources/content.js";
import { TTSResource } from "./resources/tts.js";
import { QuotaResource } from "./resources/quota.js";
import { MediaResource } from "./resources/media.js";
import { DashboardResource } from "./resources/dashboard.js";
export declare class AIOpsClient {
    private apiKey?;
    private token?;
    private baseUrl;
    content: ContentResource;
    tts: TTSResource;
    quota: QuotaResource;
    media: MediaResource;
    dashboard: DashboardResource;
    constructor(config: AIOpsClientConfig);
    private request;
}
