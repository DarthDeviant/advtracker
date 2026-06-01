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

  /* ── 5. Namespace topic keys with mode prefix ────────────────────────────
   *
   * Original key format:  "Physics::ch-motion::Free body diagrams::theory"
   * New key format:       "main::Physics::ch-motion::Free body diagrams::theory"
   *                       "adv::Physics::ch-motion::Free body diagrams::theory"
   *
   * This ensures that even if checked objects from both modes ever share the
   * same storage space they cannot collide.  A one-time migration converts any
   * existing keys (no mode prefix) to the new format automatically.
   * ────────────────────────────────────────────────────────────────────────── */

  // Override topicKey to include the active mode as a namespace prefix.
  window.topicKey = function (subject, chapterId, topic, type) {
    return `${activeMode}::${subject}::${chapterId}::${topic}::${type}`;
  };

  /**
   * Migrate a checked object whose keys lack a mode prefix.
   * Reads every key; if it does NOT start with "main::" or "adv::" it is
   * re-keyed under the supplied mode prefix.  Returns true if anything changed.
   */
  function migrateCheckedKeys(obj, mode) {
    const prefix = mode + '::';
    const legacyKeys = Object.keys(obj).filter(
      k => !k.startsWith('main::') && !k.startsWith('adv::')
    );
    if (!legacyKeys.length) return false;
    legacyKeys.forEach(k => {
      obj[prefix + k] = obj[k];
      delete obj[k];
    });
    return true;
  }

  /**
   * Run migration once for both modes against their localStorage copies.
   * Does nothing if keys are already in the new format.
   */
  function runCheckedMigration() {
    ['main', 'adv'].forEach(mode => {
      const lsKey = mode === 'main' ? 'jee_main_checked' : 'jee_adv_checked';
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (migrateCheckedKeys(obj, mode)) {
          localStorage.setItem(lsKey, JSON.stringify(obj));
          console.log(`[patch] Migrated ${mode} checked keys to namespaced format.`);
        }
      } catch (e) { /* silently skip on parse errors */ }
    });
  }

  /* ── 6. Auto-sync on mode switch ─────────────────────────────────────────
   *
   * Problem: switchMode() only calls sbPull() for the *new* mode.  Any
   * debounce-pending changes to the *current* mode are silently abandoned.
   *
   * Fix: wrap switchMode() so we await sbPush() for the current mode first,
   * then let the original handler switch + pull the new mode.
   * ────────────────────────────────────────────────────────────────────────── */

  const _origSwitchMode = window.switchMode;
  window.switchMode = async function (mode) {
    if (mode === activeMode) return;

    // 1. Flush any pending changes for the *current* mode to the cloud.
    if (typeof sbConfig !== 'undefined' && sbConfig) {
      // Cancel the pending debounce so sbPush() is not called twice.
      if (typeof saveDebounceTimer !== 'undefined') {
        clearTimeout(saveDebounceTimer);
      }
      try {
        await sbPush();
      } catch (e) {
        console.warn('[patch] Pre-switch push failed:', e);
      }
    }

    // 2. Delegate to original: sets activeMode, loads local data, pulls cloud.
    await _origSwitchMode(mode);
  };

  /* ── 7. Run the DOM patch + one-time migration ── */
  function init() {
    patchModal();
    runCheckedMigration();
    // Re-run migration after sbPull replaces checked — hook into sbPull.
    const _origSbPull = window.sbPull;
    if (_origSbPull) {
      window.sbPull = async function () {
        const result = await _origSbPull();
        // After a pull, the in-memory `checked` may have been replaced with
        // data from Supabase that still uses the old key format — migrate it
        // and persist so subsequent pushes send namespaced keys.
        if (result && typeof checked !== 'undefined') {
          if (migrateCheckedKeys(checked, activeMode)) {
            const lsKey = activeMode === 'main' ? 'jee_main_checked' : 'jee_adv_checked';
            localStorage.setItem(lsKey, JSON.stringify(checked));
            // Push the migrated version back so Supabase is also updated.
            if (typeof sbConfig !== 'undefined' && sbConfig) {
              try { await sbPush(); } catch (e) { /* ignore */ }
            }
          }
        }
        return result;
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
