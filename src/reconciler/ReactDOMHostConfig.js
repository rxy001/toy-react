import { setValueForStyles } from "../dom/CSSPropertyOperations";

const CHILDREN = "children";
const STYLE = "style";
const HTML = "__html";
const DANGEROUSLY_SET_INNER_HTML = "dangerouslySetInnerHTML";

export function createInstance(type, props, filber) {
  const domElement = document.createElement(type);
  if (type === "select") {
    if (props.multiple) {
      domElement.multiple = true;
    } else if (props.size) {
      domElement.size = props.size;
    }
  }

  domElement["__reactFiber$"] = filber;
  domElement["__reactProps$"] = props;
  return domElement;
}

export function appendInitialChild(parentInstance, child) {
  parentInstance.appendChild(child);
}

export function insertBefore(parentInstance, child, beforeChild) {
  parentInstance.insertBefore(child, beforeChild);
}

export function appendChild(parentInstance, child) {
  parentInstance.appendChild(child);
}

const localPromise = typeof Promise === "function" ? Promise : undefined;

export const scheduleTimeout =
  typeof setTimeout === "function" ? setTimeout : undefined;

export const scheduleMicrotask =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : typeof localPromise !== "undefined"
    ? (callback) =>
        localPromise.resolve(null).then(callback).catch(handleErrorInNextTick)
    : scheduleTimeout;

function handleErrorInNextTick(error) {
  setTimeout(() => {
    throw error;
  });
}

export function finalizeInitialChildren(domElement, type, props) {
  setInitialProperties(domElement, type, props);
  switch (type) {
    case "button":
    case "input":
    case "select":
    case "textarea":
      return !!props.autoFocus;
    case "img":
      return true;
    default:
      return false;
  }
}

function setInitialProperties(domElement, type, rawProps) {
  let props = rawProps;

  setInitialDOMProperties(type, domElement, props);
}

function setInitialDOMProperties(tag, domElement, nextProps) {
  for (const propKey in nextProps) {
    if (!nextProps.hasOwnProperty(propKey)) {
      continue;
    }
    const nextProp = nextProps[propKey];
    if (propKey === STYLE) {
      setValueForStyles(domElement, nextProp);
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      const nextHtml = nextProp ? nextProp[HTML] : undefined;
      if (nextHtml != null) {
        domElement.innerHTML = nextHtml;
      }
    } else if (propKey === CHILDREN) {
      if (typeof nextProp === "string") {
        // Avoid setting initial textContent when the text is empty. In IE11 setting
        // textContent on a <textarea> will cause the placeholder to not
        // show within the <textarea> until it has been focused and blurred again.
        // https://github.com/facebook/react/issues/6731#issuecomment-254874553
        const canSetTextContent = tag !== "textarea" || nextProp !== "";
        if (canSetTextContent) {
          domElement.textContent = nextProp;
        }
      } else if (typeof nextProp === "number") {
        domElement.textContent = "" + nextProp;
      }
      // 添加事件， todo: 使用react.event 待删除
    } else if (propKey.startsWith("on") && typeof nextProp === "function") {
      domElement.addEventListener(
        propKey.toLowerCase().replace("on", ""),
        nextProp
      );
    }
  }
}

export function shouldSetTextContent(type, props) {
  return (
    type === "textarea" ||
    type === "noscript" ||
    typeof props.children === "string" ||
    typeof props.children === "number" ||
    (typeof props.dangerouslySetInnerHTML === "object" &&
      props.dangerouslySetInnerHTML !== null &&
      props.dangerouslySetInnerHTML.__html != null)
  );
}
