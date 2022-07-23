import {
  setValueForStyles,
  setValueForProperty,
} from "./CSSPropertyOperations";
import setInnerHTML from "./setInnerHTML";
import setTextContent from "./setTextContent";

const STYLE = "style";
const DANGEROUSLY_SET_INNER_HTML = "dangerouslySetInnerHTML";
const CHILDREN = "children";
const HTML = "__html";

export function diffProperties(domElement, type, lastRawProps, nextRawProps) {
  let lastProps, nextProps;
  let updatePayload = null;

  switch (type) {
    default:
      lastProps = lastRawProps;
      nextProps = nextRawProps;
  }

  let propKey;
  let styleName;
  let styleUpdates = null;

  // 删除多余的 properties
  for (propKey in lastProps) {
    // 忽略 nextProps 已有和 lastProps 继承或 value 为空 的 properties.
    if (
      nextProps.hasOwnProperty(propKey) ||
      !lastProps.hasOwnProperty(propKey) ||
      lastProps[propKey] === null
    ) {
      continue;
    }

    if (propKey === STYLE) {
      const lastStyle = lastProps[propKey];
      for (styleName in lastStyle) {
        if (lastStyle.hasOwnProperty(styleName)) {
          if (!styleUpdates) {
            styleUpdates = {};
          }
          styleUpdates[styleName] = "";
        }
      }
    }
    //  else if (registrationNameDependencies.hasOwnProperty(propKey)) {
    //   // This is a special case. If any listener updates we need to ensure
    //   // that the "current" fiber pointer gets updated so we need a commit
    //   // to update this element.
    //   if (!updatePayload) {
    //     updatePayload = [];
    //   }
    // }
    else {
      (updatePayload = updatePayload || []).push(propKey, null);
    }
  }

  for (propKey in nextProps) {
    const nextProp = nextProps[propKey];
    const lastProp = lastProps != null ? lastProps[propKey] : undefined;
    if (
      !nextProps.hasOwnProperty(propKey) ||
      nextProp === lastProp ||
      (nextProp == null && lastProp == null)
    ) {
      continue;
    }
    if (propKey === STYLE) {
      if (lastProp) {
        // Unset styles on `lastProp` but not on `nextProp`.
        for (styleName in lastProp) {
          if (
            lastProp.hasOwnProperty(styleName) &&
            (!nextProp || !nextProp.hasOwnProperty(styleName))
          ) {
            if (!styleUpdates) {
              styleUpdates = {};
            }
            styleUpdates[styleName] = "";
          }
        }
        // Update styles that changed since `lastProp`.
        for (styleName in nextProp) {
          if (
            nextProp.hasOwnProperty(styleName) &&
            lastProp[styleName] !== nextProp[styleName]
          ) {
            if (!styleUpdates) {
              styleUpdates = {};
            }
            styleUpdates[styleName] = nextProp[styleName];
          }
        }
      } else {
        // 为什么 styleUpdates = nextProp 不提到前面  ??
        // Relies on `updateStylesByID` not mutating `styleUpdates`.
        if (!styleUpdates) {
          if (!updatePayload) {
            updatePayload = [];
          }
          updatePayload.push(propKey, styleUpdates);
        }
        styleUpdates = nextProp;
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      const nextHtml = nextProp ? nextProp[HTML] : undefined;
      const lastHtml = lastProp ? lastProp[HTML] : undefined;
      if (nextHtml != null) {
        if (lastHtml !== nextHtml) {
          (updatePayload = updatePayload || []).push(propKey, nextHtml);
        }
      }
    } else if (propKey === CHILDREN) {
      if (typeof nextProp === "string" || typeof nextProp === "number") {
        (updatePayload = updatePayload || []).push(propKey, "" + nextProp);
      }
    }
    // else if (registrationNameDependencies.hasOwnProperty(propKey)) {
    //   if (nextProp != null) {
    //     // We eagerly listen to this even though we haven't committed yet.
    //     if (__DEV__ && typeof nextProp !== "function") {
    //       warnForInvalidEventListener(propKey, nextProp);
    //     }
    //     if (propKey === "onScroll") {
    //       listenToNonDelegatedEvent("scroll", domElement);
    //     }
    //   }
    //   if (!updatePayload && lastProp !== nextProp) {
    //     // This is a special case. If any listener updates we need to ensure
    //     // that the "current" props pointer gets updated so we need a commit
    //     // to update this element.
    //     updatePayload = [];
    //   }
    // }
    else {
      (updatePayload = updatePayload || []).push(propKey, nextProp);
    }
  }
  if (styleUpdates) {
    (updatePayload = updatePayload || []).push(STYLE, styleUpdates);
  }
  return updatePayload;
}

export function updateProperties(domElement, updatePayload) {
  updateDOMProperties(domElement, updatePayload);
}

function updateDOMProperties(domElement, updatePayload) {
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i];
    const propValue = updatePayload[i + 1];
    if (propKey === STYLE) {
      setValueForStyles(domElement, propValue);
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      setInnerHTML(domElement, propValue);
    } else if (propKey === CHILDREN) {
      setTextContent(domElement, propValue);
    } else {
      setValueForProperty(domElement, propKey, propValue);
    }
  }
}
