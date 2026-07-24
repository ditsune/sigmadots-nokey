(function () {
  'use strict';

  // ============= SETTINGS =============
  let settings = null;

  // ============= DEBOUNCE =============
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function isExtensionValid() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  }

  function safeSendMessage(msg, callback) {
    if (!isExtensionValid()) { callback && callback(null); return; }
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) { callback && callback(null); return; }
        callback && callback(response);
      });
    } catch { callback && callback(null); }
  }

  function ensureToastStyles() {
    if (document.getElementById('rbx-toast-style')) return;
    const style = document.createElement('style');
    style.id = 'rbx-toast-style';
    style.textContent = `
      @keyframes rbxSlideIn  { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes rbxSlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100px); opacity: 0; } }
    `;
    document.head.appendChild(style);
  }

  function showToast(message, type) {
    ensureToastStyles();
    document.querySelector('.rbx-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'rbx-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 90px; right: 20px; z-index: 999999;
      padding: 10px 16px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white; border-radius: 8px;
      font-family: "Builder Sans", sans-serif;
      font-size: 13px; font-weight: 500; max-width: 250px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      animation: rbxSlideIn 0.3s ease; pointer-events: none;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'rbxSlideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ==================== QUICK BUTTONS ====================
  // FIX (leak): ResizeObserver & resize-listener dulu dibikin baru setiap kali
  // injectQuickButtonsV2() jalan tanpa pernah di-disconnect saat cleanupAll(),
  // jadi numpuk terus tiap siklus login/logout dalam 1 sesi SPA. Sekarang disimpan
  // di scope module dan di-disconnect eksplisit di cleanupAll().
  let quickButtonsRO = null;
  let quickButtonsResizeHandler = null;

  function injectQuickButtonsV2() {
    if (document.getElementById('rbx-quick-buttons-wrapper')) return;

    const navbar = document.querySelector('#navigation-container')
      || document.querySelector('#rbx-navbar')
      || document.querySelector('nav')
      || document.querySelector('header');

    if (!navbar) return;

    const baseBtnStyle = `
      padding: 3px 8px;
      font-family: "Builder Sans", "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif;
      font-size: 12px; font-weight: 500; line-height: 1.2;
      cursor: pointer; user-select: none;
      border: 1px solid var(--color-action-standard-border, #bcbec8);
      border-radius: 8px;
      background-color: var(--color-action-standard-background, #fff);
      color: var(--color-action-standard-foreground, #121215);
      white-space: nowrap; display: inline-block; vertical-align: middle;
    `;

    const wrapper = document.createElement('div');
    wrapper.id = 'rbx-quick-buttons-wrapper';
    wrapper.style.cssText = `
      position: fixed;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 99999;
      visibility: hidden;
    `;

    // Xbox slot
    const xboxSlot = document.createElement('span');
    xboxSlot.id = 'rbx-xbox-btn-slot';
    wrapper.appendChild(xboxSlot);

    // 2SV Badge
    const twosvBadge = document.createElement('span');
    twosvBadge.id = 'rbx-2sv-badge';
    twosvBadge.textContent = '2SV: ...';
    twosvBadge.style.cssText = `
      font-family: "Builder Sans", sans-serif;
      font-size: 11px; font-weight: 600;
      padding: 2px 7px; border-radius: 6px;
      color: white; white-space: nowrap;
      background: #6b7280;
    `;
    wrapper.appendChild(twosvBadge);

    safeSendMessage({ action: 'check2SVStatus' }, (response) => {
      const badge = document.getElementById('rbx-2sv-badge');
      if (!badge) return;
      if (response?.rateLimited) {
        badge.textContent = '2SV: ...';
        return; // FIX: jangan tampilin status palsu pas lagi rate-limited
      }
      if (!response?.success) {
        badge.textContent = '2SV: ?';
        badge.style.background = '#6b7280';
        return;
      }
      const methods = (response.methods || []).map(m => String(m));
      const has = (name) => methods.some(m => m.toLowerCase() === name.toLowerCase());

      if (methods.length === 0) {
        badge.textContent = '⚠️ No 2SV';
        badge.style.background = '#dc2626';
      } else if (has('Authenticator')) {
        badge.textContent = '📱 Auth App';
        badge.style.background = '#0284c7';
      } else if (has('SMS')) {
        badge.textContent = '📟 SMS 2SV';
        badge.style.background = '#0891b2';
      } else if (has('Email')) {
        badge.textContent = '📧 Email 2SV';
        badge.style.background = '#059669';
      } else if (has('RecoveryCode')) {
        badge.textContent = '🔑 Recovery Code';
        badge.style.background = '#7c3aed';
      } else {
        badge.textContent = '⚠️ No 2SV';
        badge.style.background = '#dc2626';
      }
    });

    // Ambil Cookies
    const cookieBtn = document.createElement('button');
    cookieBtn.textContent = 'Ambil Cookies';
    cookieBtn.style.cssText = baseBtnStyle;
    cookieBtn.onmouseenter = () => cookieBtn.style.opacity = '0.8';
    cookieBtn.onmouseleave = () => cookieBtn.style.opacity = '1';
    cookieBtn.onclick = () => {
      safeSendMessage({ action: 'getRobloSecurity' }, async (response) => {
        if (!response) { showToast('❌ Tidak ada response.', 'error'); return; }
        if (response.success) {
          try {
            await navigator.clipboard.writeText(response.cookie);
            showToast('✅ Cookie berhasil dicopy!', 'success');
          } catch {
            showToast('⚠️ Gagal auto-copy, cek console.', 'error');
          }
        } else {
          showToast('❌ ' + (response.message || 'Gagal mengambil cookie'), 'error');
        }
      });
    };
    wrapper.appendChild(cookieBtn);

    // Logout
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Logout';
    logoutBtn.style.cssText = baseBtnStyle;
    logoutBtn.onmouseenter = () => logoutBtn.style.opacity = '0.8';
    logoutBtn.onmouseleave = () => logoutBtn.style.opacity = '1';
    logoutBtn.onclick = () => {
      observer.disconnect();
      safeSendMessage({ action: 'robloxLogout' }, (response) => {
        if (response?.success === false) {
          observer.observe(document.body, observerConfig);
          showToast('❌ Logout gagal: ' + (response?.error || 'Unknown'), 'error');
          return;
        }
        window.location.href = 'https://www.roblox.com/login';
      });
    };
    wrapper.appendChild(logoutBtn);

    document.body.appendChild(wrapper);

    function updatePosition() {
      const el = document.getElementById('rbx-quick-buttons-wrapper');
      if (!el) return;

      const nav = document.querySelector('#navigation-container')
        || document.querySelector('#rbx-navbar')
        || document.querySelector('nav')
        || document.querySelector('header');

      // FIX: dulu kalau navbar belum ketemu, function return early dan wrapper
      // nyangkut `visibility: hidden` selamanya (gak ada retry). Sekarang di-retry.
      if (!nav) { setTimeout(updatePosition, 300); return; }

      const navRect = nav.getBoundingClientRect();
      const PADDING = 8;
      const top = Math.round(navRect.bottom) + 4;

      el.style.top = top + 'px';
      el.style.right = PADDING + 'px';
      el.style.visibility = 'visible';
    }

    updatePosition();

    // FIX: disconnect observer/listener lama sebelum bikin yang baru (cegah leak)
    quickButtonsRO?.disconnect();
    quickButtonsRO = new ResizeObserver(() => updatePosition());
    quickButtonsRO.observe(navbar);
    quickButtonsRO.observe(document.documentElement);

    if (quickButtonsResizeHandler) window.removeEventListener('resize', quickButtonsResizeHandler);
    quickButtonsResizeHandler = updatePosition;
    window.addEventListener('resize', quickButtonsResizeHandler);

    if (!settings || settings.roblox.xboxManager !== false) {
      checkXboxConnection((isConnected) => {
        if (isConnected === null) return; // rate-limited, skip diem-diem, jangan asumsi apapun
        const slot = document.getElementById('rbx-xbox-btn-slot');
        if (!isConnected || !slot) return;
        const xboxBtn = document.createElement('button');
        xboxBtn.textContent = 'Putus Xbox';
        xboxBtn.style.cssText = baseBtnStyle;
        xboxBtn.onmouseenter = () => xboxBtn.style.opacity = '0.8';
        xboxBtn.onmouseleave = () => xboxBtn.style.opacity = '1';
        xboxBtn.onclick = () => {
          safeSendMessage({ action: 'xboxDisconnect' }, (response) => {
            if (response?.success) {
              showToast('✅ Xbox berhasil diputus!', 'success');
              setTimeout(() => location.reload(), 1000);
            } else {
              showToast('❌ Gagal putus Xbox: ' + (response?.error || 'Unknown'), 'error');
            }
          });
        };
        slot.replaceWith(xboxBtn);
      });
    }
  }

  function checkXboxConnection(callback) {
    safeSendMessage({ action: 'checkXboxConnection' }, (response) => {
      // FIX: dulu rate-limited dibalas seolah-olah `isConnected:false` (bohong).
      // Sekarang caller dapet `null` supaya gak bikin keputusan UI dari data palsu.
      if (!response || response.rateLimited) { callback(null); return; }
      callback(response.success ? response.isConnected : false);
    });
  }

  // ==================== CLOSE 2SV ====================
  function initClose2SVButton() {
    if (document.getElementById('rbx-floating-close-2sv')) return;
    let pollingInterval = null;

    function isElementVisible(el) {
      if (!el || !el.isConnected) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    const TWOSV_TEXT_PATTERN = /2-step verification|2 step verification|two-step verification|verifikasi 2 langkah|verifikasi dua langkah|enter.{0,15}(code|kode)|masukkan kode/i;
    const OVERLAY_SELECTORS = [
      '.foundation-web-dialog-overlay',
      '[class*="dialog-overlay"]',
      '[class*="modal-overlay"]',
      '[class*="Overlay"]',
      '[role="dialog"]',
      '[role="alertdialog"]'
    ];

    function findTwoSVOverlay() {
      const candidates = new Set();
      OVERLAY_SELECTORS.forEach(sel => {
        try { document.querySelectorAll(sel).forEach(el => candidates.add(el)); } catch {}
      });

      for (const el of candidates) {
        if (!isElementVisible(el)) continue;
        const text = el.textContent || '';
        if (TWOSV_TEXT_PATTERN.test(text)) return el;
      }
      return null;
    }

    function is2SVPresent() {
      return !!findTwoSVOverlay();
    }

    const CLOSE_BTN_SELECTORS = [
      '.modal-modern-header-button',
      'button[aria-label="Close"]',
      'button[aria-label="close"]',
      'button[aria-label="Tutup"]',
      '[data-testid="modal-close-button"]',
      '[data-testid*="close"]',
      'button.icon-close',
      '.icon-close-thin',
      '.close-button',
      'button.modal-close'
    ];

    function findCloseButton(overlay) {
      for (const sel of CLOSE_BTN_SELECTORS) {
        const btn = overlay.querySelector(sel);
        if (btn) return btn;
      }
      return null;
    }

    function closeTwoStepVerification() {
      const overlay = findTwoSVOverlay();
      if (!overlay) { showToast('❌ Popup 2SV tidak ditemukan', 'error'); return; }

      const closeBtn = findCloseButton(overlay);
      if (closeBtn) {
        ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(t =>
          closeBtn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))
        );
        closeBtn.click();
      }
      setTimeout(() => {
        const stillThere = findTwoSVOverlay();
        if (stillThere) {
          stillThere.remove();
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
          document.body.removeAttribute('data-scroll-locked');
          document.querySelectorAll('[data-radix-focus-guard]').forEach(el => el.remove());
        }
        updateVisibility();
        if (!is2SVPresent()) showToast('✅ 2SV popup berhasil ditutup!', 'success');
      }, 200);
    }

    const container = document.createElement('div');
    container.id = 'rbx-floating-close-2sv';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;display:none;';
    const btn = document.createElement('button');
    btn.textContent = '✕ Close 2SV';
    btn.style.cssText = `
      padding: 10px 20px; font-family: "Builder Sans", sans-serif;
      font-size: 14px; font-weight: 600; border: none; border-radius: 8px;
      cursor: pointer; color: white; background: #dc2626;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); white-space: nowrap; transition: all 0.2s ease;
    `;
    btn.onmouseenter = () => { btn.style.background = '#b91c1c'; btn.style.transform = 'translateY(-1px)'; };
    btn.onmouseleave = () => { btn.style.background = '#dc2626'; btn.style.transform = 'translateY(0)'; };
    btn.onclick = closeTwoStepVerification;
    container.appendChild(btn);
    document.body.appendChild(container);

    function updateVisibility() {
      if (!document.getElementById('rbx-floating-close-2sv')) { clearInterval(pollingInterval); return; }
      container.style.display = is2SVPresent() ? 'block' : 'none';
    }

    updateVisibility();
    pollingInterval = setInterval(updateVisibility, 500);
    window.addEventListener('beforeunload', () => clearInterval(pollingInterval));
  }

  // ==================== FORM BUTTONS ====================
  let formCurrentStep = 0;

  function injectFormButtons() {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const loginButton = document.getElementById('login-button');
    if (!usernameInput || !passwordInput || !loginButton) return false;

    const existing = document.getElementById('rbx-form-buttons');
    if (existing && loginButton.parentNode.contains(existing)) return true;
    existing?.remove();

    if (usernameInput.value && passwordInput.value) formCurrentStep = 2;
    else if (usernameInput.value) formCurrentStep = 1;
    else formCurrentStep = 0;

    const container = document.createElement('div');
    container.id = 'rbx-form-buttons';
    container.style.cssText = 'display:flex;gap:8px;width:100%;margin-top:10px;margin-bottom:10px;';

    const baseStyle = `
      flex: 1; padding: 10px 0;
      font-family: "Builder Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 14px; font-weight: 600; border: none; border-radius: 8px;
      cursor: pointer; color: white; transition: all 0.2s ease; text-align: center;
    `;

    function stepMeta(step) {
      if (step === 0) return { label: '📋 Paste Usn', bg: '#335fff' };
      if (step === 1) return { label: '🔐 Paste PW', bg: '#f59e0b' };
      return { label: 'Gas Login', bg: '#10b981' };
    }

    const pasteBtn = document.createElement('button');
    pasteBtn.id = 'rbx-paste-btn';
    pasteBtn.type = 'button';

    function syncPasteBtn() {
      const { label, bg } = stepMeta(formCurrentStep);
      pasteBtn.innerHTML = label;
      pasteBtn.style.background = bg;
    }

    pasteBtn.style.cssText = baseStyle + `background:${stepMeta(formCurrentStep).bg};`;
    syncPasteBtn();
    pasteBtn.onmouseenter = () => { pasteBtn.style.opacity = '0.9'; pasteBtn.style.transform = 'translateY(-1px)'; };
    pasteBtn.onmouseleave = () => { pasteBtn.style.opacity = '1'; pasteBtn.style.transform = 'translateY(0)'; };

    pasteBtn.onclick = async (e) => {
      e.preventDefault(); e.stopPropagation();
      const u = document.getElementById('login-username');
      const p = document.getElementById('login-password');
      if (!u || !p) { showToast('❌ Form tidak ditemukan', 'error'); return; }

      if (formCurrentStep === 0) {
        try {
          const text = (await navigator.clipboard.readText()).trim();
          if (!text) { showToast('⚠️ Clipboard kosong!', 'error'); return; }
          u.value = text;
          u.dispatchEvent(new Event('input', { bubbles: true }));
          u.dispatchEvent(new Event('change', { bubbles: true }));
          u.focus(); formCurrentStep = 1; syncPasteBtn();
          showToast('✅ Username dipaste!', 'success');
        } catch { showToast('❌ Gagal baca clipboard', 'error'); }
      } else if (formCurrentStep === 1) {
        try {
          const text = (await navigator.clipboard.readText()).trim();
          if (!text) { showToast('⚠️ Clipboard kosong!', 'error'); return; }
          p.value = text;
          p.dispatchEvent(new Event('input', { bubbles: true }));
          p.dispatchEvent(new Event('change', { bubbles: true }));
          p.focus(); formCurrentStep = 2; syncPasteBtn();
          showToast('✅ Password dipaste!', 'success');
        } catch { showToast('❌ Gagal baca clipboard', 'error'); }
      } else {
        const loginBtn = document.getElementById('login-button');
        if (loginBtn) {
          pasteBtn.style.transform = 'scale(0.95)';
          setTimeout(() => { pasteBtn.style.transform = 'translateY(0)'; }, 150);
          loginBtn.click();
          showToast('🚀 Otewe Login!', 'success');
        } else {
          showToast('❌ Tombol login tidak ditemukan', 'error');
        }
      }
    };

    const clearBtn = document.createElement('button');
    clearBtn.id = 'rbx-clear-btn';
    clearBtn.type = 'button';
    clearBtn.innerHTML = '🗑️ Clear';
    clearBtn.style.cssText = baseStyle + 'background:#6b7280;';
    clearBtn.onmouseenter = () => { clearBtn.style.opacity = '0.9'; clearBtn.style.transform = 'translateY(-1px)'; };
    clearBtn.onmouseleave = () => { clearBtn.style.opacity = '1'; clearBtn.style.transform = 'translateY(0)'; };
    clearBtn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const u = document.getElementById('login-username');
      const p = document.getElementById('login-password');
      if (!u || !p) { showToast('❌ Form tidak ditemukan', 'error'); return; }
      u.value = ''; u.dispatchEvent(new Event('input', { bubbles: true })); u.dispatchEvent(new Event('change', { bubbles: true }));
      p.value = ''; p.dispatchEvent(new Event('input', { bubbles: true })); p.dispatchEvent(new Event('change', { bubbles: true }));
      formCurrentStep = 0; syncPasteBtn(); u.focus();
      showToast('🗑️ Form berhasil diclear!', 'success');
    };

    container.appendChild(pasteBtn);
    container.appendChild(clearBtn);
    loginButton.parentNode.insertBefore(container, loginButton);
    return true;
  }

  // ==================== LOGIN FORM WATCHER ====================
  let loginFormObserver = null;
  let loginFormGuardInterval = null;

  function startLoginFormWatcher() {
    stopLoginFormWatcher();
    loginFormObserver = new MutationObserver(() => {
      if (!isLoginPage()) { stopLoginFormWatcher(); return; }
      const loginBtn = document.getElementById('login-button');
      if (!loginBtn) return;
      const existing = document.getElementById('rbx-form-buttons');
      if (existing && loginBtn.parentNode.contains(existing)) return;
      setTimeout(() => { if (isLoginPage()) injectFormButtons(); }, 80);
    });
    loginFormObserver.observe(document.body, { childList: true, subtree: true });

    loginFormGuardInterval = setInterval(() => {
      if (!isLoginPage()) { stopLoginFormWatcher(); return; }
      const loginBtn = document.getElementById('login-button');
      const formBtns = document.getElementById('rbx-form-buttons');
      if (loginBtn && (!formBtns || !loginBtn.parentNode.contains(formBtns))) injectFormButtons();
    }, 800);
  }

  function stopLoginFormWatcher() {
    loginFormObserver?.disconnect();
    loginFormObserver = null;
    clearInterval(loginFormGuardInterval);
    loginFormGuardInterval = null;
  }

  // ==================== HELPERS ====================
  function initQuickButtonsWithRetry(maxRetries = 40, interval = 300) {
    let retries = 0;
    function tryInject() {
      if (document.getElementById('rbx-quick-buttons-wrapper')) return;
      const navExists = document.querySelector('#navigation-container')
        || document.querySelector('#rbx-navbar')
        || document.querySelector('nav')
        || document.querySelector('header');
      if (navExists) { injectQuickButtonsV2(); return; }
      if (++retries < maxRetries) setTimeout(tryInject, interval);
    }
    tryInject();
  }

  function isLoginPage() {
    return /^(\/[a-z]{2}(-[a-z]{2})?)?\/login$/i.test(window.location.pathname);
  }

  // FIX (Bug A): `.ROBLOSECURITY` itu HttpOnly, `document.cookie` gak akan PERNAH bisa baca dia.
  // Kondisi lama itu dead code (selalu false), dihapus.
  function isLoggedIn() {
    return !!(
      document.querySelector('.rbx-userchip') ||
      document.querySelector('.icon-nav-avatar') ||
      document.querySelector('#navbar-setting') ||
      document.querySelector('.avatar-card-image') ||
      document.querySelector('.profile-avatar-thumb')
    );
  }

  function cleanupAll() {
    document.getElementById('rbx-form-buttons')?.remove();
    document.getElementById('rbx-quick-buttons-wrapper')?.remove();
    document.getElementById('rbx-floating-close-2sv')?.remove();

    // FIX (Bug E): disconnect RO & remove resize listener supaya gak numpuk tiap cycle
    quickButtonsRO?.disconnect();
    quickButtonsRO = null;
    if (quickButtonsResizeHandler) {
      window.removeEventListener('resize', quickButtonsResizeHandler);
      quickButtonsResizeHandler = null;
    }
  }

  // ==================== INIT ALL ====================
  function initAll() {
    cleanupAll();
    stopLoginFormWatcher();

    if (!settings) return;

    if (isLoginPage()) {
      if (settings.roblox.close2SV) initClose2SVButton();
      if (settings.roblox.loginHelper) {
        injectFormButtons();
        startLoginFormWatcher();
      }
      document.getElementById('rbx-quick-buttons-wrapper')?.remove();
    } else if (isLoggedIn()) {
      if (settings.roblox.quickButtons) {
        initQuickButtonsWithRetry();
      }
      document.getElementById('rbx-form-buttons')?.remove();
      document.getElementById('rbx-floating-close-2sv')?.remove();
    } else {
      cleanupAll();
    }
  }

  // ==================== LISTENERS ====================
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'settingsUpdated') {
      settings = request.settings;
      initAll();
    }
  });

  function loadAndInit() {
    chrome.storage.sync.get('settings', (data) => {
      settings = data.settings;
      if (!settings) {
        setTimeout(loadAndInit, 500);
        return;
      }
      initAll();
    });
  }

  setTimeout(loadAndInit, 100);

  // ==================== SPA NAVIGATION ====================
  (function patchHistory() {
    const _push = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    history.pushState = function (...args) { _push(...args); window.dispatchEvent(new Event('rbx-locationchange')); };
    history.replaceState = function (...args) { _replace(...args); window.dispatchEvent(new Event('rbx-locationchange')); };
  })();

  // ==================== OBSERVER ====================
  const debouncedCheck = debounce(() => {
    if (!settings) return;

    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) { lastPath = currentPath; initAll(); return; }

    if (isLoginPage()) {
      if (settings.roblox.close2SV) {
        if (!document.getElementById('rbx-floating-close-2sv')) initClose2SVButton();
      }
      if (settings.roblox.loginHelper) {
        const loginBtn = document.getElementById('login-button');
        const formBtns = document.getElementById('rbx-form-buttons');
        if (loginBtn && (!formBtns || !loginBtn.parentNode.contains(formBtns))) injectFormButtons();
      }
      document.getElementById('rbx-quick-buttons-wrapper')?.remove();
    } else if (isLoggedIn()) {
      if (settings.roblox.quickButtons) {
        const quickEl = document.getElementById('rbx-quick-buttons-wrapper');
        if (!quickEl || !document.body.contains(quickEl)) initQuickButtonsWithRetry(40, 300);
      }
      document.getElementById('rbx-form-buttons')?.remove();
      document.getElementById('rbx-floating-close-2sv')?.remove();
    } else {
      document.getElementById('rbx-quick-buttons-wrapper')?.remove();
      document.getElementById('rbx-form-buttons')?.remove();
      document.getElementById('rbx-floating-close-2sv')?.remove();
    }
  }, 400);

  let lastPath = window.location.pathname;
  const observerConfig = { childList: true, subtree: true };
  const observer = new MutationObserver(debouncedCheck);
  observer.observe(document.body, observerConfig);

  window.addEventListener('popstate', () => { lastPath = ''; setTimeout(initAll, 100); });
  window.addEventListener('rbx-locationchange', () => { lastPath = ''; setTimeout(initAll, 100); });

})();