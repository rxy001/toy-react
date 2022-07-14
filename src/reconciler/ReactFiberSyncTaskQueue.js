let includesLegacySyncCallbacks = false;
let syncQueue = null;
let isFlushingSyncQueue = false;

export function scheduleSyncCallback(callback) {
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

export function scheduleLegacySyncCallback(callback) {
  includesLegacySyncCallbacks = true;
  scheduleSyncCallback(callback);
}

export function flushSyncCallbacksOnlyInLegacyMode() {
  if (includesLegacySyncCallbacks) {
    flushSyncCallbacks();
  }
}

export function flushSyncCallbacks() {
  if (!isFlushingSyncQueue && syncQueue !== null) {
    // Prevent re-entrance.
    isFlushingSyncQueue = true;
    let i = 0;
    try {
      const isSync = true;
      const queue = syncQueue;
      for (; i < queue.length; i++) {
        let callback = queue[i];
        do {
          callback = callback(isSync);
        } while (callback !== null);
      }
      syncQueue = null;
      includesLegacySyncCallbacks = false;
    } catch (error) {
      // If something throws, leave the remaining callbacks on the queue.
      // if (syncQueue !== null) {
      //   syncQueue = syncQueue.slice(i + 1);
      // }
      // // Resume flushing in the next tick
      // scheduleCallback(ImmediatePriority, flushSyncCallbacks);
      throw error;
    } finally {
      isFlushingSyncQueue = false;
    }
  }
  return null;
}
