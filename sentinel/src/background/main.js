import humtum from "/src/background/humtum.js"
import Auth from "/src/background/auth.js"


/* Message format
{
  website: string
  websitemsg: string
}
*/
const filterWeb = new LRUMap(100)
let authzero = null

function listenForMessage() {
  humtum.getCable().subscriptions.subscriptions.forEach(e => {
    humtum.getCable().subscriptions.remove(e)
  })
  humtum.subscribeToChannel(
    "MessagesChannel",
    () => {
      console.log("Connected to Message channel")
    },
    () => {

    },
    (data) => {
      data = JSON.parse(data)
      const {
        website,
        websitemsg
      } = data && data["payload"] && JSON.parse(data["payload"])
      console.log(data["payload"])
      filterWeb.set(website, websitemsg)
      humtum.receiveMessage(data["id"])
      localStorage.webFilter = JSON.stringify(filterWeb.toJSON())


    })
}

function refreshthetoken() {
  authzero = new Auth0Chrome(env.AUTH0_DOMAIN, env.AUTH0_CLIENT_ID)
  authzero.refreshToken(humtum.getAuth().getRefreshToken())
    .then(async (authResult) => {
      humtum.getAuth().storeAuthResult(authResult)
      humtum.getAuth().scheduleRenewal(refreshthetoken)
    })
}

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

browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  const {
    url
  } = changeInfo;

  if (url) {
    const pathArray = url.split('/')
    const protocol = pathArray[0];
    const host = pathArray[2];
    const weburl = protocol + '//' + host;
    const msg = filterWeb.get(weburl)
    if (msg) {
      chrome.notifications.create({
        type: 'basic',
        title: 'Notification',
        message: msg,
        iconUrl: '/icons/icon128.png'
      });
      filterWeb.delete(weburl)
      localStorage.webFilter = JSON.stringify(filterWeb.toJSON())
    }
  }
})