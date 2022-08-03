import {
  HostRoot,
  HostComponent,
  HostPortal,
  HostText,
  FunctionComponent,
  MemoComponent,
} from "./ReactWorkTags";
import { Update, Placement, ContentReset, Passive } from "./ReactFiberFlags";
import {
  MutationMask,
  ChildDeletion,
  NoFlags,
  PassiveMask,
} from "./ReactFiberFlags";
import {
  insertBefore,
  appendChild,
  commitUpdate,
  removeChild,
  removeChildFromContainer,
  resetTextContent,
  commitTextUpdate,
} from "./ReactDOMHostConfig";

import {
  Passive as HookPassive,
  HasEffect as HookHasEffect,
} from "./ReactHookEffectTags";

// 卸载节点时，递归 Fiber 子树并清除引用。每个级别都比前一个级别清理更多的 fiber 字段。
// 据我们所知，React 本身并没有泄漏，但由于 Fiber 包含循环，即使产品代码中的单个泄漏也会导致我们保留大量内存。
const deletedTreeCleanUpLevel = 3;
let hostParent = null;
let hostParentIsContainer = false;

let nextEffect = null;

/**
 * @param {FiberRoot} root
 * @param {Fiber} finishedWork
 */
export function commitMutationEffects(root, finishedWork) {
  commitMutationEffectsOnFiber(finishedWork, root);
}

