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

/**
 * 递归遍历 react.elements 构成 fiber 树，
 * @param {Fiber} current
 * @param {Fiber} workInProgress
 * @returns
 */
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
    case FunctionComponent: {
      function resolveDefaultProps(Component, baseProps) {
        if (Component && Component.defaultProps) {
          // Resolve default props. Taken from ReactElement
          const props = Object.assign({}, baseProps);
          const defaultProps = Component.defaultProps;
          for (const propName in defaultProps) {
            if (props[propName] === undefined) {
              props[propName] = defaultProps[propName];
            }
          }
          return props;
        }
        return baseProps;
      }

      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps
      );
    }
    default:
      return null;
  }
}

function mountIndeterminateComponent(_current, workInProgress, Component) {
  const props = workInProgress.pendingProps;
  let value = renderWithHooks(null, workInProgress, Component, props);

  workInProgress.tag = FunctionComponent;

  reconcileChildren(null, workInProgress, value);

  return workInProgress.child;
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

  // 如果 children 只是文本， 则不需要创建对应的 fiber。
  const isDirectTextChild = shouldSetTextContent(type, nextProps);

  if (isDirectTextChild) {
    nextChildren = null;
  } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    workInProgress.flags |= ContentReset;
  }

  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

function updateFunctionComponent() {}

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
