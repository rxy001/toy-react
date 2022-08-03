import { createWorkInProgress } from "./ReactFiber";
import { beginWork } from "./ReactFiberBeginWork";
import {
  scheduleLegacySyncCallback,
  scheduleSyncCallback,
  flushSyncCallbacks,
  flushSyncCallbacksOnlyInLegacyMode,
} from "./ReactFiberSyncTaskQueue";
import { completeWork } from "./ReactFiberCompleteWork";
import {
  BeforeMutationMask,
  MutationMask,
  LayoutMask,
  PassiveMask,
  NoFlags,
  Incomplete,
} from "./ReactFiberFlags";
import { LegacyRoot } from "../shared/ReactRootTags";
import { scheduleMicrotask } from "./ReactDOMHostConfig";
import { commitMutationEffects } from "./ReactFilberCommitWork";
import { finishQueueingConcurrentUpdates } from "./ReactFiberConcurrentUpdates";
import {
  commitPassiveUnmountEffects,
  commitPassiveMountEffects,
} from "./ReactFilberCommitWork";

let workInProgress = null;
let currentEventTime = null;

const now = performance.now;

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
const RenderContext = /*                */ 0b010;
const CommitContext = /*                */ 0b100;

let executionContext = NoContext;
let workInProgressRoot = null;
const RootInProgress = 0;
const RootCompleted = 5;
let workInProgressRootExitStatus = RootInProgress;

let rootWithPendingPassiveEffects = null;

let rootDoesHavePassiveEffects = false;

export function scheduleUpdateOnFiber(root, fiber) {
  ensureRootIsScheduled(root, fiber);

  // if (executionContext === NoContext) {
  //   // 现在清空同步工作，除非我们已经在工作或在批处理中。这是故意在 scheduleUpdateOnFiber
  //   // 内部而不是 scheduleCallbackForFiber 中，以保留可以调度回调而不立即启动它的能力。
  //   // 我们仅对用户发起的更新执行此操作，以保留旧模式的历史行为。
  //   flushSyncCallbacksOnlyInLegacyMode();
  // }
}

export function requestEventTime() {
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // We're inside React, so it's fine to read the actual time.
    return now();
  }
  // We're not inside React, so we may be in the middle of a browser event.
  return currentEventTime;
}

export function flushSync(fn) {
  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;

  try {
    if (fn) {
      return fn();
    } else {
      return undefined;
    }
  } finally {
    executionContext = prevExecutionContext;
    // Flush the immediate callbacks that were scheduled during this batch.
    // Note that this will happen even if batchedUpdates is higher up
    // the stack.
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
      flushSyncCallbacks();
    }
  }
}

// 使用此函数为根用户调度任务。 每个根只有一个任务;
// 如果一个任务已经被调度，我们将检查以确保现有任务的优先级与根操作所在的下一级任务的优先级相同。
// 在每次更新时以及退出任务之前都会调用此函数。
function ensureRootIsScheduled(root, fiber) {
  if (root.tag === LegacyRoot) {
    scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));
  } else {
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
  }

  scheduleMicrotask(() => {
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
      flushSyncCallbacks();
    }
  });
}

function performSyncWorkOnRoot(root) {
  let exitStatus = renderRootSync(root);

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;

  commitRoot(root);

  return null;
}

function renderRootSync(root) {
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;

  if (root !== workInProgress) {
    prepareFreshStack(root);
  }
  workLoopSync();

  workInProgressRoot = null;
  executionContext = prevExecutionContext;

  return workInProgressRootExitStatus;
}

function commitRoot(root) {
  commitRootImpl(root);
  return null;
}

function commitRootImpl(root) {
  // do {
  //   flushPassiveEffects();
  // } while (rootWithPendingPassiveEffects !== null);

  const finishedWork = root.finishedWork;
  root.finishedWork = null;

  // 判断 当前 RootFiber 包括其子孙 fiber 上是否有  pending passive effects
  // 如果有 pending passive effects， 调用个回调去处理他们。
  // 可能尽早的去做这个，因此在 commit phase 调度任何事情之前排队。
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;

      //NormalSchedulerPriority
      scheduleCallback(0, () => {
        // function component 会执行 useEffect
        flushPassiveEffects();
      });
    }
  }

  const subtreeHasEffects =
    (finishedWork.subtreeFlags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;
  const rootHasEffect =
    (finishedWork.flags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;

  if (subtreeHasEffects || rootHasEffect) {
    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;

    // 提交阶段分为几个子阶段。我们为每个阶段做了一个单独的副作用列表:
    // 所有的可修改的副作用出现在所有布局效果之前，以此类推

    // "before mutation" phase：递归 fiber tree, 需要更新的 fiber 则会生成快照保存
    //  const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(
    //   root,
    //   finishedWork,
    // );
    commitMutationEffects(root, finishedWork);

    root.current = finishedWork;

    executionContext = prevExecutionContext;
  }

  if (rootDoesHavePassiveEffects) {
    // 此提交具有副作用。保存对它们的引用。但不要在刷新布局工作之后才计划回调。
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
  }
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 采用深度优先算法递归 fiber tree.
function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate;

  // next === workInProgress.child
  let next = beginWork(current, unitOfWork);

  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function prepareFreshStack(root) {
  root.finishedWork = null;

  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;

  // 将新的 update 添加到 queue.pending 链表尾部
  finishQueueingConcurrentUpdates();

  return rootWorkInProgress;
}

function completeUnitOfWork(unitOfWork) {
  let completedWork = unitOfWork;
  do {
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;
    let next;
    if ((completedWork.flags & Incomplete) === NoFlags) {
      next = completeWork(current, completedWork);

      // 暂时无用
      if (next !== null) {
        // Completing this fiber spawned new work. Work on that next.
        workInProgress = next;
        return;
      }
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);

  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted;
  }
}

export function flushPassiveEffects() {
  // 将此检查与 flushPassiveEFfectsImpl 中的检查相结合。我们可能应该将这两个功能结合起来。
  // 我相信它们最初只是分开的，因为我们曾经用接受一个函数的 `Scheduler.runWithPriority` 包装它。
  // 但是现在我们在 React 本身中跟踪优先级，所以我们可以直接改变变量。
  if (rootWithPendingPassiveEffects !== null) {
    return flushPassiveEffectsImpl();
  }
  return false;
}

function flushPassiveEffectsImpl() {
  const root = rootWithPendingPassiveEffects;
  rootWithPendingPassiveEffects = null;

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error("Cannot flush passive effects while already rendering.");
  }

  const prevExecutionContext = executionContext;
  executionContext |= CommitContext;

  commitPassiveUnmountEffects(root.current);
  commitPassiveMountEffects(root, root.current);

  executionContext = prevExecutionContext;

  // effects 可能会产生新的 update, 将 performSyncWorkOnRoot 推进同步任务队列中。
  flushSyncCallbacks();

  return true;
}

function scheduleCallback(priorityLevel, callback) {
  // return Scheduler_scheduleCallback(priorityLevel, callback);
  requestAnimationFrame(callback);
}
