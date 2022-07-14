import ReactSharedInternals from "../shared/ReactSharedInternals";

let currentlyRenderingFiber = null;
let didScheduleRenderPhaseUpdateDuringThisPass = false;
let didScheduleRenderPhaseUpdate = false;
let currentHook = null;
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

// const HooksDispatcherOnMount = {
//   useCallback: mountCallback,
//   useEffect: mountEffect,
//   useMemo: mountMemo,
//   useReducer: mountReducer,
//   useRef: mountRef,
//   useState: mountState,
// };

// const HooksDispatcherOnUpdate = {
//   useCallback: updateCallback,
//   useEffect: updateEffect,
//   useMemo: updateMemo,
//   useReducer: updateReducer,
//   useRef: updateRef,
//   useState: updateState,
// };

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
  // ReactCurrentDispatcher.current =
  //   current === null || current.memoizedState === null
  //     ? HooksDispatcherOnMount
  //     : HooksDispatcherOnUpdate;

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
  // ReactCurrentDispatcher.current = ContextOnlyDispatcher;

  // This check uses currentHook so that it works the same in DEV and prod bundles.
  // hookTypesDev could catch more cases (e.g. context) but only in DEV bundles.
  const didRenderTooFewHooks =
    currentHook !== null && currentHook.next !== null;

  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;

  didScheduleRenderPhaseUpdate = false;
  // This is reset by checkDidRenderIdHook
  // localIdCounter = 0;

  return children;
}

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

// function mountCallback(callback, deps) {
//   const hook = mountWorkInProgressHook();
//   const nextDeps = deps === undefined ? null : deps;
//   hook.memoizedState = [callback, nextDeps];
//   return callback;
// }

// function updateCallback(callback, deps) {
//   const hook = updateWorkInProgressHook();
//   const nextDeps = deps === undefined ? null : deps;
//   const prevState = hook.memoizedState;
//   if (prevState !== null) {
//     if (nextDeps !== null) {
//       const prevDeps = prevState[1];
//       if (areHookInputsEqual(nextDeps, prevDeps)) {
//         return prevState[0];
//       }
//     }
//   }
//   hook.memoizedState = [callback, nextDeps];
//   return callback;
// }

// function mountMemo(nextCreate, deps) {
//   const hook = mountWorkInProgressHook();
//   const nextDeps = deps === undefined ? null : deps;
//   const nextValue = nextCreate();
//   hook.memoizedState = [nextValue, nextDeps];
//   return nextValue;
// }

// function updateMemo(nextCreate, deps) {
//   const hook = updateWorkInProgressHook();
//   const nextDeps = deps === undefined ? null : deps;
//   const prevState = hook.memoizedState;
//   if (prevState !== null) {
//     // Assume these are defined. If they're not, areHookInputsEqual will warn.
//     if (nextDeps !== null) {
//       const prevDeps = prevState[1];
//       if (areHookInputsEqual(nextDeps, prevDeps)) {
//         return prevState[0];
//       }
//     }
//   }
//   const nextValue = nextCreate();
//   hook.memoizedState = [nextValue, nextDeps];
//   return nextValue;
// }
