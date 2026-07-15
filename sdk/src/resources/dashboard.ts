import {
  DashboardOverviewResponse,
  DashboardTrendResponse,
  DashboardQuotaResponse,
  RequestMethod,
} from "../types.js";

type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;

export class DashboardResource {
  constructor(private request: RequestFn) {}

  overview(): Promise<DashboardOverviewResponse> {
    return this.request<DashboardOverviewResponse>("GET", "/api/dashboard/overview");
  }

  trend(days?: number): Promise<DashboardTrendResponse> {
    const query = days ? `?days=${days}` : "";
    return this.request<DashboardTrendResponse>("GET", `/api/dashboard/trend${query}`);
  }

  quota(): Promise<DashboardQuotaResponse> {
    return this.request<DashboardQuotaResponse>("GET", "/api/dashboard/quota");
  }
}
