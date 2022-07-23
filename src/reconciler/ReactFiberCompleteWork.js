import {
  HostComponent,
  HostRoot,
  HostText,
  FunctionComponent,
  IndeterminateComponent,
} from "./ReactWorkTags";

import { Update } from "./ReactFiberFlags";

import {
  createInstance,
  appendInitialChild,
  finalizeInitialChildren,
  prepareUpdate,
  createTextInstance,
} from "./ReactDOMHostConfig";

const NoFlags = 0;
const StaticMask = 0;

function markUpdate(workInProgress) {
  workInProgress.flags |= Update;
}

export function completeWork(current, workInProgress) {
  const newProps = workInProgress.pendingProps;
  const type = workInProgress.type;
  switch (workInProgress.tag) {
    case IndeterminateComponent:
    case FunctionComponent:
    case HostRoot:
      bubbleProperties(workInProgress);
      return null;

    case HostText:
      const newText = newProps;
      if (current !== null && workInProgress.stateNode !== null) {
        const oldText = current.memoizedProps;
        updateHostText(current, workInProgress, oldText, newText);
      } else {
        workInProgress.stateNode = createTextInstance(newText, workInProgress);
      }
      bubbleProperties(workInProgress);
      return null;
    case HostComponent:
      if (current !== null && workInProgress.stateNode !== null) {
        updateHostComponent(current, workInProgress, type, newProps);
      } else {
        if (!newProps) {
          // This can happen when we abort work.
          bubbleProperties(workInProgress);
          return null;
        }

        const instance = createInstance(type, newProps, workInProgress);

        appendAllChildren(instance, workInProgress, false, false);
        workInProgress.stateNode = instance;
        if (finalizeInitialChildren(instance, type, newProps)) {
          markUpdate(workInProgress);
        }
      }
      bubbleProperties(workInProgress);
      return null;
  }
}

function appendAllChildren(parent, workInProgress) {
  let node = workInProgress.child;
  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node.stateNode);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === workInProgress) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function updateHostComponent(current, workInProgress, type, newProps) {
  // 如果有 alternate,这意味着是一个更新，我们需要安排一个副作用来做更新。
  const oldProps = current.memoizedProps;
  if (oldProps === newProps) {
    return;
  }

  // 如果我们更新是因为我们的一个子类更新了，我们没有newProps，所以我们必须重新使用它们。
  const instance = current.stateNode;
  const updatePayload = prepareUpdate(instance, type, oldProps, newProps);

  // 与 rootFiber 的 updateQueue (是一个对象)不一样
  workInProgress.updateQueue = updatePayload;
  if (updatePayload) {
    markUpdate(workInProgress);
  }
}

function updateHostText(current, workInProgress, oldText, newText) {
  // If the text differs, mark it as an update. All the work in done in commitWork.
  if (oldText !== newText) {
    markUpdate(workInProgress);
  }
}

// 将子 fiber 的 flags 收集到父 fiber 中，
function bubbleProperties(completedWork) {
  const didBailout =
    completedWork.alternate !== null &&
    completedWork.alternate.child === completedWork.child;

  let subtreeFlags = NoFlags;

  if (!didBailout) {
    // Bubble up the earliest expiration time.

    let child = completedWork.child;
    while (child !== null) {
      subtreeFlags |= child.subtreeFlags;
      subtreeFlags |= child.flags;

      child.return = completedWork;

      child = child.sibling;
    }

    completedWork.subtreeFlags |= subtreeFlags;
  } else {
    // Bubble up the earliest expiration time.
    let child = completedWork.child;
    while (child !== null) {
      subtreeFlags |= child.subtreeFlags & StaticMask;
      subtreeFlags |= child.flags & StaticMask;

      // Update the return pointer so the tree is consistent. This is a code
      // smell because it assumes the commit phase is never concurrent with
      // the render phase. Will address during refactor to alternate model.
      child.return = completedWork;

      child = child.sibling;
    }

    completedWork.subtreeFlags |= subtreeFlags;
  }

  return didBailout;
}
