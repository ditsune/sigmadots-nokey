(function () {
  'use strict';

  function injectHeaderText() {
    const header = document.querySelector('header.sticky');
    if (!header || document.getElementById('beruk-header-text')) return;

    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&display=swap';
    document.head.appendChild(fontLink);

    const style = document.createElement('style');
    style.textContent = `
      #beruk-header-text {
        font-family: 'Cherry Bomb One', cursive;
        font-size: 24px;
        background: linear-gradient(146.14deg, #fe86a2 8.01%, #fdb1c3 56.57%, #ff9bb3 74.39%, #ff7797 100.68%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(-1px -1px #fff) drop-shadow(1px -1px #fff) drop-shadow(-1px 1px #fff) drop-shadow(1px 1px #fff);
        position: absolute;
        left: 40px;
        transform: none;
        white-space: nowrap;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    const text = document.createElement('span');
    text.id = 'beruk-header-text';
    text.textContent = 'Dits The Great';

    header.style.position = 'relative';
    header.appendChild(text);
  }

  const observer = new MutationObserver(() => {
    injectHeaderText();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('load', () => {
    injectHeaderText();
  });

})();