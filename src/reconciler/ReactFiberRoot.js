import { initializeUpdateQueue } from "./ReactFiberClassUpdateQueue";
import { createHostRootFiber } from "./ReactFiber";

function FiberRootNode(containerInfo, tag) {
  this.tag = tag;
  this.containerInfo = containerInfo;
  this.pendingChildren = null;
  this.current = null;
  this.pingCache = null;
  this.finishedWork = null;
  this.context = null;
}

export function creatFiberRoot(container, tag, initialChildren = null) {
  const root = new FiberRootNode(container, tag);

  const uninitializedFiber = createHostRootFiber(tag);

  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  uninitializedFiber.memoizedState = {
    element: initialChildren,
  };

  initializeUpdateQueue(uninitializedFiber);

  return root;
}
