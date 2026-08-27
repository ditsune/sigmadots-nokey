// ============= SETTINGS MAP =============
const SETTINGS_MAP = {
  'roblox-quickButtons': { category: 'roblox', key: 'quickButtons' },
  'roblox-loginHelper': { category: 'roblox', key: 'loginHelper' },
  'roblox-close2SV': { category: 'roblox', key: 'close2SV' },
  'roblox-xboxManager': { category: 'roblox', key: 'xboxManager' },
  'sheets-autoCopy': { category: 'sheets', key: 'autoCopy' },
  'sheets-blockAxm': { category: 'sheets', key: 'blockAxm' },
  'sheets-toastNotifications': { category: 'sheets', key: 'toastNotifications' },
  'global-debugMode': { category: 'global', key: 'debugMode' }
};

const DEFAULT_SETTINGS = {
  roblox: {
    quickButtons: true,
    loginHelper: true,
    close2SV: true,
    xboxManager: true
  },
  sheets: {
    autoCopy: true,
    blockAxm: true,
    toastNotifications: true
  },
  global: {
    debugMode: false
  }
};

let currentSettings = null;

// ============= INIT =============
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup opened, loading settings...');

  // Load settings dengan fallback
  currentSettings = await loadSettings();

  // Fallback kalo gagal load
  if (!currentSettings || !currentSettings.roblox) {
    console.warn('Settings invalid, using defaults');
    currentSettings = DEFAULT_SETTINGS;
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: DEFAULT_SETTINGS
    });
    showStatus('⚠️ Reset to defaults');
  }

  console.log('Settings:', currentSettings);

  // Apply to UI
  let appliedCount = 0;
  Object.entries(SETTINGS_MAP).forEach(([elementId, path]) => {
    const checkbox = document.getElementById(elementId);
    if (checkbox && currentSettings[path.category]) {
      checkbox.checked = currentSettings[path.category][path.key];
      appliedCount++;

      checkbox.addEventListener('change', async (e) => {
        await updateSetting(path.category, path.key, e.target.checked);
        showStatus('✓ Saved');
      });
    } else {
      console.warn(`Missing: #${elementId}`);
    }
  });

  console.log(`Applied ${appliedCount} checkboxes`);

  document.getElementById('btnExport')?.addEventListener('click', exportSettings);
  document.getElementById('btnImport')?.addEventListener('click', importSettings);
});

// ============= LOAD SETTINGS =============
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Load error:', chrome.runtime.lastError);
        resolve(DEFAULT_SETTINGS);
        return;
      }
      resolve(response || DEFAULT_SETTINGS);
    });
  });
}

// ============= UPDATE SETTING =============
async function updateSetting(category, key, value) {
  if (!currentSettings) {
    console.error('No settings object');
    return;
  }

  if (!currentSettings[category]) {
    console.error(`Category ${category} not found`);
    return;
  }

  currentSettings[category][key] = value;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: currentSettings
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Save error:', chrome.runtime.lastError);
        showStatus('❌ Error saving');
        resolve(false);
        return;
      }
      resolve(response);
    });
  });
}

// ============= EXPORT =============
async function exportSettings() {
  try {
    const settings = await loadSettings();
    if (!settings) {
      showStatus('❌ No settings');
      return;
    }

    const json = JSON.stringify(settings, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      showStatus('✅ Copied!');
    } catch {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sigmadots-settings.json';
      a.click();
      URL.revokeObjectURL(url);
      showStatus('📥 Downloaded');
    }
  } catch (err) {
    console.error('Export error:', err);
    showStatus('❌ Export failed');
  }
}

// ============= IMPORT =============
async function importSettings() {
  try {
    const text = await navigator.clipboard.readText();
    const settings = JSON.parse(text);

    // Validate & merge dengan default
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid format');
    }

    const merged = {
      roblox: { ...DEFAULT_SETTINGS.roblox, ...(settings.roblox || {}) },
      sheets: { ...DEFAULT_SETTINGS.sheets, ...(settings.sheets || {}) },
      global: { ...DEFAULT_SETTINGS.global, ...(settings.global || {}) }
    };

    await chrome.runtime.sendMessage({
      action: 'importSettings',
      settings: merged
    });

    currentSettings = merged;

    Object.entries(SETTINGS_MAP).forEach(([elementId, path]) => {
      const checkbox = document.getElementById(elementId);
      if (checkbox) {
        checkbox.checked = merged[path.category][path.key];
      }
    });

    showStatus('✅ Imported!');
  } catch {
    // Fallback: file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const settings = JSON.parse(event.target.result);

          const merged = {
            roblox: { ...DEFAULT_SETTINGS.roblox, ...(settings.roblox || {}) },
            sheets: { ...DEFAULT_SETTINGS.sheets, ...(settings.sheets || {}) },
            global: { ...DEFAULT_SETTINGS.global, ...(settings.global || {}) }
          };

          await chrome.runtime.sendMessage({
            action: 'importSettings',
            settings: merged
          });

          currentSettings = merged;
          Object.entries(SETTINGS_MAP).forEach(([elementId, path]) => {
            const checkbox = document.getElementById(elementId);
            if (checkbox) {
              checkbox.checked = merged[path.category][path.key];
            }
          });

          showStatus('✅ Imported!');
        } catch {
          showStatus('❌ Invalid file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}

// ============= SHOW STATUS =============
function showStatus(message) {
  const statusEl = document.getElementById('statusText');
  if (!statusEl) return;

  statusEl.textContent = message;

  if (message.includes('✅') || message.includes('✓')) {
    statusEl.style.color = '#4ade80';
  } else if (message.includes('❌') || message.includes('⚠️')) {
    statusEl.style.color = '#f87171';
  } else {
    statusEl.style.color = '#8b949e';
  }

  setTimeout(() => {
    statusEl.textContent = 'Auto-saved';
    statusEl.style.color = '#8b949e';
  }, 2000);
}