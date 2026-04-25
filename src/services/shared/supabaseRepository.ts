import type { SupabaseClient } from '@supabase/supabase-js';
import { DataLayerError } from './dataErrors';

type QueryResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export abstract class SupabaseRepository {
  constructor(
    protected readonly supabase: SupabaseClient,
    protected readonly organizationId: string,
  ) {}

  protected async unwrap<T>(promise: PromiseLike<QueryResult<T>>, fallbackMessage: string) {
    const { data, error } = await promise;

    if (error) {
      throw new DataLayerError(error.message || fallbackMessage, error.code, error);
    }

    if (data === null) {
      throw new DataLayerError(fallbackMessage);
    }

    return data;
  }
}
