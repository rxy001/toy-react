import {
  HostRoot,
  HostComponent,
  HostPortal,
  HostText,
  FunctionComponent,
  MemoComponent,
} from "./ReactWorkTags";
import { Update, Placement } from "./ReactFiberFlags";
import { MutationMask } from "./ReactFiberFlags";
import { insertBefore, appendChild } from "./ReactDOMHostConfig";

/**
 *
 * @param {FiberRoot} root
 * @param {Fiber} finishedWork
 */
export function commitMutationEffects(root, finishedWork) {
  commitMutationEffectsOnFiber(finishedWork, root);
}

/**
 *
 * @param {Fiber} finishedWork
 * @param {FiberRoot} root
 */
function commitMutationEffectsOnFiber(finishedWork, root) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case FunctionComponent:
    case MemoComponent:
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);
    case HostRoot:
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);

      // if (flags & Update) {
      //   if (current !== null) {
      //     const prevRootState = current.memoizedState;
      //     if (prevRootState.isDehydrated) {
      //       // commitHydratedContainer(root.containerInfo);
      //     }
      //   }
      // }
      return;

    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);

      // if (flags & Ref) {
      //   if (current !== null) {
      //     safelyDetachRef(current, current.return);
      //   }
      // }
      // TODO: ContentReset gets cleared by the children during the commit
      // phase. This is a refactor hazard because it means we must read
      // flags the flags after `commitReconciliationEffects` has already run;
      // the order matters. We should refactor so that ContentReset does not
      // rely on mutating the flag during commit. Like by setting a flag
      // during the render phase instead.
      // if (finishedWork.flags & ContentReset) {
      //   const instance: Instance = finishedWork.stateNode;
      //   try {
      //     resetTextContent(instance);
      //   } catch (error) {
      //     captureCommitPhaseError(finishedWork, finishedWork.return, error);
      //   }
      // }

      // if (flags & Update) {
      //   const instance: Instance = finishedWork.stateNode;
      //   if (instance != null) {
      //     // Commit the work prepared earlier.
      //     const newProps = finishedWork.memoizedProps;
      //     // For hydration we reuse the update path but we treat the oldProps
      //     // as the newProps. The updatePayload will contain the real change in
      //     // this case.
      //     const oldProps = current !== null ? current.memoizedProps : newProps;
      //     const type = finishedWork.type;
      //     // TODO: Type the updateQueue to be specific to host components.
      //     const updatePayload: null | UpdatePayload =
      //       (finishedWork.updateQueue: any);
      //     finishedWork.updateQueue = null;
      //     if (updatePayload !== null) {
      //       try {
      //         commitUpdate(
      //           instance,
      //           updatePayload,
      //           type,
      //           oldProps,
      //           newProps,
      //           finishedWork
      //         );
      //       } catch (error) {
      //         captureCommitPhaseError(finishedWork, finishedWork.return, error);
      //       }
      //     }
      //   }
      // }
      return;
    }
  }
}

/**
 *
 * @param {FilberRoot} root
 * @param {Filber} finishedWork
 */
function recursivelyTraverseMutationEffects(root, parentFiber) {
  // const deletions = parentFiber.deletions;
  // if (deletions !== null) {
  //   for (let i = 0; i < deletions.length; i++) {
  //     const childToDelete = deletions[i];
  //     try {
  //       commitDeletionEffects(root, parentFiber, childToDelete);
  //     } catch (error) {
  //       captureCommitPhaseError(childToDelete, parentFiber, error);
  //     }
  //   }
  // }

  if (parentFiber.subtreeFlags & MutationMask) {
    let child = parentFiber.child;
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root);
      child = child.sibling;
    }
  }
}
function commitReconciliationEffects(finishedWork) {
  const flags = finishedWork.flags;

  if (flags & Placement) {
    commitPlacement(finishedWork);
    // Clear the "placement" from effect tag so that we know that this is
    // inserted, before any life-cycles like componentDidMount gets called.
    finishedWork.flags &= ~Placement;
  }
}

function commitPlacement(finishedWork) {
  // Recursively insert all host nodes into the parent.
  const parentFiber = getHostParentFiber(finishedWork);

  // Note: these two variables *must* always be updated together.
  switch (parentFiber.tag) {
    case HostComponent: {
      const parent = parentFiber.stateNode;

      const before = getHostSibling(finishedWork);
      // We only have the top Fiber that was inserted but we need to recurse down its
      // children to find all the terminal nodes.
      insertOrAppendPlacementNode(finishedWork, before, parent);
      break;
    }
    case HostRoot:
    case HostPortal: {
      const parent = parentFiber.stateNode.containerInfo;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
      break;
    }
    // eslint-disable-next-line-no-fallthrough
    default:
      throw new Error(
        "Invalid host parent fiber. This error is likely caused by a bug " +
          "in React. Please file an issue."
      );
  }
}

function getHostParentFiber(fiber) {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }
}

function isHostParent(fiber) {
  return (
    fiber.tag === HostComponent ||
    fiber.tag === HostRoot ||
    fiber.tag === HostPortal
  );
}

function getHostSibling(fiber) {
  // We're going to search forward into the tree until we find a sibling host
  // node. Unfortunately, if multiple insertions are done in a row we have to
  // search past them. This leads to exponential search for the next sibling.
  // TODO: Find a more efficient way to do this.
  let node = fiber;
  while (true) {
    // If we didn't find anything, let's try the next sibling.
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        // If we pop out of the root or hit the parent the fiber we are the
        // last sibling.
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    while (node.tag !== HostComponent && node.tag !== HostText) {
      // If it is not host node and, we might have a host node inside it.
      // Try to search down until we find one.
      if (node.flags & Placement) {
        // If we don't have a child, try the siblings instead.
        continue;
      }
      // If we don't have a child, try the siblings instead.
      // We also skip portals because they are not part of this host tree.
      if (node.child === null || node.tag === HostPortal) {
        continue;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    // Check if this host node is stable or about to be placed.
    if (!(node.flags & Placement)) {
      // Found it!
      return node.stateNode;
    }
  }
}

function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
  const { tag } = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else if (tag === HostPortal) {
    // If the insertion itself is a portal, then we don't want to traverse
    // down its children. Instead, we'll get insertions from each child in
    // the portal directly.
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNodeIntoContainer(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

function insertOrAppendPlacementNode(node, before, parent) {
  const { tag } = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else if (tag === HostPortal) {
    // If the insertion itself is a portal, then we don't want to traverse
    // down its children. Instead, we'll get insertions from each child in
    // the portal directly.
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}
