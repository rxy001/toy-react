import { HostRoot } from "./ReactWorkTags";

let concurrentQueues = null;

// 将 iterleaved updates 添加到 pending updates 尾部 ，并重置 interleaved updates 为 null
export function finishQueueingConcurrentUpdates() {
  // 将 iterleaved updates 转移到 main queue。 每个队列都有一个 pending 字段和 interleaved 字段。
  // 当他们都不为 null 时， 他们的指针都指向环状链表的最后一个节点。我们需要将 interleaved 链表添加到
  // pending 链表的最后一个节点，形成一个环状链表。
  if (concurrentQueues !== null) {
    for (let i = 0; i < concurrentQueues.length; i++) {
      const queue = concurrentQueues[i];
      const lastInterleavedUpdate = queue.interleaved;
      if (lastInterleavedUpdate !== null) {
        queue.interleaved = null;
        const firstInterleavedUpdate = lastInterleavedUpdate.next;
        const lastPendingUpdate = queue.pending;
        if (lastPendingUpdate !== null) {
          const firstPendingUpdate = lastPendingUpdate.next;
          lastPendingUpdate.next = firstInterleavedUpdate;
          lastInterleavedUpdate.next = firstPendingUpdate;
        }
        queue.pending = lastInterleavedUpdate;
      }
    }
    concurrentQueues = null;
  }
}

/**
 * 存放 classComponent update
 * 通过 update.next，将所有 update 对象连接起来形成单向链表。
 * @param {Fiber} fiber
 * @param {UpdateQueue.shared} queue
 * @param {Update} update
 * @returns {FiberRoot}
 */
export function enqueueConcurrentClassUpdate(fiber, queue, update) {
  const interleaved = queue.interleaved;
  if (interleaved === null) {
    update.next = update;
    // 在当前渲染结束时，这个队列的 interleaved 更新将被转移到 pending 的队列
    pushConcurrentUpdateQueue(queue);
  } else {
    update.next = interleaved.next;
    interleaved.next = update;
  }
  queue.interleaved = update;

  return markUpdateLaneFromFiberToRoot(fiber);
}

// 存放 functionComponent update (useState)
export function enqueueConcurrentHookUpdate(fiber, queue, update) {
  const interleaved = queue.interleaved;
  if (interleaved === null) {
    update.next = update;
    // 在当前渲染结束时，这个队列的 interleaved 更新将被转移到 pending 的队列
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
