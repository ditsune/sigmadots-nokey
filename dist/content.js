(function () {
  'use strict';

  // ============= HEADER TEXT (fungsi lama) =============
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

  // ============= COPY DATA (fungsi baru) =============
  function getFieldValue(labelText) {
    const labels = document.querySelectorAll('span.uppercase');
    for (const label of labels) {
      if (label.textContent.trim() === labelText) {
        const container = label.closest('div');
        const valueSpan = container?.querySelector('span.truncate');
        return valueSpan ? valueSpan.textContent.trim() : null;
      }
    }
    return null;
  }

  function getBackupCodes() {
    const labels = Array.from(document.querySelectorAll('label'));
    const backupLabel = labels.find(l => l.textContent.trim() === 'Backup Codes');
    if (!backupLabel) return [];

    const grid = backupLabel.parentElement.querySelector('div.grid');
    if (!grid) return [];

    return Array.from(grid.querySelectorAll('span.font-mono'))
      .map(el => el.textContent.trim())
      .filter(Boolean);
  }

  function getRobuxAmount() {
    const labels = Array.from(document.querySelectorAll('label'));
    const itemsLabel = labels.find(l => l.textContent.trim().startsWith('Items'));
    if (!itemsLabel) return null;

    const itemCard = itemsLabel.parentElement.querySelector('p.text-xs.font-medium');
    return itemCard ? itemCard.textContent.trim() : null;
  }

  function buildCopyText() {
    const username = getFieldValue('Username') || '-';
    const password = getFieldValue('Password') || '-';
    const backupCodes = getBackupCodes().join(', ') || '-';
    const robux = getRobuxAmount() || '-';

    return `DETAIL PESANAN KAMU
✨ Jumlah Robux: \`${robux}\`
👤 Username: \`${username}\`
🔑 Password: \`${password}\`
🛡 Backup Code: \`${backupCodes}\``;
  }

function injectCopyButton() {
    if (document.getElementById('beruk-copy-data-btn')) return;

    const headings = Array.from(document.querySelectorAll('h2'));
    const modalHeading = headings.find(h => h.textContent.trim() === 'Edit Vilog Order');
    if (!modalHeading) return;

    const topRow = modalHeading.closest('div.flex.items-center.justify-between');
    if (!topRow) return;

    const closeBtn = topRow.lastElementChild;
    if (!closeBtn || closeBtn.tagName !== 'BUTTON') return;

    const btn = document.createElement('button');
    btn.id = 'beruk-copy-data-btn';
    btn.type = 'button';
    btn.textContent = 'Copy Data';
    btn.className = 'px-3 py-1.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#30363d] rounded-lg text-xs font-jakarta font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#21262d] transition-colors';

    btn.addEventListener('click', () => {
      const text = buildCopyText();
      navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 1500);
      }).catch(() => {
        const original = btn.textContent;
        btn.textContent = 'Gagal copy';
        setTimeout(() => { btn.textContent = original; }, 1500);
      });
    });

    // bungkus closeBtn + btn dalam satu wrapper, biar justify-between cuma anggap ini 1 grup
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; align-items:center; gap:8px;';

    // pindahin closeBtn ke dalam wrapper, lalu taruh btn sebelum closeBtn
    closeBtn.parentElement.insertBefore(wrapper, closeBtn);
    wrapper.appendChild(btn);
    wrapper.appendChild(closeBtn);
  }

  // ============= OBSERVER =============
  const observer = new MutationObserver(() => {
    injectHeaderText();
    injectCopyButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('load', () => {
    injectHeaderText();
    injectCopyButton();
  });

})();