import {
  CODE_CONTAINER_ID,
  NO_OG_DATA,
  PREVIEW_CONTAINER_ID,
  PREVIEW_UI,
  PREVIEW_IMG_HEIGHT,
} from "./constants";
import data from "./state";
import { getImageWidth } from "./utils";

const buildNoPreviewNode = () => {
  const heading = document.createElement("h3");
  heading.className = "no-data";
  heading.textContent = NO_OG_DATA;
  return heading;
};

const buildCodeNode = () => {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(document.createTextNode("{"));
  fragment.appendChild(document.createElement("br"));
  for (const [key, value] of Object.entries(data.getData())) {
    const keySpan = document.createElement("span");
    keySpan.className = "key";
    keySpan.textContent = key;
    const valueSpan = document.createElement("span");
    valueSpan.className = "value";
    valueSpan.textContent = value;
    fragment.appendChild(keySpan);
    fragment.appendChild(document.createTextNode(": "));
    fragment.appendChild(valueSpan);
    fragment.appendChild(document.createElement("br"));
  }
  fragment.appendChild(document.createTextNode("}"));
  return fragment;
};

const isSafeImageUrl = (url) => {
  if (typeof url !== "string" || url.trim() === "") return false;
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const buildPreviewNode = (
  previewType,
  { title, description, imageSrc, siteName, url }
) => {
  const fragment = document.createDocumentFragment();

  const imageDiv = document.createElement("div");
  imageDiv.style.height = `${PREVIEW_IMG_HEIGHT}px`;
  if (previewType === PREVIEW_UI.WITH_IMAGE && isSafeImageUrl(imageSrc)) {
    imageDiv.style.backgroundImage = `url(${JSON.stringify(imageSrc)})`;
    imageDiv.style.backgroundRepeat = "no-repeat";
    imageDiv.style.backgroundPosition = "top";
    imageDiv.style.backgroundSize = "contain";
  }
  fragment.appendChild(imageDiv);

  const titleEl = document.createElement("h2");
  titleEl.textContent = title ?? "";
  fragment.appendChild(titleEl);

  const descEl = document.createElement("p");
  descEl.textContent = description ?? "";
  fragment.appendChild(descEl);

  const footerEl = document.createElement("h4");
  footerEl.textContent = siteName ?? url ?? "";
  fragment.appendChild(footerEl);

  return fragment;
};

const replaceChildren = (container, node) => {
  container.textContent = "";
  container.appendChild(node);
};


// Add new function to handle UI changes after Bluesky login
export function updateBlueskyLoginUI(success, handle, pdsUrl) {
  const loggedInMessageElem = document.getElementById("logged-in-message");
  const loginFormElem = document.getElementById("login-form");
  const userInputFormElem = document.getElementById("user-input-form");
  const pdsUrlContainerElem = document.getElementById("pds-url-container");  // New variable
  const logoutBtnElem = document.getElementById("logout-btn"); // New variable

  if (success) {
    // Hide the login form and PDS URL input
    loginFormElem.style.display = "none";
    pdsUrlContainerElem.style.display = "none";  // Updated line
    
    // Show the logged-in message
    loggedInMessageElem.textContent = `Logged in as ${handle} on ${pdsUrl}`;
    loggedInMessageElem.style.display = "block";
    logoutBtnElem.style.display = "block";  // logout
    
    // Show the user input form for creating a post
    userInputFormElem.style.display = "block";
  } else {
    // If login failed, show the login form and hide the logged-in message and user input form
    loginFormElem.style.display = "block";
    logoutBtnElem.style.display = "none";  // logout
    pdsUrlContainerElem.style.display = "block";  // Updated line
    loggedInMessageElem.style.display = "none";
    userInputFormElem.style.display = "none";
  }
}



/*populate datatab UI*/
export function updateDataView() {
  const dataUIContainer = document.getElementById(CODE_CONTAINER_ID);
  if (Object.keys(data.getData()).length) {
    replaceChildren(dataUIContainer, buildCodeNode());
    return;
  }
  dataUIContainer.textContent = "{}";
}

/*populate preview UI with data from chrome script execution*/
export function updatePreview() {
  const previewContainer = document.getElementById(PREVIEW_CONTAINER_ID);
  if (Object.keys(data.getData()).length) {
    const {
      title,
      image: imageSrc,
      description,
      site_name: siteName,
      url,
    } = data.getData();
    getImageWidth(imageSrc)
      .then(() => {
        replaceChildren(
          previewContainer,
          buildPreviewNode(PREVIEW_UI.WITH_IMAGE, {
            title,
            description,
            imageSrc,
            siteName,
            url,
          })
        );
      })
      .catch(() => {
        replaceChildren(
          previewContainer,
          buildPreviewNode(PREVIEW_UI.WITHOUT_IMAGE, {
            title,
            description,
            siteName,
            url,
          })
        );
      });
  } else {
    replaceChildren(previewContainer, buildNoPreviewNode());
  }
}

export default function populateAllViews() {
  updatePreview();
  updateDataView();
}