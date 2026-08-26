import { useCallback, useRef, useState } from 'react';

import type { Page, PageParams } from '@/api/workoutApi';
import { showToast } from '@/components/toast';

export const PAGE_SIZE = 30;

/** Infinite-scroll list state: `reload()` fetches page one (call on focus/pull-to-refresh),
 * `loadMore()` fetches the next page (call from a list's `onEndReached`) — both fixed at
 * `PAGE_SIZE` items per page. `fetchPage` is expected to be a stable reference (every call site
 * passes a module-level function from `workoutApi.ts`, never an inline closure) — `busyRef`/
 * `cursorRef` are plain refs (not state) so `loadMore` always checks the latest values
 * synchronously instead of a stale closure over last render's state. */
export function usePaginatedList<T>(fetchPage: (params: PageParams) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const cursorRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const reload = useCallback(async () => {
    busyRef.current = true;
    setLoading(true);
    try {
      const page = await fetchPage({ limit: PAGE_SIZE });
      setItems(page.items);
      cursorRef.current = page.nextCursor;
      setHasMore(page.nextCursor !== null);
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (busyRef.current || !cursorRef.current) return;
    busyRef.current = true;
    setLoadingMore(true);
    fetchPage({ cursor: cursorRef.current, limit: PAGE_SIZE })
      .then((page) => {
        setItems((prev) => [...prev, ...page.items]);
        cursorRef.current = page.nextCursor;
        setHasMore(page.nextCursor !== null);
      })
      .catch(() => {
        showToast('Não foi possível carregar mais itens.', 'error');
      })
      .finally(() => {
        setLoadingMore(false);
        busyRef.current = false;
      });
  }, [fetchPage]);

  return { items, setItems, loading, loadingMore, hasMore, reload, loadMore };
}
