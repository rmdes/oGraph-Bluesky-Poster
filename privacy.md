## Privacy

- This extension does not collect or transmit any analytics, telemetry, or usage information.
- Your Bluesky handle and PDS URL are stored locally in the browser (via `chrome.storage.local`) so you do not have to retype them on every login.
- Your password is **never persisted**. It is sent once to your PDS to obtain authentication tokens, then discarded from memory.
- The authentication tokens returned by your PDS (`accessJwt` and `refreshJwt`) are stored locally so posts work across popup opens without re-login. Pressing **Logout** clears them.
- All network traffic goes directly between your browser and the PDS you specified. There are no third-party services, intermediate servers, or external dependencies fetched at runtime.
- The OpenGraph metadata read from the active tab is processed entirely inside the popup and is only sent to your PDS when you explicitly create a post.
