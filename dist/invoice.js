(function () {
  'use strict';

  // ============= SHARED VARIABLES =============
  let lastCopied = '';
  let lastCellName = '';
  let toast = null;
  let activeObserver = null;
  let isProcessing = false;
  let settings = null;
  let initialized = false;

  // ============= LOAD SETTINGS FIRST =============
  function loadSettings(callback) {
    chrome.storage.sync.get('settings', (data) => {
      settings = data.settings;
      callback();
    });
  }

  // ============= LISTEN FOR UPDATES =============
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'settingsUpdated') {
      settings = request.settings;

      if (activeObserver) {
        activeObserver.disconnect();
        activeObserver = null;
      }

      // Hapus toast kalo disabled
      if (settings && settings.sheets.toastNotifications === false) {
        const existingToast = document.getElementById('invoice-toast');
        if (existingToast) existingToast.remove();
        toast = null;
      }

      // Re-init observer
      initOriginalFeatures();
    }
  });

  // ============= INIT =============
  loadSettings(() => {
    if (initialized) return;
    initialized = true;

    // Toast independen
    if (!settings || settings.sheets.toastNotifications !== false) {
      createToastElement();
    }

    // Auto copy & block kata JALAN TERUS
    initOriginalFeatures();
  });

  // ============= TOAST =============
  function createToastElement() {
    if (settings && settings.sheets.toastNotifications === false) return;

    const existing = document.getElementById('invoice-toast');
    if (existing) {
      toast = existing;
      return;
    }

    const div = document.createElement('div');
    div.id = 'invoice-toast';
    div.style.cssText = `
      position: fixed; bottom: 32px; right: 32px; background: #323232; color: white;
      padding: 12px 20px; border-radius: 8px; font-family: Arial, sans-serif;
      font-size: 14px; z-index: 99999; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 320px; word-break: break-all; transition: opacity 0.3s ease;
    `;
    document.body.appendChild(div);
    toast = div;
  }

  function showToast(message, color = '#323232') {
    // Cek dulu sebelum create
    if (settings && settings.sheets.toastNotifications === false) return;

    if (!toast) {
      if (settings && settings.sheets.toastNotifications === false) return;
      createToastElement();
    }

    if (!toast) return;

    toast.style.background = color;
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    if (toast._timeout) clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { if (toast) toast.style.display = 'none'; }, 300);
    }, 3000);
  }

  // ============= ORIGINAL FEATURES =============
  function initOriginalFeatures() {
    function getNameBox() {
      const el = document.querySelector('#t-name-box');
      return el ? el.value.trim() : null;
    }

    function getColumnFromCell(cellName) {
      if (!cellName) return null;
      const match = cellName.trim().match(/^([A-Z]+)\d+$/);
      return match ? match[1] : null;
    }

    function getFormulaBarValue() {
      const bar = document.querySelector('#t-formula-bar-input');
      if (!bar) return null;
      const inner = bar.querySelector('.cell-input');
      const raw = inner ? inner.textContent.trim() : bar.textContent.trim();
      return raw || null;
    }

    function copyToClipboard(text) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('✅ Copied: ' + text))
        .catch(() => showToast('❌ Gagal copy', '#c0392b'));
    }

    function processCurrentCell() {
      if (isProcessing) return;

      isProcessing = true;
      setTimeout(() => { isProcessing = false; }, 100);

      const cellName = getNameBox();
      const column = getColumnFromCell(cellName);

      if (!column || !['B', 'C', 'D'].includes(column)) {
        lastCellName = cellName || '';
        lastCopied = '';
        return;
      }

      const value = getFormulaBarValue();
      if (!value) return;

      if (cellName !== lastCellName) {
        lastCellName = cellName;
        lastCopied = '';
      }

      // Block "Axm" & "myx" JALAN TERUS meskipun auto copy OFF
      if (column === 'B' && (!settings || settings.sheets.blockAxm !== false)) {
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('axm')) {
          showToast('🚫 Diblok: mengandung "axm"', '#c0392b');
          return;
        }
        if (lowerValue.includes('myx')) {
          showToast('🚫 Diblok: mengandung "myx"', '#c0392b');
          return;
        }
      }

      // Kalo auto copy OFF, jangan copy tapi block kata tetap jalan
      if (settings && settings.sheets.autoCopy === false) return;

      if (value === lastCopied) return;

      lastCopied = value;
      copyToClipboard(value);
    }

    function startObserver() {
      const formulaBar = document.querySelector('#t-formula-bar-input');
      if (!formulaBar) {
        let retries = 0;
        const retryInterval = setInterval(() => {
          retries++;
          const el = document.querySelector('#t-formula-bar-input');
          if (el) {
            clearInterval(retryInterval);
            attachObserver(el);
          }
          else if (retries >= 60) {
            clearInterval(retryInterval);
          }
        }, 500);
        return;
      }
      attachObserver(formulaBar);
    }

    function attachObserver(formulaBar) {
      if (activeObserver) {
        activeObserver.disconnect();
        activeObserver = null;
      }
      activeObserver = new MutationObserver(() => {
        processCurrentCell();
      });
      activeObserver.observe(formulaBar, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    document.addEventListener('click', () => {
      setTimeout(processCurrentCell, 80);
    }, true);

    document.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.key)) {
        setTimeout(processCurrentCell, 80);
      }
    }, true);

    startObserver();
  }

})();