// blueskyApi.js

// Import the state management object
import data from "./state";
import { showToast, autoDismissToast } from "./eventHandlers";
import { NOTIFY_SUCCESS, NOTIFY_CRITICAL, TOAST_ID } from "./constants";

async function fetchImageBlob(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return blob;
  }
  

  export async function authenticate(pdsUrl, handle, password) {
    console.log("authenticate function called");  // Log that the function has been called
    
    try {
      console.log("About to make fetch call to authenticate");  // Log before making the fetch call
      const response = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: handle, password: password })
      });
  
      const data = await response.json();
      console.log("Response received:", data);  // Log the data received from the fetch call
  
      if (data.accessJwt && data.did) {
        console.log("Authentication successful");  // Log if authentication is successful
        return { success: true, accessJwt: data.accessJwt, did: data.did };
      } else {
        console.log("Authentication failed");  // Log if authentication fails
        updateUIBasedOnLoginStatus(false);
        return { success: false };
      }
    } catch (error) {
      console.log("Error occurred:", error);  // Log if an error occurs
      return { success: false };
    }
  }
  
  export async function uploadFile(pdsUrl, accessJwt, filename, imgBytes, mimeType) {
    console.log("upload image to bluesky");
    const response = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'Authorization': `Bearer ${accessJwt}`
      },
      body: imgBytes
    });
    const data = await response.json();
    return data.blob;
  }
  
  export async function createPost(pdsUrl, accessJwt, did, ogData, userText, useOpenGraphData) {
    console.log("createPost function called"); // Log that the function has been called
    console.log("User text received in createPost: ", userText); // Log received userText
  
    const now = new Date().toISOString();
  
    // Initialize the post object with mandatory fields
    const post = {
      "$type": "app.bsky.feed.post",
      "text": userText || '',
      "createdAt": now
    };
  
    if (useOpenGraphData && ogData && ogData.url) { // Check if OpenGraph should be used
      // Populate the embedded card using OpenGraph data
      const embedExternal = {
        "$type": "app.bsky.embed.external",
        "external": {
          "uri": ogData.url,
          "title": ogData.title || '',
          "description": ogData.description || ''
        }
      };
  
      // If an image is available, upload it and attach the blob to the embed
      if (ogData.image) {
        const imgBlob = await fetchImageBlob(ogData.image);
        const mimeType = "image/jpeg"; // or dynamically determine
        const blob = await uploadFile(pdsUrl, accessJwt, 'image.jpg', imgBlob, mimeType);
        embedExternal.external.thumb = blob;
      }
  
      post.embed = embedExternal;
    } else if (userText) { 
      // If no OpenGraph data but user text is available, it will be a text-only post
      // 'text' and 'createdAt' are already set in `post` object
    } else {
      console.log("Insufficient data to create a post.");
      return { success: false };
    }
  
    console.log("About to make fetch call to create post"); // Log before making the fetch call
  
    const response = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessJwt}`
      },
      body: JSON.stringify({
        "repo": did,
        "collection": "app.bsky.feed.post",
        "record": post
      })
    });
  
    const data = await response.json();
    console.log("Response received:", data); // Log the data received from the fetch call
  
    if (data.cid) {
      console.log("Post created:", data.cid); // Log if post creation is successful
      return { success: true, cid: data.cid };
    } else {
      console.log("Failed to create post:", data); // Log if post creation fails
      return { success: false };
    }
  }
  
  