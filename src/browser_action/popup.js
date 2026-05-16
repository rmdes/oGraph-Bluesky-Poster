import { COPY_BTN_ID, TABS_ID, NOTIFY_CRITICAL } from "./modules/constants";
import { copyData, switchTab, notify } from "./modules/eventHandlers";
import data from "./modules/state";
import { parseOGData, getCurrentTab, isRestrictedUrl } from "./modules/utils";
import renderViews from "./modules/viewRenderers";
import { registerBlueskyHandlers } from "./modules/blueskyHandlers";
import { countGraphemes, POST_MAX_GRAPHEMES } from "./modules/facets";

// Tabs and copy-to-clipboard
document.getElementById(TABS_ID).addEventListener("click", switchTab);
document.getElementById(COPY_BTN_ID).addEventListener("click", copyData);

// Bluesky login / logout / post-create wiring
registerBlueskyHandlers();

// Live grapheme counter for the compose textarea
const textInput = document.getElementById("user-text-input");
const charCount = document.getElementById("char-count");
if (textInput && charCount) {
  textInput.addEventListener("input", () => {
    const count = countGraphemes(textInput.value);
    charCount.textContent = `${count} / ${POST_MAX_GRAPHEMES}`;
    charCount.classList.toggle("over-limit", count > POST_MAX_GRAPHEMES);
  });
}

// Inject OG-tag scraper into the active tab, then render the preview/data views.
// Three failure modes the user should distinguish:
//  - active page is a chrome:// / extension / store page (script injection blocked)
//  - injection raises for some other reason (host_permissions, file://, etc.)
//  - page has no OG tags at all
async function loadOgDataFromActiveTab() {
  const tab = await getCurrentTab();

  if (isRestrictedUrl(tab?.url)) {
    notify(
      NOTIFY_CRITICAL,
      "OpenGraph data isn't available on this browser page."
    );
    return {};
  }

  try {
    const injectedResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: parseOGData,
    });
    return injectedResult?.[0]?.result ?? {};
  } catch {
    notify(NOTIFY_CRITICAL, "Couldn't read this page (extension cannot access it).");
    return {};
  }
}

loadOgDataFromActiveTab().then((ogData) => {
  data.setData(ogData);
  renderViews();
});
