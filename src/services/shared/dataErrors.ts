export class DataLayerError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DataLayerError';
  }
}

export function toDataLayerError(error: unknown, fallbackMessage: string) {
  if (error instanceof DataLayerError) {
    return error;
  }

  if (error instanceof Error) {
    return new DataLayerError(error.message || fallbackMessage, undefined, error);
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const typedError = error as { message?: string; code?: string };
    return new DataLayerError(typedError.message || fallbackMessage, typedError.code, error);
  }

  return new DataLayerError(fallbackMessage, undefined, error);
}
