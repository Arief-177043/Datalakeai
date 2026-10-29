import { useState, useEffect, useCallback } from 'react';

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | undefined; loading: boolean; error: string | undefined; refetch: () => void } {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [counter, setCounter] = useState(0);

  const refetch = useCallback(() => setCounter((c) => c + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    asyncFn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An error occurred');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, counter]);

  return { data, loading, error, refetch };
}
