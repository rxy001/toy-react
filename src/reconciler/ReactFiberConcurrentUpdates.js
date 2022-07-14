import { HostRoot } from "./ReactWorkTags";

let concurrentQueues = null;

/**
 *
 * @param {Fiber} fiber
 * @param {UpdateQueue.shared} queue
 * @param {Update} update
 * @returns {FiberRoot}
 */
export function enqueueConcurrentClassUpdate(fiber, queue, update) {
  const interleaved = queue.interleaved;
  if (interleaved === null) {
    // This is the first update. Create a circular list.
    update.next = update;
    // 在当前渲染结束时，这个队列的 interleaved 更新将被转移到挂起的队列
    pushConcurrentUpdateQueue(queue);
  } else {
    update.next = interleaved.next;
    interleaved.next = update;
  }
  queue.interleaved = update;

  return markUpdateLaneFromFiberToRoot(fiber);
}

export function pushConcurrentUpdateQueue(queue) {
  if (concurrentQueues === null) {
    concurrentQueues = [queue];
  } else {
    concurrentQueues.push(queue);
  }
}

/**
 *
 * @param {Fiber} sourceFiber
 * @returns {FiberRoot}
 */

function markUpdateLaneFromFiberToRoot(sourceFiber) {
  let node = sourceFiber;
  let parent = sourceFiber.return;
  while (parent !== null) {
    node = parent;
    parent = parent.return;
  }
  if (node.tag === HostRoot) {
    const root = node.stateNode;
    return root;
  } else {
    return null;
  }
}
