export type OperationResult<T> = {
  data: T | null;
  error: string | null;
};

export function ok<T>(data: T): OperationResult<T> {
  return { data, error: null };
}

export function fail<T>(error: string): OperationResult<T> {
  return { data: null, error };
}
