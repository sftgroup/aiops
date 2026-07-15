export class DashboardResource {
    constructor(request) {
        this.request = request;
    }
    overview() {
        return this.request("GET", "/api/dashboard/overview");
    }
    trend(days) {
        const query = days ? `?days=${days}` : "";
        return this.request("GET", `/api/dashboard/trend${query}`);
    }
    quota() {
        return this.request("GET", "/api/dashboard/quota");
    }
}
