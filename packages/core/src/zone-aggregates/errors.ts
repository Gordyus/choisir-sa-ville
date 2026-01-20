export class ZoneAggregateError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ZoneAggregateError";
    this.code = code;
    this.details = details;
  }
}

export function unknownAggregate(aggregateId: string): ZoneAggregateError {
  return new ZoneAggregateError(
    "UNKNOWN_AGGREGATE",
    `Aggregate ${aggregateId} is not registered.`,
    { aggregateId }
  );
}

export function noData(message: string, details?: Record<string, unknown>): ZoneAggregateError {
  return new ZoneAggregateError("NO_DATA", message, details);
}
