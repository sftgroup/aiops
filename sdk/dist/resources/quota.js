export class QuotaResource {
    constructor(request) {
        this.request = request;
    }
    get() {
        return this.request("GET", "/api/quota/summary");
    }
}
