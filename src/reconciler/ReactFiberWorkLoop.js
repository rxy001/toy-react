import { createWorkInProgress } from "./ReactFiber";
import { beginWork } from "./ReactFiberBeginWork";
import {
  scheduleLegacySyncCallback,
  scheduleSyncCallback,
  flushSyncCallbacks,
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
  ensureRootIsScheduled(root);
}

function renderRootSync(root) {
  if (root !== workInProgress) {
    prepareFreshStack(root);
  }
  workLoopSync();

  workInProgressRoot = null;

  return workInProgressRootExitStatus;
}

function performSyncWorkOnRoot(root) {
  let exitStatus = renderRootSync(root);

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;

  commitRoot(root);
  return null;
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

    // "before mutation" phase：递归 fiber tree, 需要更新的 fiber 则生成快照保存
    //  const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(
    //   root,
    //   finishedWork,
    // );

    commitMutationEffects(root, finishedWork);

    root.current = finishedWork;
  }
}

function ensureRootIsScheduled(root) {
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

function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate;

  // next === workInProgress.child
  let next = beginWork(current, unitOfWork);

  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    console.log(unitOfWork);
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function workLoopSync() {
  // Already timed out, so perform work without checking if we need to yield.
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function prepareFreshStack(root) {
  root.finishedWork = null;

  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;

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
