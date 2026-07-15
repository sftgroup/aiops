export class AIOpsError extends Error {
    constructor(message, code, status, details) {
        super(message);
        this.name = "AIOpsError";
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
