// state.js
// In-memory singleton for OpenGraph data scraped from the active tab.
// Auth state (accessJwt, refreshJwt, did, handle, pdsUrl) lives in
// chrome.storage.local — see modules/storage.js.

class State {
  #data = {};

  getData() {
    return this.#data;
  }

  setData(data) {
    this.#data = data;
  }
}

export default new State();
