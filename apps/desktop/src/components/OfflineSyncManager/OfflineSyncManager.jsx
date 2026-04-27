import { useEffect } from 'react';
import { useSyncQueueStore } from '@/store/syncQueueStore';
import { useConnectivityStore } from '@/store/connectivityStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function OfflineSyncManager() {
  const { 
    queue, 
    isSyncing, 
    setIsSyncing, 
    dequeue, 
    incrementRetry, 
    registerIdMapping,
    resolveUrl,
    resolveData
  } = useSyncQueueStore();

  const { hasInternet } = useConnectivityStore();

  useEffect(() => {
    // Attempt sync immediately if online and queue is populated
    if (hasInternet && queue.length > 0 && !isSyncing) {
      processQueue();
    }
  }, [hasInternet, queue.length, isSyncing]);

  const processQueue = async () => {
    // Only process if both internet and backend are reachable
    const { hasInternet, isBackendReachable } = useConnectivityStore.getState();
    if (!hasInternet || !isBackendReachable) return;

    setIsSyncing(true);
    
    // We snapshot the queue because elements might get pushed while this is running
    const allTasks = useSyncQueueStore.getState().queue;
    const now = Date.now();

    // Filter tasks that are ready for retry based on exponential backoff
    const tasks = allTasks.filter(item => !item.nextRetryAt || now >= item.nextRetryAt);
    
    if (tasks.length > 0) {
      toast.loading(`Syncing ${tasks.length} offline changes...`, { id: 'offline-sync' });
    } else {
      setIsSyncing(false);
      return;
    }

    let successCount = 0;
    
    for (const item of tasks) {
      try {
        // Resolve URLs and arbitrary object data against the ID map
        // This ensures if a parent was created offline, a child request hitting the
        // parent's endpoint receives the REAL _id, not the temporary UUID.
        const url = resolveUrl(item.url);
        const data = resolveData(item.data);

        const response = await api.request({
          method: item.method,
          url,
          data,
          // Custom flag to tell interceptor NOT to queue this retry if it fails
          disableOfflineMock: true 
        });

        // Smart ID mapping
        if (item.tempId && item.resourceType && response.data[item.resourceType]) {
          const realId = response.data[item.resourceType]._id;
          if (realId) {
             registerIdMapping(item.tempId, realId);
          }
        }

        dequeue(item.id);
        successCount++;
        
        // Small delay to prevent overwhelming the server with simultaneous offline bursts
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (err) {
        // If it's a 4xx error (e.g., validation failed, not found), we can't retry it infinitely.
        // It's a permanent failure. We discard it.
        if (err.response && err.response.status >= 400 && err.response.status < 500) {
          console.error('[OfflineSync] Task failed with 4xx, discarding:', item, err);
          dequeue(item.id);
        } else {
           // Network or 5xx error, increment retries
           if (item.retries >= 3) {
             console.error('[OfflineSync] Max retries reached, discarding:', item);
             dequeue(item.id);
           } else {
             incrementRetry(item.id);
           }
        }
      }
    }

    setIsSyncing(false);

    if (successCount > 0) {
       toast.success(`Synced ${successCount} changes.`, { id: 'offline-sync' });
    } else if (tasks.length > 0) {
       toast.dismiss('offline-sync');
    }
  };

  return null; // Headless component
}
