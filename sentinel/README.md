# Sentinel Chrome extension

This Chrome extension is the companion extension of [this app](https://github.com/anhmiuhv/HumtumNodeExample/tree/master/sentinel).

This Chrome extension uses the authentication library [auth0-chrome](https://github.com/anhmiuhv/auth0-chrome)

## Usage

Step 1. Create the Chrome extension and load it into Chrome. Follow [this](https://developer.chrome.com/extensions/app_identity#copy_key) to make sure that the Extension ID stay constant
Step 2. Create the client ID using humtum OIDC client registration. Make sure that the callback URIs include `chrome-extension://<extension-id>` and `https://<extension-id>.chromiumapp.org/auth0`
Step 3. Create env.js file like [this](src/background/env.js) with your Auth0 Credential.