/**
 * 挂载或更新或删除 fiber 上对应的真实 dom 节点
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
      return;
    case HostRoot:
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);
      return;
    case HostText:
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);
      if (flags & Update) {
        const textInstance = finishedWork.stateNode;
        const newText = finishedWork.memoizedProps;

        const oldText = current !== null ? current.memoizedProps : newText;

        commitTextUpdate(textInstance, oldText, newText);
      }
      return;
    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);

      if (finishedWork.flags & ContentReset) {
        const instance = finishedWork.stateNode;
        resetTextContent(instance);
      }

      if (flags & Update) {
        const instance = finishedWork.stateNode;
        if (instance != null) {
          const newProps = finishedWork.memoizedProps;

          const oldProps = current !== null ? current.memoizedProps : newProps;
          const type = finishedWork.type;
          const updatePayload = finishedWork.updateQueue;
          finishedWork.updateQueue = null;
          if (updatePayload !== null) {
            commitUpdate(
              instance,
              updatePayload,
              type,
              oldProps,
              newProps,
              finishedWork
            );
          }
        }
      }
      return;
    }
  }
}

// 深度优先算法递归遍历 fiber tree
function recursivelyTraverseMutationEffects(root, parentFiber) {
  const deletions = parentFiber.deletions;
  if (deletions !== null) {
    // 可以在任何 fiber 类型上调度 Deletions effects。它们需要在 children effects 触发之前发生。
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i];
      commitDeletionEffects(root, parentFiber, childToDelete);
    }
  }

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

function commitDeletionEffects(root, returnFiber, deletedFiber) {
  let parent = returnFiber;

  // 我们只删除了最上面的Fiber，但是我们需要递归它的子节点来找到所有的终节点.

  // 从父节点递归删除所有原生节点，拆分ref，清理已挂载的 layout effects，并调用componentWillUnmount。

  // 我们只需要移除每个分支中最上面的原生子节点。 但我们仍然需要继续遍历来卸载 effects refs cwu，

  // 在开始之前，找到堆栈中最近的 hostParent，这样我们就知道要从哪个实例/容器中移除子节点。
  findParent: while (parent !== null) {
    switch (parent.tag) {
      case HostComponent: {
        hostParent = parent.stateNode;
        hostParentIsContainer = false;
        break findParent;
      }
      case HostRoot: {
        hostParent = parent.stateNode.containerInfo;
        hostParentIsContainer = true;
        break findParent;
      }
      case HostPortal: {
        hostParent = parent.stateNode.containerInfo;
        hostParentIsContainer = true;
        break findParent;
      }
    }
    parent = parent.return;
  }

  commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);

  hostParent = null;
  hostParentIsContainer = false;

  detachFiberMutation(deletedFiber);
}

function recursivelyTraverseDeletionEffects(
  finishedRoot,
  nearestMountedAncestor,
  parent
) {
  let child = parent.child;
  while (child !== null) {
    commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, child);
    child = child.sibling;
  }
}

function commitDeletionEffectsOnFiber(
  finishedRoot,
  nearestMountedAncestor,
  deletedFiber
) {
  // 在遍历他们的子树之前，有些 case 会在外部 switch 修改栈。
  // 还有些更简单的例子在内部 switch 中，他们不会修改栈
  switch (deletedFiber.tag) {
    case HostComponent:
      safelyDetachRef(deletedFiber, nearestMountedAncestor);
    case HostText:
      // 我们只需要移除最近的 hostChild。 将栈的 hostParent 设置为' null '，表示不需要删除嵌套的子元素。
      const prevHostParent = hostParent;
      const prevHostParentIsContainer = hostParentIsContainer;
      hostParent = null;
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      );
      hostParent = prevHostParent;
      hostParentIsContainer = prevHostParentIsContainer;

      if (hostParent !== null) {
        // Now that all the child effects have unmounted, we can remove the
        // node from the tree.
        if (hostParentIsContainer) {
          removeChildFromContainer(hostParent, deletedFiber.stateNode);
        } else {
          removeChild(hostParent, deletedFiber.stateNode);
        }
      }
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

function safelyDetachRef(current, nearestMountedAncestor) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === "function") {
      ref(null);
    } else {
      ref.current = null;
    }
  }
}

export function commitPassiveUnmountEffects(firstChild) {
  nextEffect = firstChild;
  commitPassiveUnmountEffects_begin();
}

// 深度优先遍历，
// 1.先检查该 fiber 是否有删除的子 fiber,
// 2.有, 还是深度优先遍历其子 fiber, 调用 useState 的 destory，并清空 fiber fields。
// 3.没有，就继续遍历直至叶节点,调用 useState 的 destory，
// 4.通过 sibling 重复上述操作.
function commitPassiveUnmountEffects_begin() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const child = fiber.child;

    if ((nextEffect.flags & ChildDeletion) !== NoFlags) {
      const deletions = fiber.deletions;
      if (deletions !== null) {
        for (let i = 0; i < deletions.length; i++) {
          const fiberToDelete = deletions[i];
          nextEffect = fiberToDelete;
          commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
            fiberToDelete,
            fiber
          );
        }

        if (deletedTreeCleanUpLevel >= 1) {
          // A fiber was deleted from this parent fiber, but it's still part of
          // the previous (alternate) parent fiber's list of children. Because
          // children are a linked list, an earlier sibling that's still alive
          // will be connected to the deleted fiber via its `alternate`:
          //
          //   live fiber
          //   --alternate--> previous live fiber
          //   --sibling--> deleted fiber
          //
          // We can't disconnect `alternate` on nodes that haven't been deleted
          // yet, but we can disconnect the `sibling` and `child` pointers.
          const previousFiber = fiber.alternate;
          if (previousFiber !== null) {
            let detachedChild = previousFiber.child;
            if (detachedChild !== null) {
              previousFiber.child = null;
              do {
                const detachedSibling = detachedChild.sibling;
                detachedChild.sibling = null;
                detachedChild = detachedSibling;
              } while (detachedChild !== null);
            }
          }
        }

        nextEffect = fiber;
      }
    }

    if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffects_complete();
    }
  }
}

// 处理未删除的 fiber 的 useEffect
function commitPassiveUnmountEffects_complete() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    if ((fiber.flags & Passive) !== NoFlags) {
      commitPassiveUnmountOnFiber(fiber);
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

function commitPassiveUnmountOnFiber(finishedWork) {
  switch (finishedWork.tag) {
    case FunctionComponent:
      commitHookEffectListUnmount(
        HookPassive | HookHasEffect,
        finishedWork,
        finishedWork.return
      );
  }
}

function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
  deletedSubtreeRoot,
  nearestMountedAncestor
) {
  // first: nextEffect === deletedSubtreeRoot
  while (nextEffect !== null) {
    const fiber = nextEffect;

    // 被删除的 fiber 的 useEffect destory 在这调用
    // Deletion effects fire in parent -> child order
    commitPassiveUnmountInsideDeletedTreeOnFiber(fiber, nearestMountedAncestor);

    const child = fiber.child;

    if (child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
        deletedSubtreeRoot
      );
    }
  }
}

// 清空 fiber fields，断开链状结构
function commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
  deletedSubtreeRoot
) {
  // first: nextEffect 为 deletedSubtreeRoot 深度优先搜索的 第一个叶节点
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const sibling = fiber.sibling;
    const returnFiber = fiber.return;

    if (deletedTreeCleanUpLevel >= 2) {
      // Recursively traverse the entire deleted tree and clean up fiber fields.
      // This is more aggressive than ideal, and the long term goal is to only
      // have to detach the deleted tree at the root.
      detachFiberAfterEffects(fiber);
      if (fiber === deletedSubtreeRoot) {
        nextEffect = null;
        return;
      }
    }

    if (sibling !== null) {
      sibling.return = returnFiber;
      nextEffect = sibling;
      return;
    }

    nextEffect = returnFiber;
  }
}

function commitPassiveUnmountInsideDeletedTreeOnFiber(
  current,
  nearestMountedAncestor
) {
  switch (current.tag) {
    case FunctionComponent:
      commitHookEffectListUnmount(HookPassive, current, nearestMountedAncestor);
      break;
  }
}

function commitHookEffectListUnmount(
  flags,
  finishedWork,
  nearestMountedAncestor
) {
  const updateQueue = finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        // Unmount
        const destroy = effect.destroy;
        effect.destroy = undefined;
        if (destroy !== undefined) {
          safelyCallDestroy(finishedWork, nearestMountedAncestor, destroy);
        }
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

export function commitPassiveMountEffects(root, finishedWork) {
  nextEffect = finishedWork;
  commitPassiveMountEffects_begin(finishedWork, root);
}

function commitPassiveMountEffects_begin(subtreeRoot, root) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const firstChild = fiber.child;
    if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && firstChild !== null) {
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      commitPassiveMountEffects_complete(subtreeRoot, root);
    }
  }
}

function commitPassiveMountEffects_complete(subtreeRoot, root) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    if ((fiber.flags & Passive) !== NoFlags) {
      commitPassiveMountOnFiber(root, fiber);
    }

    if (fiber === subtreeRoot) {
      nextEffect = null;
      return;
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

function commitPassiveMountOnFiber(finishedRoot, finishedWork) {
  switch (finishedWork.tag) {
    case FunctionComponent: {
      commitHookEffectListMount(HookPassive | HookHasEffect, finishedWork);
      break;
    }
  }
}
function commitHookEffectListMount(flags, finishedWork) {
  const updateQueue = finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        // Mount
        const create = effect.create;
        effect.destroy = create();
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

function detachFiberAfterEffects(fiber) {
  const alternate = fiber.alternate;
  if (alternate !== null) {
    fiber.alternate = null;
    detachFiberAfterEffects(alternate);
  }

  // Note: Defensively using negation instead of < in case
  // `deletedTreeCleanUpLevel` is undefined.
  // Clear cyclical Fiber fields. This level alone is designed to roughly
  // approximate the planned Fiber refactor. In that world, `setState` will be
  // bound to a special "instance" object instead of a Fiber. The Instance
  // object will not have any of these fields. It will only be connected to
  // the fiber tree via a single link at the root. So if this level alone is
  // sufficient to fix memory issues, that bodes well for our plans.
  fiber.child = null;
  fiber.deletions = null;
  fiber.sibling = null;

  // The `stateNode` is cyclical because on host nodes it points to the host
  // tree, which has its own pointers to children, parents, and siblings.
  // The other host nodes also point back to fibers, so we should detach that
  // one, too.

  fiber.stateNode = null;

  // I'm intentionally not clearing the `return` field in this level. We
  // already disconnect the `return` pointer at the root of the deleted
  // subtree (in `detachFiberMutation`). Besides, `return` by itself is not
  // cyclical — it's only cyclical when combined with `child`, `sibling`, and
  // `alternate`. But we'll clear it in the next level anyway, just in case.

  if (deletedTreeCleanUpLevel >= 3) {
    // Theoretically, nothing in here should be necessary, because we already
    // disconnected the fiber from the tree. So even if something leaks this
    // particular fiber, it won't leak anything else
    //
    // The purpose of this branch is to be super aggressive so we can measure
    // if there's any difference in memory impact. If there is, that could
    // indicate a React leak we don't know about.
    fiber.return = null;
    fiber.dependencies = null;
    fiber.memoizedProps = null;
    fiber.memoizedState = null;
    fiber.pendingProps = null;
    fiber.stateNode = null;
    fiber.updateQueue = null;
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

// 向下搜索直到找到原生兄弟节点，
function getHostSibling(fiber) {
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

function safelyCallDestroy(current, nearestMountedAncestor, destroy) {
  destroy();
}

function detachFiberMutation(fiber) {
  // Cut off the return pointer to disconnect it from the tree.
  // This enables us to detect and warn against state updates on an unmounted component.
  // It also prevents events from bubbling from within disconnected components.
  // 切断返回指针以断开它与树的连接。 这使我们能够检测和警告已卸载组件上的状态更新。
  // 它还防止事件从已断开连接的组件中冒泡。

  // Ideally, we should also clear the child pointer of the parent alternate to let this
  // get GC:ed but we don't know which for sure which parent is the current
  // one so we'll settle for GC:ing the subtree of this child.
  // This child itself will be GC:ed when the parent updates the next time.
  // 事实上， 我们还应该把 parent.alternate 的 childPointer 也清空，进行gc。
  // 但是我们不能确定当前 parent 是哪一个。（ fiber 是 current tree 上的 ）,
  // 所以我们将对这个 child 的子树进行gc。
  // 当 parent 在下一次更新时，child 自身将会gc

  // Note that we can't clear child or sibling pointers yet.
  // They're needed for passive effects and for findDOMNode.
  // We defer those fields, and all other cleanup, to the passive phase (see detachFiberAfterEffects).
  // 注意，我们还不能清除子指针或兄弟指针。 它们需要用于 passive effects 和 findDOMNode。
  // 我们将这些字段和所有其他清理工作推迟到 passive phase (参见detachFiberAfterEffects)。

  // Don't reset the alternate yet, either. We need that so we can detach the
  // alternate's fields in the passive phase. Clearing the return pointer is
  // sufficient for findDOMNode semantics.
  // 也不要重置 alternate。 我们需要它，这样我们才能在 passive phase 拆分 alternate的字段。
  // 对于findDOMNode语义，清除返回指针就足够了。
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.return = null;
  }
  fiber.return = null;
}
