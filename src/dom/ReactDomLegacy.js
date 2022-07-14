import {
  createContainer,
  updateContainer,
} from "../reconciler/ReactFiberReconciler";
import { LegacyRoot } from "../shared/ReactRootTags";

function legacyRenderSubtreeIntoContainer(
  parentComponent,
  children,
  container
) {
  let root = container._reactRootContainer;

  if (!root) {
    root = legacyCreateRootFromDOMContainer(
      container,
      children,
      parentComponent
    );
  }
}

function legacyCreateRootFromDOMContainer(
  container,
  initialChildren,
  parentComponent
) {
  let rootSibling;

  while ((rootSibling = container.lastChild)) {
    container.removeChild(rootSibling);
  }

  // 创建 container 时， update queue 为空。再创建 update 对象
  let root = createContainer(container, LegacyRoot);

  container._reactRootContainer = root;

  // const rootContainerElement =
  //   container.nodeType === COMMENT_NODE ? container.parentNode : container;

  updateContainer(initialChildren, root, parentComponent);
}

export default function render(element, container) {
  return legacyRenderSubtreeIntoContainer(null, element, container);
}
