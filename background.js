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

// Pastikan settings selalu ada
chrome.storage.sync.get('settings', (data) => {
  if (!data.settings) {
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }
});

// ============= SATU LISTENER UNTUK SEMUA =============
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
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
      // Broadcast ke semua tabs
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

  // === CHECK 2SV STATUS ===
if (request.action === 'check2SVStatus') {
  (async () => {
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

      // Filter hanya yang enabled: true
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

  // === CHECK XBOX ===
  if (request.action === 'checkXboxConnection') {
    (async () => {
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