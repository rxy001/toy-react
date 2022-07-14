import { enqueueConcurrentClassUpdate } from "./ReactFiberConcurrentUpdates";

export function initializeUpdateQueue(fiber) {
  const queue = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
      interleaved: null,
    },
    effects: null,
  };
  fiber.updateQueue = queue;
}

export function createUpdate() {
  const update = {
    payload: null,
    callback: null,
    next: null,
  };
  return update;
}

export function enqueueUpdate(fiber, update) {
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) {
    // Only occurs if the fiber has been unmounted.
    return null;
  }

  return enqueueConcurrentClassUpdate(fiber, updateQueue.shared, update);
}
