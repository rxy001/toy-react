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

let workInProgress = null;

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
const RenderContext = /*                */ 0b010;
const CommitContext = /*                */ 0b100;

let executionContext = NoContext;
let workInProgressRoot = null;
const RootInProgress = 0;
const RootCompleted = 5;
let workInProgressRootExitStatus = RootInProgress;

export function scheduleUpdateOnFiber(root, fiber) {
  ensureRootIsScheduled(root, fiber);
}

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
  if (executionContext === NoContext) {
    // 现在清空同步工作，除非我们已经在工作或在批处理中。这是故意在 scheduleUpdateOnFiber
    // 内部而不是 scheduleCallbackForFiber 中，以保留可以调度回调而不立即启动它的能力。
    // 我们仅对用户发起的更新执行此操作，以保留旧模式的历史行为。
    flushSyncCallbacksOnlyInLegacyMode();
  }
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

    // The commit phase is broken into several sub-phases. We do a separate pass
    // of the effect list for each phase: all mutation effects come before all
    // layout effects, and so on.

    // "before mutation" phase：递归 fiber tree, 需要更新的 fiber 则会生成快照保存
    //  const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(
    //   root,
    //   finishedWork,
    // );
    commitMutationEffects(root, finishedWork);

    root.current = finishedWork;

    executionContext = prevExecutionContext;
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
