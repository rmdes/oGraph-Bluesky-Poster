---
layout: default
title: oGraph Bluesky Poster
---

A Chrome extension to post the current browser tab to Bluesky as a rich link card, built from the page's OpenGraph metadata. Also works as a lightweight plain-text Bluesky client.

## Features

- **One-click post** from any browser tab
- **Automatic embed card** with title, description, and thumbnail sourced from OpenGraph meta tags
- **Rich text**: clickable links, `@mentions`, and `#hashtags` rendered inline on Bluesky
- **PDS auto-discovery** — just type your handle; no server URL needed
- **Persistent login** with automatic session token refresh
- **Live 300-grapheme counter** so you stay within Bluesky's post limit
- **Lightweight** — single popup, no background page, ~50 KB bundled

## How it works

When the popup opens, the extension scrapes `<meta property="og:*">` tags from the active tab and builds an `app.bsky.embed.external` record. Card images are uploaded as blobs to your PDS and referenced by CID. Posts with URLs in the text get an auto-card built via Bluesky's `cardyb.bsky.app` service — the same one the official web client uses.

Authentication uses standard atproto session tokens, with `refreshSession` called transparently when access tokens expire.

## Install

### Download the latest pre-built package

- **Chrome / Vivaldi / any Chromium browser**: [OGraph-Bluesky-Poster-chrome.zip](https://github.com/rmdes/oGraph-Bluesky-Poster/releases/latest/download/OGraph-Bluesky-Poster-chrome.zip)
- **Firefox** (109+): [OGraph-Bluesky-Poster-firefox.xpi](https://github.com/rmdes/oGraph-Bluesky-Poster/releases/latest/download/OGraph-Bluesky-Poster-firefox.xpi)

These links always point at the most recent release. Full release history with version-stamped archives: [github.com/rmdes/oGraph-Bluesky-Poster/releases](https://github.com/rmdes/oGraph-Bluesky-Poster/releases).

### Sideload in Chrome / Vivaldi

1. Unzip the downloaded file
2. Go to `chrome://extensions`
3. Enable "Developer mode" (top-right)
4. Click "Load unpacked"
5. Select the unzipped folder

### Sideload in Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select the `.xpi` file

For permanent install on Firefox stable, the extension needs to be signed by Mozilla — that happens through the AMO listing.

### Build from source

```bash
git clone https://github.com/rmdes/oGraph-Bluesky-Poster.git
cd oGraph-Bluesky-Poster
npm install
npm run package:all     # produces both .zip and .xpi
```

## Privacy

See the [privacy policy](privacy.html). Short version: no analytics, no telemetry, your password is never stored.

## Open source

Source, issues, and pull requests: [github.com/rmdes/oGraph-Bluesky-Poster](https://github.com/rmdes/oGraph-Bluesky-Poster)

Originally based on [oGraph Previewer](https://github.com/Parthipan-Natkunam/oGraph-previwer) by Parthipan Natkunam. The Bluesky client extensions are the contribution of this fork.
