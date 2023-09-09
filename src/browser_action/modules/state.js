// state.js

class State {
  #data = {};
  #accessJwt = null;
  #did = null;

  // Existing methods
  getData() {
    return this.#data;
  }

  setData(data) {
    this.#data = data;
  }

  // New methods for Bluesky authentication
  getAccessJwt() {
    return this.#accessJwt;
  }

  setAccessJwt(accessJwt) {
    this.#accessJwt = accessJwt;
  }

  getDid() {
    return this.#did;
  }

  setDid(did) {
    this.#did = did;
  }
}

export default new State();