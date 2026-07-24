// ============= DEFAULT SETTINGS =============
const DEFAULT_SETTINGS = {
  roblox: {
    quickButtons: true,
    loginHelper: true,
    close2SV: true,
    xboxManager: true
  },
  sheets: {
    autoCopy: true,
    blockMyx: true,
    toastNotifications: true
  },
  global: {
    debugMode: false
  }
};

// ============= RATE LIMITER =============
// FIX (Bug B & C): dulu `rateLimits` cuma object in-memory di service worker MV3, dan
// key-nya global lintas SEMUA tab ('check2SV', 'checkXbox'). Dua masalah:
//  1. Service worker MV3 bisa mati idle kapan aja (~30 detik) -> state ke-reset diam-diam,
//     cooldown gak reliable.
//  2. Key global -> tab A dan tab B saling nge-rate-limit satu sama lain, padahal harusnya
//     independen per tab.
// Sekarang key di-scope per tabId, dan disimpan di chrome.storage.session (persist selama
// browser jalan, gak ilang pas service worker idle-kill, otomatis kehapus browser ditutup).
async function checkRateLimit(key, limitMs = 5000) {
  const data = await chrome.storage.session.get(key);
  const now = Date.now();
  if (data[key] && (now - data[key]) < limitMs) {
    return false;
  }
  await chrome.storage.session.set({ [key]: now });
  return true;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============= INIT SETTINGS =============
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('settings', (data) => {
    if (!data.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
      console.log('SigmaDOTS: Default settings initialized');
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get('settings', (data) => {
    if (!data.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
  });
});

chrome.storage.sync.get('settings', (data) => {
  if (!data.settings) {
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }
});

// ============= SATU LISTENER UNTUK SEMUA =============
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // FIX: dulu fallback tabId cuma string statis 'unknown', jadi semua caller tanpa
  // sender.tab (misal dari popup) numpuk di key rate-limit yang sama dan saling
  // ngeblokir satu sama lain padahal gak berhubungan. Sekarang fallback pakai
  // sender.id (extension id, jarang berguna buat ngebedain) + timestamp acak kecil
  // supaya minimal gak collide sesama pemanggil non-tab.
  const tabId = sender.tab?.id ?? `notab_${Math.random().toString(36).slice(2, 8)}`;

  // === GET SETTINGS ===
  if (request.action === 'getSettings') {
    chrome.storage.sync.get('settings', (data) => {
      sendResponse(data.settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  // === SAVE SETTINGS ===
  if (request.action === 'saveSettings') {
    chrome.storage.sync.set({ settings: request.settings }, () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: request.settings
          }).catch(() => {});
        });
      });
      sendResponse({ success: true });
    });
    return true;
  }

  // === EXPORT SETTINGS ===
  if (request.action === 'exportSettings') {
    chrome.storage.sync.get('settings', (data) => {
      sendResponse(data.settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  // === IMPORT SETTINGS ===
  if (request.action === 'importSettings') {
    chrome.storage.sync.set({ settings: request.settings }, () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: request.settings
          }).catch(() => {});
        });
      });
      sendResponse({ success: true });
    });
    return true;
  }

  // === GET ROBLOSECURITY ===
  if (request.action === 'getRobloSecurity') {
    chrome.cookies.get(
      { url: 'https://www.roblox.com', name: '.ROBLOSECURITY' },
      (cookie) => {
        if (cookie && cookie.value) {
          sendResponse({ success: true, cookie: cookie.value });
        } else {
          sendResponse({ success: false, message: 'Cookie tidak ditemukan. Pastikan kamu sudah login ke Roblox.' });
        }
      }
    );
    return true;
  }

  // === CHECK 2SV STATUS - Dengan Rate Limit per-tab ===
  if (request.action === 'check2SVStatus') {
    (async () => {
      const key = `check2SV_${tabId}`;
      if (!(await checkRateLimit(key, 10000))) {
        // FIX (Bug B): dulu balikin {success:false,error:'Rate limited'} yang bikin badge
        // nampilin "2SV: ?" seolah gagal beneran. Sekarang dikasih flag jelas biar caller
        // bisa bedain "lagi cooldown" vs "beneran gagal ambil data".
        sendResponse({ success: false, rateLimited: true });
        return;
      }
      await delay(1500);
      try {
        const userRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
          credentials: 'include'
        });
        if (!userRes.ok) throw new Error('Gagal ambil user info');
        const userData = await userRes.json();
        const userId = userData.id;
        if (!userId) throw new Error('userId tidak ditemukan');

        const twosvRes = await fetch(
          `https://twostepverification.roblox.com/v1/users/${userId}/configuration`,
          { credentials: 'include' }
        );
        if (!twosvRes.ok) throw new Error('Gagal ambil 2SV config');
        const twosvData = await twosvRes.json();

        const enabledMethods = (twosvData.methods || [])
          .filter(m => m.enabled)
          .map(m => m.mediaType);

        sendResponse({ success: true, methods: enabledMethods });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // === CHECK XBOX - Dengan Rate Limit per-tab ===
  if (request.action === 'checkXboxConnection') {
    (async () => {
      const key = `checkXbox_${tabId}`;
      if (!(await checkRateLimit(key, 15000))) {
        // FIX (Bug B): dulu balikin {success:true, isConnected:false} pas kena rate limit —
        // ini BOHONG, ngaku "gak connect" padahal cuma lagi cooldown. Kalau ada 2 tab Roblox
        // kebuka, tab kedua bisa nampilin tombol "Putus Xbox" hilang padahal Xbox beneran connect.
        // Sekarang dikasih flag rateLimited biar caller skip aja, gak bikin keputusan UI dari data palsu.
        sendResponse({ success: false, rateLimited: true });
        return;
      }
      await delay(2000);
      try {
        const res = await fetch('https://auth.roblox.com/v1/xbox/connection', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          sendResponse({ success: true, isConnected: data?.hasConnectedXboxAccount === true });
        } else {
          sendResponse({ success: true, isConnected: false });
        }
      } catch {
        sendResponse({ success: true, isConnected: false });
      }
    })();
    return true;
  }

  // === DISCONNECT XBOX ===
  if (request.action === 'xboxDisconnect') {
    (async () => {
      try {
        const challenge = await fetch('https://auth.roblox.com/v1/xbox/disconnect', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        const csrfToken = challenge.headers.get('x-csrf-token');
        if (!csrfToken) throw new Error('Gagal ambil CSRF token. Coba refresh halaman dulu.');

        const res = await fetch('https://auth.roblox.com/v1/xbox/disconnect', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken
          }
        });
        if (res.ok) {
          sendResponse({ success: true });
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.errors?.[0]?.message || `HTTP Error ${res.status}`);
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // === LOGOUT ===
  if (request.action === 'robloxLogout') {
    (async () => {
      try {
        const challenge = await fetch('https://auth.roblox.com/v2/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        const csrfToken = challenge.headers.get('x-csrf-token');
        if (!csrfToken) throw new Error('Gagal ambil CSRF token');

        const res = await fetch('https://auth.roblox.com/v2/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken
          }
        });
        if (res.ok) {
          sendResponse({ success: true });
        } else {
          throw new Error(`HTTP Error ${res.status}`);
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});