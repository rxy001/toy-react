import { createFiberRoot } from "./ReactFiberRoot";
import { createUpdate, enqueueUpdate } from "./ReactFiberClassUpdateQueue";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";

/**
 * 创建 rootFiber 和 fiberRoot ，rootFiber.current = fiberRoot , fiberRoot.stateNode = rootFiber
 * 初始 updateQueue 赋值给 fiberRoot
 * @param {DOM} container
 * @param {LegacyRoot} LegacyRoot
 * @returns {FiberRoot}
 */
export function createContainer(container, LegacyRoot) {
  return createFiberRoot(container, LegacyRoot);
}

export function updateContainer(element, container, parentComponent) {
  const current = container.current;
  // const eventTime = requestEventTime();

  // 使用 reactdom.render, first mount时为synclane
  // const lane = requestUpdateLane(current);

  const update = createUpdate();

  update.payload = { element };

  const root = enqueueUpdate(current, update);
  if (root !== null) {
    scheduleUpdateOnFiber(root, current);
  }
}
