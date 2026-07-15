export class MediaResource {
    constructor(request) {
        this.request = request;
    }
    generateVideo(params) {
        return this.request("POST", "/api/ai-media/video", params);
    }
    getVideoStatus(taskId) {
        return this.request("GET", `/api/ai-media/video/status/${taskId}`);
    }
    generatePoster(params) {
        return this.request("POST", "/api/ai-media/poster", params);
    }
    getPosterStatus(taskId) {
        return this.request("GET", `/api/ai-media/poster/status/${taskId}`);
    }
    getPosterModels() {
        return this.request("GET", "/api/ai-media/poster/models");
    }
    getPosterSizes() {
        return this.request("GET", "/api/ai-media/poster/sizes");
    }
    getPosterStyles() {
        return this.request("GET", "/api/ai-media/poster/styles");
    }
}
