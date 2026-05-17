<p align="center">
<span><img src="./icons/icon.png" height="60px" style="vertical-align:middle;"><span style="vertical-align:middle;">&nbsp;<b>OGraph Bluesky Poster</b></span></span>
</p>

A Chrome extension to post the current browser tab to Bluesky as a rich link card, built from the page's OpenGraph metadata. Also works as a lightweight plain-text Bluesky client.

---

### Features

- One-click post to Bluesky from any browser tab
- Automatic embed card (title, description, image) sourced from the page's `<meta property="og:*">` tags
- Plain-text post mode when OpenGraph data isn't useful or available
- Inspect raw OpenGraph data and the JSON payload from the popup (debug tabs)
- Persistent login with automatic atproto session refresh — log in once and posts keep working after the access token expires
- Logout button to clear stored credentials

### How it works

When the popup opens, the extension injects a small scraper into the active tab, reads `<meta property="og:*">` tags, and builds an `app.bsky.embed.external` record. The card image (if present) is uploaded as a blob to your PDS and referenced by CID from the post record. Authentication uses standard atproto session tokens via `com.atproto.server.createSession`; when the access token expires, `com.atproto.server.refreshSession` is called transparently and the post is retried.

### Tech stack

- JavaScript (ESNext) — popup runs in the Chrome MV3 extension popup context
- Webpack + Babel — single-bundle output
- Jest — unit tests for the auth-retry wrapper, state, view helpers, and event handlers

### Install

Download the latest pre-built package (always points at the latest release):

- **Chrome / Vivaldi / any Chromium browser**: [OGraph-Bluesky-Poster-chrome.zip](https://github.com/rmdes/oGraph-Bluesky-Poster/releases/latest/download/OGraph-Bluesky-Poster-chrome.zip)
- **Firefox** (109+): [OGraph-Bluesky-Poster-firefox.xpi](https://github.com/rmdes/oGraph-Bluesky-Poster/releases/latest/download/OGraph-Bluesky-Poster-firefox.xpi)

Full release history: [github.com/rmdes/oGraph-Bluesky-Poster/releases](https://github.com/rmdes/oGraph-Bluesky-Poster/releases)

### Build from source

```bash
npm install
npm run package:all
```

Produces both `OGraph-Bluesky-Poster-chrome.zip` (load via `chrome://extensions` → Developer mode → "Load unpacked") and `OGraph-Bluesky-Poster-firefox.xpi` (load via `about:debugging` → "Load Temporary Add-on").

### Test

```bash
npm test
```

### Credit

Originally based on [oGraph Previewer](https://github.com/Parthipan-Natkunam/oGraph-previwer) by Parthipan Natkunam. The OpenGraph scraping core, modular popup architecture, and test scaffolding are inherited from that project. The Bluesky client extensions — authentication, posting, session refresh, embed-card composition, and the post-compose UI — are the contribution of this fork.
