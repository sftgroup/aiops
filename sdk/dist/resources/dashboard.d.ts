import { DashboardOverviewResponse, DashboardTrendResponse, DashboardQuotaResponse, RequestMethod } from "../types.js";
type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;
export declare class DashboardResource {
    private request;
    constructor(request: RequestFn);
    overview(): Promise<DashboardOverviewResponse>;
    trend(days?: number): Promise<DashboardTrendResponse>;
    quota(): Promise<DashboardQuotaResponse>;
}
export {};
