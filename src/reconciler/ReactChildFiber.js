import { REACT_ELEMENT_TYPE } from "../shared/ReactSymbols";
import { ChildDeletion, Placement } from "./ReactFiberFlags";
import {
  createFiberFromElement,
  createWorkInProgress,
  createFiberFromText,
} from "./ReactFiber";
import { HostText } from "./ReactWorkTags";

/* eslint-disable react-hooks/rules-of-hooks */
function ChildReconciler(shouldTrackSideEffects) {
  function deleteChild(returnFiber, childToDelete) {
    if (shouldTrackSideEffects) {
      const deletions = returnFiber.deletions;
      if (deletions === null) {
        returnFiber.deletions = [childToDelete];
        returnFiber.flags |= ChildDeletion;
      } else {
        deletions.push(childToDelete);
      }
    }
  }

  function deleteRemainingChildren(returnFiber, currentFirstChild) {
    if (shouldTrackSideEffects) {
      let childToDelete = currentFirstChild;
      while (childToDelete !== null) {
        deleteChild(returnFiber, childToDelete);
        childToDelete = childToDelete.sibling;
      }
      return null;
    }
    return null;
  }

  function useFiber(fiber, pendingProps) {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  function placeSingleChild(newFiber) {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement;
    }
    return newFiber;
  }

  function reconcileSingleElement(returnFiber, currentFirstChild, element) {
    let child = currentFirstChild;
    while (child !== null) {
      if (child.key === element.key) {
        if (child.type === element.type) {
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, element.props);
          existing.ref = element.ref;
          existing.return = returnFiber;
          return existing;
        }
        deleteRemainingChildren(returnFiber, child);
        break;
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }
    const created = createFiberFromElement(element, returnFiber.mode);
    created.ref = element.ref;
    created.return = returnFiber;
    return created;
  }

  function reconcileSingleTextNode(
    returnFiber,
    currentFirstChild,
    textContent
  ) {
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      const existing = useFiber(currentFirstChild, textContent);
      existing.return = returnFiber;
      return existing;
    }

    deleteRemainingChildren(returnFiber, currentFirstChild);
    const created = createFiberFromText(textContent);
    created.return = returnFiber;
    return created;
  }

  /**
   * 根据 current.child 和 workInProgress.reactElement 的key、type判读是否复用或创建新的子 fiber，
   * 并收集 side effect
   * @param {WorkInProgress} returnFiber
   * @param {Current.child} currentFirstChild
   * @param {ReactElement} newChild
   * @returns
   */
  return function reconcileChildFibers(
    returnFiber,
    currentFirstChild,
    newChild
  ) {
    // 如果顶级项是一个数组，我们将其视为一组子元素，而不是一个 fragment。
    // 另一方面，嵌套数组将被视为 fragment。 递归发生在正常的流程中。
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFirstChild, newChild)
          );
      }
    }
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFirstChild, "" + newChild)
      );
    }
    return null;
  };
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
