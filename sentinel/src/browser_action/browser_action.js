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