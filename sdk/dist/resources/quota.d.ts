import { QuotaSummaryResponse, RequestMethod } from "../types.js";
type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;
export declare class QuotaResource {
    private request;
    constructor(request: RequestFn);
    get(): Promise<QuotaSummaryResponse>;
}
export {};
