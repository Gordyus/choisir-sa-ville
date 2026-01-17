export type DomainErrorDetails = Record<string, unknown> | undefined;

export class DomainError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function notFound(
  message: string = "Not found",
  details?: Record<string, unknown>
): DomainError {
  return new DomainError("NOT_FOUND", message, 404, details);
}

export function conflict(
  message: string = "Conflict",
  details?: Record<string, unknown>
): DomainError {
  return new DomainError("CONFLICT", message, 409, details);
}

export function domainError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  httpStatus: number = 422
): DomainError {
  return new DomainError(code, message, httpStatus, details);
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
