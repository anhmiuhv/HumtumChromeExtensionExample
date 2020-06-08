# Sentinel Chrome extension

This Chrome extension is the companion extension of [this app](https://github.com/anhmiuhv/HumtumNodeExample/tree/master/sentinel).

This Chrome extension uses the authentication library [auth0-chrome](https://github.com/anhmiuhv/auth0-chrome)

## Set up

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

### Implementing Sentinel Chrome Extension.

Our Chrome extension is used by the followers to get messages from expert which will be shown upon the launch of a website that is specified by the message. The code for the extension is at [this repo](./sentinel). This code is also compatible with Firefox; however, in order to create a firefox extension, the correct redirect uri needs to be obtain from the Firefox in order to register it with the humtum-platform OIDC dynamic client registration endpoint.

Our Chrome extension has two components: `background` and `browser actions`. The `browser actions` helps the user login with humtum-platform. THe `background` process contains all the logic to login the user and to process all the messages received by the user.

#### Authentication with Auth0

Our Chrome extension uses a fork of [auth0-chrome](https://github.com/humtum-platform/auth0-chrome) library to authenticate.
First you need to create a env.js in the `src/background` folder.

```js
window.env = {
  AUTH0_DOMAIN: 'humtum.auth0.com',
  AUTH0_CLIENT_ID: '<your-client-id>',
};
```

and when the user press the login button, the `background` component receive an `authenticate` message and the below code run to authenticate with Auth0 and set up humtum to use the authentication token:

```javascript

// ./src/background/main.js
browser.runtime.onMessage.addListener(function (event) {
  if (event.type === 'authenticate') {

    // scope
    //  - openid if you want an id_token returned
    //  - offline_access if you want a refresh_token returned
    // device
    //  - required if requesting the offline_access scope.
    let options = {
      scope: "openid email profile offline_access read:appdata write:appdata",
      audience: "com.humtum.api.sentinel",
    };

    authzero = new Auth0Chrome(env.AUTH0_DOMAIN, env.AUTH0_CLIENT_ID)
    authzero
      .authenticate(options)
      .then(async (authResult) => {
          humtum.getAuth().storeAuthResult(authResult)
          humtum.getAuth().scheduleRenewal(refreshthetoken)
          let data = await humtum.getSelf()
          data && browser.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon128.png',
            title: 'Login Successful',
            message: `You can use the app now`
          });

          listenForMessage()
        }

      ).catch(function (err) {
        browser.notifications.create({
          type: 'basic',
          title: 'Login Failed',
          message: err.message,
          iconUrl: '/icons/icon128.png'
        });
      });

  } else if (event.type == "logout") {
    humtum.getCable().disconnect()
    filterWeb.clear()
    localStorage.webFilter = JSON.stringify(filterWeb.toJSON())

  }
});
```

Users login using the login button on the launch of the extension's browser action, and then they are set up to receive messages from experts. All of the logic for the Chrome extension to interact with humtum is in `src/background/main.js`

#### Implementing Sentinel

##### Receving messages and displaying the messages

We use `humtum.subscribeToChannel("MessagesChannel", ..., ... ,...)` to process the incoming messages. If the message has the correct format of:
```js
{
  website: string,
  websitemsg: string
}
```
The website and the message will be added to a lru storage. And then, using the [onUpdated](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onUpdated) callback, for each time user visits a website, we can check the url against the stored message. If the url passes the check, the message will be displayed to the users.

##### Browser action

the `browser action` will display the profile if the user is logged in. Otherwise it would display the login button. [browser.runtime.sendMessage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/sendMessage) is used to communicate with the browser backend.

```js

// ./src/browser_action/browser_action.js

function logout() {
  // Remove the idToken from storage
  localStorage.clear();
  browser.runtime.sendMessage({
    type: "logout"
  });
  main();
}

// Minimal jQuery
const $$ = document.querySelectorAll.bind(document);
const $ = document.querySelector.bind(document);


function renderProfileView(authResult) {
  $('.default').classList.add('hidden');
  $('.loading').classList.remove('hidden');
  fetch(`https://${env.AUTH0_DOMAIN}/userinfo`, {
    headers: {
      'Authorization': `Bearer ${authResult.access_token}`
    }
  }).then(resp => resp.json()).then((profile) => {
    ['picture', 'name', 'nickname'].forEach((key) => {

      const element = $('.' + key);
      if (element.nodeName === 'DIV') {
        element.style.backgroundImage = 'url(' + profile[key] + ')';
        return;
      }

      element.textContent = profile[key];
    });
    $('.loading').classList.add('hidden');
    $('.profile').classList.remove('hidden');
    $('.logout-button').addEventListener('click', logout);
  }).catch(logout);
}


function renderDefaultView() {
  $('.default').classList.remove('hidden');
  $('.profile').classList.add('hidden');
  $('.loading').classList.add('hidden');

  $('.login-button').addEventListener('click', () => {
    $('.default').classList.add('hidden');
    $('.loading').classList.remove('hidden');
    browser.runtime.sendMessage({
      type: "authenticate"
    });
  });
}

function main() {
  const authResult = JSON.parse(localStorage.humtumAuth || '{}');
  if (authResult.access_token && authResult.expires_in * 1000 - (Date.now() - authResult.start) > 0) {
    renderProfileView(authResult);
  } else {
    renderDefaultView();
  }
}


document.addEventListener('DOMContentLoaded', main);
```

##### Misc
In the case that the user has authenticate before, we automatically log the user in.
```js

// ./src/background.main.js
browser.runtime.onStartup.addListener(function () {
  if (humtum.getAuth().isAuthenticated() && humtum.getAuth().isValid()) {
    refreshthetoken()
    listenForMessage()
  }

  if (localStorage.webFilter) {
    JSON.parse(localStorage.webFilter).forEach(v => {
      filterWeb.set(v.key, v.value)
    })
  }
})

browser.runtime.onInstalled.addListener(function () {
  if (humtum.getAuth().isAuthenticated() && humtum.getAuth().isValid()) {
    refreshthetoken()
    listenForMessage()
  }

  if (localStorage.webFilter) {
    JSON.parse(localStorage.webFilter).forEach(v => {
      filterWeb.set(v.key, v.value)
    })
  }
})

```