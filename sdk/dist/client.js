import { AIOpsError } from "./error.js";
import { ContentResource } from "./resources/content.js";
import { TTSResource } from "./resources/tts.js";
import { QuotaResource } from "./resources/quota.js";
import { MediaResource } from "./resources/media.js";
import { DashboardResource } from "./resources/dashboard.js";
export class AIOpsClient {
    constructor(config) {
        if (!config.apiKey && !config.token) {
            throw new AIOpsError("Either apiKey or token must be provided", "MISSING_AUTH", 0);
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
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["X-API-Key"] = this.apiKey;
        }
        if (this.token) {
            headers["Authorization"] = `Bearer ${this.token}`;
        }
        let response;
        try {
            response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
        }
        catch {
            throw new AIOpsError("Network request failed", "NETWORK_ERROR", 0);
        }
        if (!response.ok) {
            let errorBody;
            try {
                errorBody = await response.json();
            }
            catch {
                errorBody = null;
            }
            const message = errorBody?.message ||
                `Request failed with status ${response.status}`;
            throw new AIOpsError(message, "API_ERROR", response.status, errorBody);
        }
        return response.json();
    }
}
