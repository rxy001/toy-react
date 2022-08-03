import ReactSharedInternals from "../shared/ReactSharedInternals";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";
import { enqueueConcurrentHookUpdate } from "./ReactFiberConcurrentUpdates";
import { markWorkInProgressReceivedUpdate } from "./ReactFiberBeginWork";
import {
  Passive as PassiveEffect,
  PassiveStatic as PassiveStaticEffect,
} from "./ReactFiberFlags";
import {
  Passive as HookPassive,
  HasEffect as HookHasEffect,
} from "./ReactHookEffectTags";

// workInProgress fiber 。将它命名为不同的名称，以将其与 workInProgress fiber 区分开来。
let currentlyRenderingFiber = null;
let didScheduleRenderPhaseUpdateDuringThisPass = false;
let didScheduleRenderPhaseUpdate = false;

// hooks 以链表的形式保存在 fiber.memoizedState 字段中。current hook 链表 是属于 current fiber,
// work-in-progress hook 链表是一个新的链表，将添加到 work-in-progress fiber
// currentHook: 上一个 hook （eg: useState) 所对应的 current fiber 上 hook 对象。
let currentHook = null;

// workInProgressHook: 上一个 hooks 所使用的最新 hook 对象，
// 通过 workInProgressHook.next 形成新的 hook 链表。
let workInProgressHook = null;

const { ReactCurrentDispatcher, ReactCurrentBatchConfig } =
  ReactSharedInternals;

export const ContextOnlyDispatcher = {
  useCallback: throwInvalidHookError,
  useContext: throwInvalidHookError,
  useEffect: throwInvalidHookError,
  useImperativeHandle: throwInvalidHookError,
  useInsertionEffect: throwInvalidHookError,
  useLayoutEffect: throwInvalidHookError,
  useMemo: throwInvalidHookError,
  useReducer: throwInvalidHookError,
  useRef: throwInvalidHookError,
  useState: throwInvalidHookError,
  useDebugValue: throwInvalidHookError,
  useDeferredValue: throwInvalidHookError,
  useTransition: throwInvalidHookError,
  useMutableSource: throwInvalidHookError,
  useSyncExternalStore: throwInvalidHookError,
  useId: throwInvalidHookError,
};

const HooksDispatcherOnMount = {
  useState: mountState,
  useReducer: mountReducer,
  useEffect: mountEffect,
};

const HooksDispatcherOnUpdate = {
  useEffect: updateEffect,
  useReducer: updateReducer,
  useState: updateState,
};

// 只有函数式组件才能使用 hooks, 通过 ReactCurrentDispatcher.current 来获取对应的 hooks 方法。
// react 库只是保存了一个 ReactCurrentDispatcher.current 的引用
export function renderWithHooks(
  current,
  workInProgress,
  Component,
  props,
  secondArg
) {
  currentlyRenderingFiber = workInProgress;

  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;

  // 使用 memoizedState 来区分挂载/更新,只有在使用了至少一个有状态钩子的情况下才有效。
  // 非状态的钩子(例如context)不会被添加到 memoizedState，所以 memoizedState 在更新和挂载期间将为空。
  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;

  let children = Component(props, secondArg);

  // Check if there was a render phase update
  // if (didScheduleRenderPhaseUpdateDuringThisPass) {
  //   // Keep rendering in a loop for as long as render phase updates continue to
  //   // be scheduled. Use a counter to prevent infinite loops.
  //   let numberOfReRenders = 0;
  //   do {
  //     didScheduleRenderPhaseUpdateDuringThisPass = false;
  //     localIdCounter = 0;

  //     if (numberOfReRenders >= RE_RENDER_LIMIT) {
  //       throw new Error(
  //         "Too many re-renders. React limits the number of renders to prevent " +
  //           "an infinite loop."
  //       );
  //     }

  //     numberOfReRenders += 1;

  //     // Start over from the beginning of the list
  //     currentHook = null;
  //     workInProgressHook = null;

  //     workInProgress.updateQueue = null;

  //     if (__DEV__) {
  //       // Also validate hook order for cascading updates.
  //       hookTypesUpdateIndexDev = -1;
  //     }

  //     ReactCurrentDispatcher.current = __DEV__
  //       ? HooksDispatcherOnRerenderInDEV
  //       : HooksDispatcherOnRerender;

  //     children = Component(props, secondArg);
  //   } while (didScheduleRenderPhaseUpdateDuringThisPass);
  // }

  // We can assume the previous dispatcher is always this one, since we set it
  // at the beginning of the render phase and there's no re-entrance.
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;

  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;

  return children;
}

