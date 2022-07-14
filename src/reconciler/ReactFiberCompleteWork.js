import {
  HostComponent,
  HostRoot,
  HostText,
  FunctionComponent,
  IndeterminateComponent,
} from "./ReactWorkTags";
import {
  createInstance,
  appendInitialChild,
  finalizeInitialChildren,
} from "./ReactDOMHostConfig";

const NoFlags = 0;
const StaticMask = 0;

export function completeWork(current, workInProgress) {
  const newProps = workInProgress.pendingProps;
  const type = workInProgress.type;
  switch (workInProgress.tag) {
    case IndeterminateComponent:
    case FunctionComponent:
    case HostRoot:
      bubbleProperties(workInProgress);
      return null;
    case HostComponent:
      if (current !== null && workInProgress.stateNode !== null) {
        updateHostComponent();
      } else {
        if (!newProps) {
          return null;
        }

        const instance = createInstance(type, newProps, workInProgress);

        appendAllChildren(instance, workInProgress, false, false);
        workInProgress.stateNode = instance;
        finalizeInitialChildren(instance, type, newProps);
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
    }
    //  else if (node.child !== null) {
    //   node.child.return = node;
    //   node = node.child;
    //   continue;
    // }
    // if (node === workInProgress) {
    //   return;
    // }
    // while (node.sibling === null) {
    //   if (node.return === null || node.return === workInProgress) {
    //     return;
    //   }
    //   node = node.return;
    // }
    // node.sibling.return = node.return;
    node = node.sibling;
  }
}

function updateHostComponent() {}

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
