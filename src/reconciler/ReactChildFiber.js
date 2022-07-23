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

  function updateTextNode(returnFiber, current, textContent) {
    if (current === null || current.tag !== HostText) {
      // Insert
      const created = createFiberFromText(textContent);
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, textContent);
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateElement(returnFiber, current, element) {
    const elementType = element.type;

    if (current !== null) {
      if (elementType === current.elementType) {
        const existing = useFiber(current, element.props);
        existing.return = returnFiber;
        return existing;
      }
    }
    const created = createFiberFromElement(element);
    created.return = returnFiber;
    return created;
  }

  function updateSolt(returnFiber, oldFiber, newChild) {
    // 如果两个 key 值相同，则更新fiber, 否则返回 null
    const key = oldFiber !== null ? oldFiber.key : null;
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      // 文本节点没有 key,  如果之前的节点是隐式的key(null)，我们将继续替换它而非中止， 即使它不是一个文本节点

      // oldFiber 存在且 key 不为 null 时返回 null
      if (key !== null) {
        return null;
      }
      return updateTextNode(returnFiber, oldFiber, "" + newChild);
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          if (newChild.key === key) {
            return updateElement(returnFiber, oldFiber, newChild);
          } else {
            return null;
          }
        }
      }
    }
    return null;
  }

  function placeChild(newFiber, lastPlacedIndex, newIndex) {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      return lastPlacedIndex;
    }
    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // This is a move.
        newFiber.flags |= Placement;
        return lastPlacedIndex;
      } else {
        // This item can stay in place.
        return oldIndex;
      }
    } else {
      // This is an insertion.
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    }
  }

  function createChild(returnFiber, newChild) {
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      const created = createFiberFromText("" + newChild);
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(newChild);
          created.return = returnFiber;
          return created;
        }
      }
    }
    return null;
  }

  function mapRemainingChildren(returnFiber, currentFirstChild) {
    // 添加剩余的子元素到临时的 map， 所以我们能通过 key 快速找到他们。
    // 隐式的 key(null) 会用 index 代替添加到集合中。
    const existingChildren = new Map();

    let existingChild = currentFirstChild;
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild);
      } else {
        existingChildren.set(existingChild.index, existingChild);
      }
      existingChild = existingChild.sibling;
    }
    return existingChildren;
  }

  function updateFromMap(existingChildren, returnFiber, newIdx, newChild) {
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      // 文本节点没有 key, 所以我们不需要去检查新旧节点的 key， 如果他们都是文本节点，就匹配上了。
      const matchedFiber = existingChildren.get(newIdx) || null;
      return updateTextNode(returnFiber, matchedFiber, "" + newChild);
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key
            ) || null;
          return updateElement(returnFiber, matchedFiber, newChild);
        }
      }
    }

    return null;
  }

  /**
   * react在处理元素移动的情况, 通过在 placeChild 函数中，对比 oldFiber.index 与 lastPlacedIndex
   * 判断元素是否发生移动。该算法不能通过从两端搜索来优化，因为在 fiber 上没有反向指针。
   *
   * 如果 oldFiber.index < lastPlacedIndex 则需要移动该元素。例如
   * 0 -> 1 -> 2
   * 1 -> 2 -> 3 -> 0
   * 第一次循环： lastPlacedIndex 为0，元素1 oldFiber.index 为1，即元素1不移动， 返回 oldFiber.index
   * 第二次循环： lastPlacedIndex 为1，元素2 oldFiber.index 为2，即元素2不移动，返回 oldFiber.index
   * 第三次循环： lastPlacedIndex 为2，没有对应的元素3，插入该元素并返回 lastPlacedIndex（2）
   * 第四次循环： lastPlacedIndex 为2，元素0 oldFiber.index 为0，即元素0移动，返回 lastPlacedIndex
   */
  function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren) {
    let resultingFirstChild = null;
    let previousNewFiber = null;

    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;

    // 遍历新数组， 当新数组中的某个元素与同位置的老元素 key 不相同时跳出循环。
    // 当 key 相同时， elementType 相同会复用老 fiber, elementType 不相同会创建新 fiber。
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      // TODO: 什么情况下 oldFiber.index 会大于 newIdx ??????????
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      const newFiber = updateSolt(returnFiber, oldFiber, newChildren[newIdx]);

      if (newFiber === null) {
        if (oldFiber === null) {
          oldFiber = nextOldFiber;
        }
        break;
      }

      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // 存在老 fiber, 但是没有复用，则删除老 fiber
          deleteChild(returnFiber, oldFiber);
        }
      }

      // 返回 newFiber 在列表中的位置，这里不会发生移动的情况。
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    // 当新数组完全遍历结束后， 删除多余的老 fiber
    if (newIdx === newChildren.length) {
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    // 在没有发生移动的情况下，处理新增的 reactElement
    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx]);
        if (newFiber === null) {
          continue;
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      return resultingFirstChild;
    }

    // 将剩余的老 fiber 添加到 map 中
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

    // 处理剩余的 newChildren，如果在 existingChildren 中通过 key 或 index 找到对应的老 fiber
    // 就复用，并将它从 existingChildren 删除， 否则就新创建新 fiber.
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx]
      );
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            // newFiber.alternate 存在意味着复用了老 fiber, 所以将它从 map 中删除，
            // 但不需要将它添加到 deletion 列表中。
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key
            );
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    if (shouldTrackSideEffects) {
      // 上面没有被匹配到的所有现有的child都被删除。 我们需要将它们添加到删除列表中。
      existingChildren.forEach((child) => deleteChild(returnFiber, child));
    }

    return resultingFirstChild;
  }

  /**
   * 根据 current.child 和 workInProgress.reactElement 的 key 和 type
   * 判读是否复用或创建新的子 fiber，并收集 side effect
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

    if (Array.isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild);
    }

    return null;
  };
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