function basicStateReducer(s, a) {
  return typeof a === "function" ? a(s) : a;
}

// useState 的 memoizedState 是个值.
function mountState(initialState) {
  // 将 hook 挂载到当前 fiber 的 memoizedState。
  const hook = mountWorkInProgressHook();

  hook.memoizedState = hook.baseState = initialState;

  const queue = {
    pending: null,
    interleaved: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };

  hook.queue = queue;

  const dispatch = (queue.dispatch = dispatchSetState.bind(
    null,
    currentlyRenderingFiber,
    queue
  ));

  return [hook.memoizedState, dispatch];
}

function updateState(initialState) {
  return updateReducer(basicStateReducer, initialState);
}

// 创建 update ，如果新的状态与当前的状态相同，或许可以完全跳过。
// 否则就将 update 放入更新队列中。
function dispatchSetState(fiber, queue, action) {
  const update = {
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  if (isRenderPhaseUpdate()) {
    // todo
  } else {
    const alternate = fiber.alternate;
    // if (
    //   fiber.lanes === NoLanes &&
    //   (alternate === null || alternate.lanes === NoLanes)
    // )
    // 队列目前是空的，这意味着我们可以在进入渲染阶段之前急切地计算下一个状态。
    // 如果新的状态与当前的状态相同，我们或许可以完全跳过。
    const lastRenderedReducer = queue.lastRenderedReducer;
    if (lastRenderedReducer !== null) {
      const currentState = queue.lastRenderedState;
      const eagerState = lastRenderedReducer(currentState, action);

      // 将急切计算的状态和用于计算它的 reducer 存储在更新对象上。 如果在我们进入渲染阶段的时候 reducer
      // 还没有改变，那么就可以使用 eager 状态而无需再次调用reducer。
      update.hasEagerState = true;
      update.eagerState = eagerState;
      if (Object.is(eagerState, currentState)) {
        // 我们可以跳过调度 react 的重新渲染。 如果组件由于不同的原因重新渲染
        // 并且到那时 reducer 已经更改，我们仍然可能需要稍后重新调整此更新。
        // enqueueConcurrentHookUpdateAndEagerlyBailout(
        //   fiber,
        //   queue,
        //   update,
        //   lane
        // );
        return;
      }
    }

    const root = enqueueConcurrentHookUpdate(fiber, queue, update);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber);
    }
  }
}

function mountEffect(create, deps) {
  return mountEffectImpl(
    PassiveEffect | PassiveStaticEffect,
    HookPassive,
    create,
    deps
  );
}

function updateEffect(initialState) {}

// useEffect 的 memoizedState 是个 effect 对象.
function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    undefined,
    nextDeps
  );
}

function pushEffect(tag, create, destroy, deps) {
  const effect = {
    tag,
    create,
    destroy,
    deps,
    // Circular
    next: null,
  };
  let componentUpdateQueue = currentlyRenderingFiber.updateQueue;
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber.updateQueue = componentUpdateQueue;
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }
  return effect;
}

function mountReducer(initialState) {}

