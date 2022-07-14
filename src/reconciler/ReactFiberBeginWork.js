import { HostRoot } from "./ReactWorkTags";
import { mountChildFibers, reconcileChildFibers } from "./ReactChildFiber";
import {
  FunctionComponent,
  IndeterminateComponent,
  HostComponent,
} from "./ReactWorkTags";
import { ContentReset } from "./ReactFiberFlags";
import { renderWithHooks } from "./ReactFiberHooks";
import { shouldSetTextContent } from "./ReactDOMHostConfig";

export function beginWork(current, workInProgress) {
  switch (workInProgress.tag) {
    case IndeterminateComponent: {
      return mountIndeterminateComponent(
        current,
        workInProgress,
        workInProgress.type
      );
    }
    case HostRoot:
      return updateHostRoot(current, workInProgress);
    case HostComponent:
      return updateHostComponent(current, workInProgress);
    default:
      return null;
  }
}

function updateHostRoot(current, workInProgress) {
  // cloneUpdateQueue(current, workInProgress);
  // processUpdateQueue(workInProgress, nextProps, null, renderLanes);

  const nextChildren =
    workInProgress.updateQueue.shared.interleaved.payload.element;
  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

function updateHostComponent(current, workInProgress) {
  const type = workInProgress.type;
  const nextProps = workInProgress.pendingProps;
  const prevProps = current !== null ? current.memoizedProps : null;

  let nextChildren = nextProps.children;
  const isDirectTextChild = shouldSetTextContent(type, nextProps);

  if (isDirectTextChild) {
    nextChildren = null;
  } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    workInProgress.flags |= ContentReset;
  }

  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

function mountIndeterminateComponent(_current, workInProgress, Component) {
  const props = workInProgress.pendingProps;
  let value = renderWithHooks(null, workInProgress, Component, props);

  workInProgress.tag = FunctionComponent;

  reconcileChildren(null, workInProgress, value);

  return workInProgress.child;
}

function reconcileChildren(current, workInProgress, nextChildren) {
  if (current === null) {
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren);
  } else {
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren
    );
  }
}
