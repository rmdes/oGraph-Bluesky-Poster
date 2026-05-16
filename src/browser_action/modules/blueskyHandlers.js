// blueskyHandlers.js
// Wires the Bluesky tab UI (login, logout, create post) to the API + storage.

import * as blueskyApi from "./blueskyApi";
import { saveMany, loadMany, clearMany } from "./storage";
import { updateBlueskyLoginUI } from "./viewRenderers";
import { notify } from "./eventHandlers";
import { NOTIFY_SUCCESS, NOTIFY_CRITICAL } from "./constants";
import { countGraphemes, POST_MAX_GRAPHEMES } from "./facets";
import { discoverPds } from "./identity";
import data from "./state";

const SESSION_KEYS = ["accessJwt", "refreshJwt", "did", "handle", "pdsUrl"];

// Normalize a manually-typed PDS URL: strip whitespace and trailing slash,
// and add https:// if the user omitted the scheme.
function normalizePdsUrl(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.trim().replace(/\/+$/, "");
  if (s === "") return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

async function onLogin(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();

  const handle = document.getElementById("handle").value.trim();
  const password = document.getElementById("password").value;
  const manualPdsUrl = normalizePdsUrl(document.getElementById("pds-url").value);

  if (!handle || !password) {
    notify(NOTIFY_CRITICAL, "Handle and password are required.");
    return;
  }

  // If the user didn't supply a PDS, discover it from the handle.
  let pdsUrl = manualPdsUrl;
  if (!pdsUrl) {
    pdsUrl = await discoverPds(handle);
    if (!pdsUrl) {
      notify(
        NOTIFY_CRITICAL,
        `Couldn't discover PDS for ${handle}. Try entering it manually under Advanced.`
      );
      return;
    }
  }

  const result = await blueskyApi.authenticate(pdsUrl, handle, password);

  if (!result.success) {
    notify(NOTIFY_CRITICAL, "Login failed. Check your handle and app password.");
    return;
  }

  await saveMany({
    pdsUrl,
    handle,
    accessJwt: result.accessJwt,
    refreshJwt: result.refreshJwt,
    did: result.did,
  });

  document.getElementById("password").value = "";
  updateBlueskyLoginUI(true, handle, pdsUrl);
}

async function onLogout() {
  await clearMany(SESSION_KEYS);
  updateBlueskyLoginUI(false);
}

async function onCreatePost(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();

  const session = await loadMany(["pdsUrl", "accessJwt", "refreshJwt", "did"]);
  const ogData = data.getData() || {};
  const userText = document.getElementById("user-text-input").value || "";
  const useOpenGraphData = document.getElementById("use-og-data-checkbox").checked;

  if (useOpenGraphData && !ogData.url && !ogData.description && !ogData.image) {
    notify(NOTIFY_CRITICAL, "No OpenGraph data on this page.");
    return;
  }
  if (!useOpenGraphData && !userText.trim()) {
    notify(NOTIFY_CRITICAL, "Add some text before posting.");
    return;
  }

  const graphemeCount = countGraphemes(userText);
  if (graphemeCount > POST_MAX_GRAPHEMES) {
    notify(
      NOTIFY_CRITICAL,
      `Post is too long (${graphemeCount}/${POST_MAX_GRAPHEMES}).`
    );
    return;
  }

  const result = await blueskyApi.createPost(
    session.pdsUrl,
    session.accessJwt,
    session.refreshJwt,
    session.did,
    ogData,
    userText,
    useOpenGraphData
  );

  if (result.unauthenticated) {
    notify(NOTIFY_CRITICAL, "Session expired. Please log in again.");
    updateBlueskyLoginUI(false);
    return;
  }

  if (!result.success) {
    notify(NOTIFY_CRITICAL, "Failed to create post.");
    return;
  }

  document.getElementById("user-text-input").value = "";
  document.getElementById("use-og-data-checkbox").checked = false;
  notify(NOTIFY_SUCCESS, "Post created successfully!");
}

async function restoreLoginState() {
  const { pdsUrl, handle, accessJwt } = await loadMany([
    "pdsUrl",
    "handle",
    "accessJwt",
  ]);
  if (pdsUrl && handle && accessJwt) {
    updateBlueskyLoginUI(true, handle, pdsUrl);
  } else {
    updateBlueskyLoginUI(false);
  }
}

export function registerBlueskyHandlers() {
  // Forms submit on Enter as well as button click — wiring at the form level
  // means the password manager affordances + Enter-to-submit just work.
  document.getElementById("login-form").addEventListener("submit", onLogin);
  document.getElementById("user-input-form").addEventListener("submit", onCreatePost);
  document.getElementById("logout-btn").addEventListener("click", onLogout);
  document.addEventListener("DOMContentLoaded", restoreLoginState);
}
