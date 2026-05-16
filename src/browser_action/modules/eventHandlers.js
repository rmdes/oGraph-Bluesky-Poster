import {
  ACTIVE,
  ACTIVE_TAB_BUTTON_CLASS,
  CONTENT_BOX_ACTIVE_CLASS,
  COPY_FAILED,
  COPY_SUCCESSFUL,
  DISPLAY_BLOCK,
  DISPLAY_NONE,
  ERROR,
  NOTIFY_CRITICAL,
  NOTIFY_SUCCESS,
  TOAST_ID,
} from "./constants";
import data from "./state";

export const isButton = (element) => element?.tagName === "BUTTON" || false;

export const hideToast = (toastElement) => {
  toastElement.style.display = DISPLAY_NONE;
  toastElement.classList.remove(ERROR);
  toastElement.textContent = "";
};

export const autoDismissToast = (toastElement, timeout = 3000) => {
  const toastTimeoutId = setTimeout(() => {
    hideToast(toastElement);
    clearTimeout(toastTimeoutId);
  }, timeout);
};

export const showToast = ({ toastElement, type, message }) => {
  switch (type) {
    case NOTIFY_CRITICAL:
      toastElement.classList.add(ERROR);
      break;
    default:
      toastElement.classList.remove(ERROR);
  }
  // textContent (not innerHTML): toast strings are always plain text.
  // Avoids XSS if any future call site passes user-controlled data.
  toastElement.textContent = message;
  toastElement.style.display = DISPLAY_BLOCK;
};

// Convenience wrapper: show + auto-dismiss with one call, looking up the
// toast element by id so callers don't need to know the DOM contract.
export const notify = (type, message) => {
  const toastElement = document.getElementById(TOAST_ID);
  if (!toastElement) return;
  showToast({ toastElement, type, message });
  autoDismissToast(toastElement);
};

export const switchTab = (event) => {
  if (event?.target) {
    if (!isButton(event.target)) {
      return;
    }
    const tabToSwitch = event?.target?.dataset?.tab;
    if (tabToSwitch) {
      document.querySelector(ACTIVE_TAB_BUTTON_CLASS).classList.remove(ACTIVE);
      document.querySelector(CONTENT_BOX_ACTIVE_CLASS).classList.remove(ACTIVE);
      event.target.classList.add(ACTIVE);
      document.getElementById(tabToSwitch).classList.add(ACTIVE);
    }
  }
};

export const copyData = () => {
  const toastConatiner = document.getElementById(TOAST_ID);
  let isCopySuccessful = false;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(JSON.stringify(data.getData()));
    isCopySuccessful = true;
  }
  showToast({
    toastElement: toastConatiner,
    type: isCopySuccessful ? NOTIFY_SUCCESS : NOTIFY_CRITICAL,
    message: isCopySuccessful ? COPY_SUCCESSFUL : COPY_FAILED,
  });
  autoDismissToast(toastConatiner);
};
