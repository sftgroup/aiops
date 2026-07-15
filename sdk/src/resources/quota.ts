import { QuotaSummaryResponse, RequestMethod } from "../types.js";

type RequestFn = <T>(method: RequestMethod, path: string, body?: unknown) => Promise<T>;

export class QuotaResource {
  constructor(private request: RequestFn) {}

  get(): Promise<QuotaSummaryResponse> {
    return this.request<QuotaSummaryResponse>("GET", "/api/quota/summary");
  }
}
