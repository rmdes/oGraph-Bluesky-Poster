import { COPY_BTN_ID, TABS_ID } from "./modules/constants";
import { copyData, switchTab } from "./modules/eventHandlers";
import data from "./modules/state";
import { parseOGData, getCurrentTab } from "./modules/utils";
import renderViews, { updateBlueskyLoginUI } from './modules/viewRenderers';
import * as blueskyApi from './modules/blueskyApi';
import { showToast, autoDismissToast } from "./modules/eventHandlers";
import { TOAST_ID, NOTIFY_SUCCESS } from './modules/constants'; // Import from correct file



// Event handlers for tabs and copy data
document.getElementById(TABS_ID).addEventListener("click", switchTab);
document.getElementById(COPY_BTN_ID).addEventListener("click", copyData);

// Fetch OpenGraph data when extension is opened
getCurrentTab().then((tab) => {
  let ogData = null;
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      func: parseOGData,
    })
    .then((injectedResult) => {
      ogData = injectedResult?.[0]?.result ?? {};
    }).catch(() => {
      ogData = {};
    }).finally(() => {
      data.setData(ogData);
      renderViews();
    });
});


// Event listener for Bluesky login
document.getElementById("bluesky-login-btn").addEventListener("click", async () => {
  const pdsUrl = document.getElementById("pds-url").value;
  const handle = document.getElementById("handle").value;
  const password = document.getElementById("password").value;
  const { success, accessJwt, did } = await blueskyApi.authenticate(pdsUrl, handle, password);

  if (success) {
    // Save to local storage
    saveToLocalStorage('pdsUrl', pdsUrl);
    saveToLocalStorage('handle', handle);
    saveToLocalStorage('accessJwt', accessJwt);
    saveToLocalStorage('did', did);
    
    // Update the UI to reflect successful login
    updateBlueskyLoginUI(success, handle, pdsUrl);  // Call the function here
  }
});

// Event listener for Logout
document.getElementById("logout-btn").addEventListener("click", async () => {
  // Clear accessJwt from local storage
  await clearFromLocalStorage('accessJwt');
  
  // Update the UI to reflect logged-out state
  updateBlueskyLoginUI(false);
});

// Event listener for Bluesky post creation
document.getElementById("bluesky-post-btn").addEventListener("click", async () => {
  // Debugging lines to check the elements
  console.log('Debugging Elements:');
  console.log('pdsUrl element:', document.getElementById('pds-url'));
  console.log('handle element:', document.getElementById('handle'));
  console.log('userText element:', document.getElementById('user-text-input'));

  const pdsUrl = await loadFromLocalStorage('pdsUrl');
  const accessJwt = await loadFromLocalStorage('accessJwt');
  const did = await loadFromLocalStorage('did');
  const ogData = data.getData() || {};
  const userText = document.getElementById("user-text-input").value || '';
  console.log("Captured user text: ", userText);
  const useOpenGraphData = document.getElementById("use-og-data-checkbox").checked;
  
  let postData = {};

  // Check whether to use OpenGraph data
  if (useOpenGraphData) {
    postData = {
      title: ogData.title || '',
      description: ogData.description || userText || '',
      url: ogData.url || '',
      image: ogData.image || ''
    };
  } else {
    postData = {
      text: userText,
      createdAt: new Date().toISOString()
    };
  }


  // Validate postData
  if (useOpenGraphData && (!postData.description && !postData.url && !postData.image)) {
    console.error("Insufficient data to create a post with OpenGraph data.");
    // Maybe show a UI message to the user about this
    return;
  }

  if (!useOpenGraphData && !postData.text) {
    console.error("Insufficient data to create a text-only post.");
    // Maybe show a UI message to the user about this
    return;
  }

// Call createPost function from blueskyApi
console.log("About to call createPost...");
const result = await blueskyApi.createPost(pdsUrl, accessJwt, did, ogData, userText, useOpenGraphData);
console.log("createPost result:", result);

if (result.success) {
  console.log("Post created successfully, CID:", result.cid);

  // Clear the input fields and checkbox
  console.log("About to clear input fields...");
  document.getElementById("user-text-input").value = '';
  document.getElementById("use-og-data-checkbox").checked = false;
  console.log("Input fields cleared.");
  
  // Show a success message
  console.log("About to show the toast...");
  const toastElement = document.getElementById(TOAST_ID);
  console.log("Toast element:", toastElement);

  showToast({
    toastElement: toastElement,
    type: NOTIFY_SUCCESS,
    message: "Post created successfully!",
  });
  autoDismissToast(toastElement);
  console.log("Toast should have been shown.");

} else {
  console.log("Failed to create post");
  // You can update the UI here to reflect the failure
}
});

// if (result.success) {
//   console.log("Post created successfully", result.cid);
  
//   // Clear the input fields
//   document.getElementById("user-text-input").value = "";

//   // Show the success toast message
//   const toastElement = document.getElementById(TOAST_ID);
//   showToast({
//     toastElement: toastElement,
//     type: NOTIFY_SUCCESS,
//     message: "Post created successfully!",
//   });
//   autoDismissToast(toastElement);

//   // You can also update the UI here to reflect successful post creation
// } else {
//   console.log("Failed to create post");
//   // You can update the UI here to reflect the failure
// }

// Function to save key-value pairs to Chrome local storage
function saveToLocalStorage(key, value) {
  chrome.storage.local.set({ [key]: value }, function() {
    console.log(`${key} saved.`);
  });
}

// Function to load a value from Chrome local storage
function loadFromLocalStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function(result) {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result[key]);
    });
  });
}

// Loading from local storage
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['accessJwt'], function(result) {
    if (result.accessJwt) {
      // Update the UI to reflect that the user is logged in
      console.log('User is logged in.');
    } else {
      // Update the UI to reflect that the user is not logged in
      console.log('User is not logged in.');
    }
  });
});


// Function to clear a key from Chrome local storage
function clearFromLocalStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([key], function() {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}


// Load PDS URL, handle, and tokens when extension popup is opened
document.addEventListener('DOMContentLoaded', async () => {
  const pdsUrl = await loadFromLocalStorage('pdsUrl');
  const handle = await loadFromLocalStorage('handle');
  const accessJwt = await loadFromLocalStorage('accessJwt');
  // Set UI fields or state
  if (pdsUrl && handle && accessJwt) {
    // User is already logged in
    updateBlueskyLoginUI(true, handle, pdsUrl);
  } else {
    // User is not logged in
    updateBlueskyLoginUI(false);
  }
});

