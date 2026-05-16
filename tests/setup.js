// Jest setup: polyfill browser globals that the bundled jsdom version misses.
// Modern Node + modern browsers have TextEncoder/TextDecoder as globals; the
// jsdom used by Jest 26 does not.

const { TextEncoder, TextDecoder } = require("util");
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}
