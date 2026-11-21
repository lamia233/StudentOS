import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '../lib/api';
import type { Course } from '../lib/types';

export const useApiQuery = <T,>(key: QueryKey, path: string, enabled = true) =>
  useQuery<T>({ queryKey: key, queryFn: () => api.get<T>(path), enabled });

/** Keys that depend on almost every write (dashboard aggregates, radar, analytics...). */
const DERIVED: QueryKey[] = [['dashboard'], ['radar'], ['productivity'], ['priorities'], ['calendar'], ['notifications'], ['recommendations'], ['courses']];

export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { invalidate?: QueryKey[]; success?: string | ((r: TResult, v: TVars) => string | null); onSuccess?: (r: TResult, v: TVars) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn: fn,
    onSuccess: (r, v) => {
      for (const k of [...(opts.invalidate ?? []), ...DERIVED]) qc.invalidateQueries({ queryKey: k });
      const msg = typeof opts.success === 'function' ? opts.success(r, v) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export const useCourses = () => useApiQuery<Course[]>(['courses'], '/courses');
