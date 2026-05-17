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

Build from source (one-time):

```bash
git clone https://github.com/rmdes/oGraph-Bluesky-Poster.git
cd oGraph-Bluesky-Poster
npm install
npm run build
```

Then in Vivaldi / Chrome / any Chromium-based browser:

1. Go to `chrome://extensions`
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select the `dist/` folder

For pre-built releases see the [GitHub releases page](https://github.com/rmdes/oGraph-Bluesky-Poster/releases).

## Privacy

See the [privacy policy](privacy.html). Short version: no analytics, no telemetry, your password is never stored.

## Open source

Source, issues, and pull requests: [github.com/rmdes/oGraph-Bluesky-Poster](https://github.com/rmdes/oGraph-Bluesky-Poster)

Originally based on [oGraph Previewer](https://github.com/Parthipan-Natkunam/oGraph-previwer) by Parthipan Natkunam. The Bluesky client extensions are the contribution of this fork.
