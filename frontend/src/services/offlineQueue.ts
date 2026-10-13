/**
 * ARIA Offline SOS & Retry Queue Service
 *
 * Ensures that emergency alerts are never falsely reported as delivered.
 * When connectivity fails or the backend is unreachable:
 * 1. Alerts are held in a persistent retry queue (localStorage + in-memory).
 * 2. Status is marked honestly as "NOT YET SENT" / "PENDING RETRY".
 * 3. Automatic background retry initiates upon network recovery ('online' event,
 *    health check recovery, or recurring backoff timer).
 * 4. User can also manually tap "Retry Now" or call 112 directly.
 */

import { incidentService } from './api';

export interface QueuedAlert {
  id: string;
  createdAt: number;
  triggerType: string;
  latitude: number | null;
  longitude: number | null;
  locationUnavailable: boolean;
  audioTranscript?: string;
  retryCount: number;
  lastAttemptAt?: number;
  lastError: string;
  status: 'pending' | 'retrying' | 'failed';
}

const STORAGE_KEY = 'aria_offline_sos_queue';

let listeners: Array<(queue: QueuedAlert[]) => void> = [];
let successListeners: Array<(incident: any, queuedAlert: QueuedAlert) => void> = [];
let isProcessingQueue = false;
let retryIntervalTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Load queued alerts from local storage.
 */
export function getQueuedAlerts(): QueuedAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('[OFFLINE_QUEUE] Failed to read from localStorage:', err);
    return [];
  }
}

/**
 * Save queued alerts to local storage and notify listeners.
 */
function saveQueuedAlerts(queue: QueuedAlert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    notifyListeners(queue);
  } catch (err) {
    console.error('[OFFLINE_QUEUE] Failed to save to localStorage:', err);
  }
}

function notifyListeners(queue: QueuedAlert[]): void {
  listeners.forEach((fn) => {
    try {
      fn(queue);
    } catch (e) {
      console.error('[OFFLINE_QUEUE] Error in listener callback:', e);
    }
  });
}

/**
 * Subscribe to changes in the offline retry queue.
 */
export function subscribeToQueue(listener: (queue: QueuedAlert[]) => void): () => void {
  listeners.push(listener);
  // Emit current state immediately
  listener(getQueuedAlerts());
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Subscribe to successful delivery events when a queued alert finally lands.
 */
export function onQueuedAlertDelivered(
  listener: (incident: any, queuedAlert: QueuedAlert) => void
): () => void {
  successListeners.push(listener);
  return () => {
    successListeners = successListeners.filter((l) => l !== listener);
  };
}

/**
 * Enqueue a failed emergency SOS alert.
 */
export function enqueueAlert(params: {
  triggerType: string;
  latitude: number | null;
  longitude: number | null;
  locationUnavailable: boolean;
  audioTranscript?: string;
  error?: string;
}): QueuedAlert {
  const queue = getQueuedAlerts();
  const newAlert: QueuedAlert = {
    id: 'queued_sos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    createdAt: Date.now(),
    triggerType: params.triggerType,
    latitude: params.latitude,
    longitude: params.longitude,
    locationUnavailable: params.locationUnavailable,
    audioTranscript: params.audioTranscript,
    retryCount: 0,
    lastAttemptAt: Date.now(),
    lastError: params.error || 'Network error or emergency server unreachable',
    status: 'pending',
  };

  const updatedQueue = [newAlert, ...queue];
  saveQueuedAlerts(updatedQueue);
  startAutoRetryLoop();
  return newAlert;
}

/**
 * Remove an alert from the queue (e.g. cancelled by user or successfully resolved).
 */
export function removeQueuedAlert(id: string): void {
  const queue = getQueuedAlerts().filter((item) => item.id !== id);
  saveQueuedAlerts(queue);
}

/**
 * Clear the entire offline queue.
 */
export function clearQueuedAlerts(): void {
  saveQueuedAlerts([]);
}

/**
 * Update an existing alert in the queue.
 */
export function updateQueuedAlert(id: string, updates: Partial<QueuedAlert>): void {
  const queue = getQueuedAlerts().map((item) => {
    if (item.id === id) {
      return { ...item, ...updates };
    }
    return item;
  });
  saveQueuedAlerts(queue);
}

/**
 * Process the offline retry queue, attempting to resend pending alerts.
 */
export async function processRetryQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (isProcessingQueue) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const currentQueue = getQueuedAlerts();
  if (currentQueue.length === 0) {
    stopAutoRetryLoop();
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  isProcessingQueue = true;
  let succeeded = 0;
  let failed = 0;

  try {
    for (const alertItem of currentQueue) {
      // Mark as retrying
      updateQueuedAlert(alertItem.id, {
        status: 'retrying',
        lastAttemptAt: Date.now(),
      });

      const formData = new FormData();
      formData.append('latitude', (alertItem.latitude ?? 0).toString());
      formData.append('longitude', (alertItem.longitude ?? 0).toString());
      formData.append('location_unavailable', String(alertItem.locationUnavailable));
      formData.append('triggerType', alertItem.triggerType);
      if (alertItem.audioTranscript) {
        formData.append('audioTranscript', alertItem.audioTranscript);
      }

      try {
        const res = await incidentService.create(formData);
        if (res.data && res.data.success && res.data.incident) {
          console.log('[OFFLINE_QUEUE] Alert successfully sent to server:', res.data.incident.id);
          succeeded++;
          // Remove from queue
          removeQueuedAlert(alertItem.id);
          // Notify success listeners
          successListeners.forEach((fn) => {
            try {
              fn(res.data.incident, alertItem);
            } catch (e) {
              console.error('[OFFLINE_QUEUE] Error in success callback:', e);
            }
          });
        } else {
          throw new Error(res.data?.message || 'Server returned unsuccessful response');
        }
      } catch (err: any) {
        failed++;
        const errorMessage =
          err?.response?.data?.message ||
          (err?.code === 'ERR_NETWORK' || !navigator.onLine
            ? 'No internet connection. Device is offline.'
            : err?.message || 'Failed to deliver incident alert to server');

        console.warn(`[OFFLINE_QUEUE] Retry failed for alert ${alertItem.id}:`, errorMessage);

        updateQueuedAlert(alertItem.id, {
          status: 'failed',
          retryCount: alertItem.retryCount + 1,
          lastError: errorMessage,
          lastAttemptAt: Date.now(),
        });
      }
    }
  } finally {
    isProcessingQueue = false;
  }

  return { processed: currentQueue.length, succeeded, failed };
}

/**
 * Start recurring background retry interval while items exist.
 */
export function startAutoRetryLoop(): void {
  if (retryIntervalTimer) return;
  // Check every 8 seconds if there are pending alerts
  retryIntervalTimer = setInterval(() => {
    const queue = getQueuedAlerts();
    if (queue.length === 0) {
      stopAutoRetryLoop();
      return;
    }
    // Only attempt if browser considers itself online
    if (navigator.onLine) {
      processRetryQueue();
    }
  }, 8000);
}

export function stopAutoRetryLoop(): void {
  if (retryIntervalTimer) {
    clearInterval(retryIntervalTimer);
    retryIntervalTimer = null;
  }
}

// ── Initialize Global Window Event Listeners ─────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OFFLINE_QUEUE] Network online detected — immediately retrying pending alerts.');
    processRetryQueue();
  });

  // Start retry loop on initial load if queue has items
  if (getQueuedAlerts().length > 0) {
    startAutoRetryLoop();
  }
}
