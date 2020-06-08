# Sentinel Chrome extension

This Chrome extension is the companion extension of [this app](https://github.com/anhmiuhv/HumtumNodeExample/tree/master/sentinel).

This Chrome extension uses the authentication library [auth0-chrome](https://github.com/anhmiuhv/auth0-chrome)

## Usage

Step 1. Clone this Chrome extension and load it into Chrome. Make sure that the Extension ID stay constant using the following steps:
* In the `chrome://extensions/` page, pack the extension using `Pack extension` features
* Use https://robwu.nl/crxviewer/ to view the crx file
* Open the browser console to get following line

```
"key": "<your-chrome-extension-key>",
```
* copy this `"key": ...` into your `manifest.json`
* Load the unpacked extension and get your extension ID. This is the constant extension id

Step 2. Create the client ID using humtum OIDC client registration. Make sure that the callback URIs include `chrome-extension://<extension-id>` and `https://<extension-id>.chromiumapp.org/auth0`

Step 3. Create env.js file like [this](src/background/env.js) with your Auth0 Credential.
