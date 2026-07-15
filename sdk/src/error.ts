export class AIOpsError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = "AIOpsError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
