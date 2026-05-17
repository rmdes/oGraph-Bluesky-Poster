## Privacy

- This extension does not collect or transmit any analytics, telemetry, or usage information.
- Your Bluesky handle and PDS URL are stored locally in the browser (via `chrome.storage.local`) so you do not have to retype them on every login.
- Your password is **never persisted**. It is sent once to your PDS to obtain authentication tokens, then discarded from memory.
- The authentication tokens returned by your PDS (`accessJwt` and `refreshJwt`) are stored locally so posts work across popup opens without re-login. Pressing **Logout** clears them.
- Network traffic goes directly between your browser and the PDS you specified, with two exceptions noted below.
- The OpenGraph metadata read from the active tab is processed entirely inside the popup and is only sent to your PDS when you explicitly create a post.
- When you post a message containing a URL, the extension sends that URL to Bluesky's `cardyb.bsky.app` service to fetch the OpenGraph card preview. This is the same service the official Bluesky web client uses, and it does not require any user credentials. Only the URL is sent — not your post text, handle, or session.
- When you log in without specifying a PDS URL, the extension queries Bluesky's public AppView (`public.api.bsky.app`) and the DID PLC directory (`plc.directory`) to discover your home PDS. These are public, unauthenticated lookups.
