<p align="center">

<span><img  src="./icons/icon.png" height="60px" style="vertical-align:middle;"><span style="vertical-align:middle;">&nbsp;<b>OGraph Bluesky Poster</b></span></span>



A chrome extension to quickly preview open graph meta tag data of any web page in the current tab and retrieve it in a JSON format
+ **this fork allow to use the extension as a client for Bluesky, it uses the OpenGraph data fetched by the original extension and pass it the bluesky API as an Embed Card populated with the OpenGraph data.**

---

### Features:

- Display a visual `:og` data preview of the page in the current tab.
- Copy Data in JSON format with just a click of a button
- Post the current Tab link + OpenGrah + Text data to Bluesky as Embed Card
- Serve as minimal Chrome client to post text to Bluesky


### Extension In Action:

[Test](https://blog.rmendes.net/2023/09/09/comment-installer-bluesky.html) before publication to Extension stores

### Tech Stack & Tools:

- JavaScript (ESNext)
- Webpack
- Babel
- CSS
- HTML
- Jest

### Build Steps:

1. clone this repo.
2. `cd` into the cloned directory.
3. run `npm install`
4. run `npm run build`
5. The output directory named `dist` will be generated with production ready bundle.

### Credit:
- ALL the credits goes to the original [OGgraph Preview Extension](https://github.com/Parthipan-Natkunam/oGraph-previwer) I merely identified a good extension to build upon and ported python code to post to bluesky in javascript and then adapted the extention UI to turn it into a client for bluesky. 