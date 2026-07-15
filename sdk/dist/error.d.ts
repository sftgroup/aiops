export declare class AIOpsError extends Error {
    code: string;
    status: number;
    details: unknown;
    constructor(message: string, code: string, status: number, details?: unknown);
}
