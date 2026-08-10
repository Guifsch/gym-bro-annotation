import { useEffect, useState } from 'react';

import { subscribeQueueSize } from '@/offline/queue';

export function useOfflineQueueSize(): number {
  const [size, setSize] = useState(0);

  useEffect(() => subscribeQueueSize(setSize), []);

  return size;
}
