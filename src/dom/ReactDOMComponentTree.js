const internalInstanceKey = "__reactFiber$";
const internalPropsKey = "__reactProps$";

export function updateFiberProps(node, props) {
  node[internalPropsKey] = props;
}

export function precacheFiberNode(hostInst, node) {
  node[internalInstanceKey] = hostInst;
}