// 创建新的 hook 链表，遍历 update queue， 更新 hook 对象的 memoizedState。
function updateReducer(reducer, initial, init) {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  queue.lastRenderedReducer = reducer;

  const current = currentHook;

  // The last rebase update that is NOT part of the base state.
  // baseQueue. baseState 在 legacy mode 中是无用的。可暂时忽略
  let baseQueue = current.baseQueue;

  // The last pending update that hasn't been processed yet.
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    // 我们还有没处理的新的更新，将他们添加到 base queue
    if (baseQueue !== null) {
      // 合并 pengding queue 和 base queue,
      // 合并之后， base queue 和 pending queue 的链表是相同的， 但是指针指向的节点是不同。
      // base queue 指向链表的中间节点： baseQueue.next === pendingFirst，
      // pending queue 指向链表的末尾节点： pendingQueue.next === baseFirst;
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  if (baseQueue !== null) {
    // We have a queue to process.
    const first = baseQueue.next;
    let newState = current.baseState;

    // let newBaseState = null;
    // let newBaseQueueFirst = null;
    // let newBaseQueueLast = null;
    let update = first;
    do {
      // Process this update.
      if (update.hasEagerState) {
        // If this update is a state update (not a reducer) and was processed eagerly,
        // we can use the eagerly computed state
        newState = update.eagerState;
      } else {
        const action = update.action;
        newState = reducer(newState, action);
      }
      // }
      update = update.next;
    } while (update !== null && update !== first);

    // if (newBaseQueueLast === null) {
    //   newBaseState = newState;
    // } else {
    //   newBaseQueueLast.next = newBaseQueueFirst;
    // }

    // Mark that the fiber performed work, but only if the new state is
    // different from the current state.
    if (!Object.is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate();
    }

    hook.memoizedState = newState;
    // hook.baseState = newBaseState;
    // hook.baseQueue = newBaseQueueLast;
    queue.lastRenderedState = newState;
  }

  const dispatch = queue.dispatch;
  return [hook.memoizedState, dispatch];
}

// 创建 hook 挂载到 currentlyRenderingFiber.memoizedState。
// 当多次调用相同的 hooks (eg: useState) ，通过 hook.next 形成单向链表。
function mountWorkInProgressHook() {
  const hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };

  if (workInProgressHook === null) {
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}

// 通过 current fiber 上 hook 链表，形成新的 hook 链表。
function updateWorkInProgressHook() {
  // 此函数用于更新和由渲染阶段更新触发的重新渲染。它假设有一个我们可以克隆的当前钩子，
  // 或者我们可以使用之前渲染过程中的 workInProgressHook 为基础。
  // 当我们到达基本列表的末尾时，我们必须切换到用于挂载的调度程序。

  // nextCurrentHook: 当前 hooks （eg: useState) 所对应的 current fiber 上 hook 对象。
  let nextCurrentHook = null;
  if (currentHook === null) {
    const current = currentlyRenderingFiber.alternate;
    if (current !== null) {
      nextCurrentHook = current.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    nextCurrentHook = currentHook.next;
  }

  let nextWorkInProgressHook = null;
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber.memoizedState;
  } else {
    nextWorkInProgressHook = workInProgressHook.next;
  }

  // 什么情况下 nextWorkInProgressHook !== null ?
  // 渲染阶段的更新
  if (nextWorkInProgressHook !== null) {
    // There's already a work-in-progress. Reuse it.
    workInProgressHook = nextWorkInProgressHook;
    nextWorkInProgressHook = workInProgressHook.next;

    currentHook = nextCurrentHook;
  } else {
    // Clone from the current hook.
    if (nextCurrentHook === null) {
      throw new Error("Rendered more hooks than during the previous render.");
    }

    currentHook = nextCurrentHook;

    const newHook = {
      memoizedState: currentHook.memoizedState,

      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,

      next: null,
    };

    if (workInProgressHook === null) {
      // This is the first hook in the list.
      currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
    } else {
      // Append to the end of the list.
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }
  return workInProgressHook;
}

function createFunctionComponentUpdateQueue() {
  return {
    lastEffect: null,
    stores: null,
  };
}

function isRenderPhaseUpdate() {}

function throwInvalidHookError() {
  throw new Error(
    "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for" +
      " one of the following reasons:\n" +
      "1. You might have mismatching versions of React and the renderer (such as React DOM)\n" +
      "2. You might be breaking the Rules of Hooks\n" +
      "3. You might have more than one copy of React in the same app\n" +
      "See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem."
  );
}
