export class ContentResource {
    constructor(request) {
        this.request = request;
    }
    generate(params) {
        return this.request("POST", "/api/content/generate", params);
    }
    list(params) {
        const query = params ? "?" + new URLSearchParams(Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])).toString() : "";
        return this.request("GET", `/api/content/list${query}`);
    }
    platforms() {
        return this.request("GET", "/api/content/platforms");
    }
    styles() {
        return this.request("GET", "/api/content/styles");
    }
}
