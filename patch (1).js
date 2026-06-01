/**
 * patch.js — JEE Tracker sync simplification
 *
 * Drop this <script> AFTER the main tracker script:
 *   <script src="patch.js"></script>
 *
 * What it does:
 *  • Hides the Supabase URL and API-key fields — users only enter their name.
 *  • Auto-wires the preset credentials so sync still works unchanged.
 *  • Rewrites the modal copy to plain language.
 *  • Removes the SQL-setup hint block.
 */

(function () {
  /* ── 1. Inject style overrides ── */
  const style = document.createElement('style');
  style.textContent = `
    /* Hide URL, key rows and the SQL hint */
    #_sb-url-row,
    #_sb-key-row,
    .modal-hint { display: none !important; }

    /* Friendlier label colour */
    #_sb-name-label { color: var(--text2); }
  `;
  document.head.appendChild(style);

  /* ── 2. Rewrite modal HTML once DOM is ready ── */
  function patchModal() {
    const modal = document.getElementById('supabaseModal');
    if (!modal) return;

    /* Update title & description */
    const title = modal.querySelector('.modal-title');
    if (title) title.textContent = '☁ Cloud Sync';

    const sub = modal.querySelector('.modal-sub');
    if (sub) sub.textContent =
      'Enter your name to sync progress across devices. ' +
      'Both JEE Main and Advanced data are saved separately.';

    /* Wrap URL row so we can hide it */
    const sbUrlInput = document.getElementById('sbUrl');
    const sbKeyInput = document.getElementById('sbKey');

    if (sbUrlInput) {
      const urlLabel = sbUrlInput.previousElementSibling;
      const wrap = document.createElement('div');
      wrap.id = '_sb-url-row';
      sbUrlInput.parentNode.insertBefore(wrap, urlLabel);
      wrap.appendChild(urlLabel);
      wrap.appendChild(sbUrlInput);
    }

    if (sbKeyInput) {
      const keyLabel = sbKeyInput.previousElementSibling;
      const wrap = document.createElement('div');
      wrap.id = '_sb-key-row';
      sbKeyInput.parentNode.insertBefore(wrap, keyLabel);
      wrap.appendChild(keyLabel);
      wrap.appendChild(sbKeyInput);
    }

    /* Rename the User ID label */
    const sbUserInput = document.getElementById('sbUser');
    if (sbUserInput) {
      const userLabel = sbUserInput.previousElementSibling;
      if (userLabel) {
        userLabel.id = '_sb-name-label';
        userLabel.innerHTML = 'Your Name';
      }
      sbUserInput.placeholder = 'e.g. Rohan';
    }

    /* Update button text */
    const connectBtn = document.getElementById('sbConnectBtn');
    if (connectBtn) connectBtn.textContent = 'Sync';

    /* Update footer sync-settings button label */
    const footerBtn = document.querySelector('footer .btn');
    if (footerBtn) footerBtn.textContent = '☁ Sync';
  }

  /* ── 3. Override openSupabaseModal — pre-fill credentials silently ── */
  const _origOpen = window.openSupabaseModal;
  window.openSupabaseModal = function () {
    // Inject preset creds before the modal reads them
    const urlEl = document.getElementById('sbUrl');
    const keyEl = document.getElementById('sbKey');
    if (urlEl && !urlEl.value) urlEl.value = (typeof PRESET_SB_URL !== 'undefined') ? PRESET_SB_URL : '';
    if (keyEl && !keyEl.value) keyEl.value = (typeof PRESET_SB_KEY !== 'undefined') ? PRESET_SB_KEY : '';
    _origOpen();
  };

  /* ── 4. Override connectSupabase — force preset creds, only name required ── */
  const _origConnect = window.connectSupabase;
  window.connectSupabase = async function () {
    // Silently fill in the preset credentials
    const urlEl = document.getElementById('sbUrl');
    const keyEl = document.getElementById('sbKey');
    if (urlEl) urlEl.value = (typeof PRESET_SB_URL !== 'undefined') ? PRESET_SB_URL : urlEl.value;
    if (keyEl) keyEl.value = (typeof PRESET_SB_KEY !== 'undefined') ? PRESET_SB_KEY : keyEl.value;

    // Validate only the name field
    const userId = document.getElementById('sbUser').value.trim();
    const errEl  = document.getElementById('sbError');
    if (!userId) {
      errEl.textContent = 'Please enter your name.';
      errEl.className = 'modal-error visible';
      return;
    }
    errEl.className = 'modal-error';

    // Delegate to the original handler (now has all three fields filled)
    await _origConnect();
  };

  /* ── 5. Run the DOM patch ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchModal);
  } else {
    patchModal();
  }
})();
