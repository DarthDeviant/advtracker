/**
 * patch.js — JEE Tracker enhancements v2
 *
 * Drop this <script> AFTER the main tracker script:
 *   <script src="patch.js"></script>
 *
 * Features:
 *  1. Hides URL/key fields — users only enter their name
 *  2. Auto-wires preset credentials
 *  3. Mode-prefixed topic keys + one-time migration
 *  4. Push-before-switch for safe auto-sync on mode change
 *  5. Smooth animated progress bars + chapter fade on mode switch
 *  6. Full mobile-friendly responsive overrides
 *  7. "What to Do Next" action panel
 */
(function () {

  /* ══════════════════════════════════════════════════════════
     §1  CAPTURE ORIGINALS  (main script is already loaded)
     ══════════════════════════════════════════════════════════ */
  const _origUpdateStats   = window.updateStats;
  const _origSwitchMode    = window.switchMode;
  const _origOpen          = window.openSupabaseModal;
  const _origConnect       = window.connectSupabase;

  /* ══════════════════════════════════════════════════════════
     §2  ALL CSS  (modal fixes + smooth bars + mobile + panel)
     ══════════════════════════════════════════════════════════ */
  const style = document.createElement('style');
  style.textContent = `

  /* ── Modal: hide URL / key rows ── */
  #_sb-url-row, #_sb-key-row, .modal-hint { display:none !important; }
  #_sb-name-label { color:var(--text2); }

  /* ── Smooth stat bars (force override) ── */
  .stat-bar      { transition: width .65s cubic-bezier(.4,0,.2,1) !important; }
  .overall-bar-fill { transition: width .75s cubic-bezier(.4,0,.2,1) !important; }

  /* ── Chapter container fade on mode switch ── */
  #chaptersContainer { transition: opacity .2s ease; }
  #chaptersContainer.fading { opacity:0; pointer-events:none; }

  /* ══════════════════════
     ACTION PANEL
  ══════════════════════ */
  .action-panel {
    background: var(--bg1);
    border: 1px solid var(--border);
    border-radius: var(--radius2);
    margin-bottom: 20px;
    overflow: hidden;
  }
  .action-panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 18px;
    cursor: pointer;
    user-select: none;
    transition: background .15s;
  }
  .action-panel-header:hover { background: rgba(255,255,255,.025); }
  .ap-icon {
    width: 28px; height: 28px;
    border-radius: 8px;
    background: var(--accent-dim);
    border: 1px solid rgba(240,180,41,.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; flex-shrink: 0;
  }
  .ap-title {
    font-size: 13px; font-weight: 600; color: var(--text); flex: 1;
  }
  .ap-header-chips { display: flex; gap: 5px; }
  .ap-hchip {
    font-size: 10px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 100px;
  }
  .ap-hchip.pyq  { background:var(--blue-dim); color:var(--blue); border:1px solid rgba(96,165,250,.2); }
  .ap-hchip.prac { background:var(--green-dim); color:var(--green); border:1px solid rgba(74,222,128,.2); }
  .ap-toggle {
    color: var(--text3);
    transition: transform .25s cubic-bezier(.4,0,.2,1);
    flex-shrink: 0;
  }
  .action-panel.ap-open .ap-toggle { transform: rotate(90deg); }

  .ap-body {
    display: none;
    border-top: 1px solid var(--border);
  }
  .action-panel.ap-open .ap-body { display: block; }

  .ap-tab-row {
    display: flex;
    gap: 4px;
    padding: 10px 14px 0;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
  }
  .ap-tab {
    padding: 7px 14px;
    border-radius: 8px 8px 0 0;
    font-size: 12px; font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    color: var(--text3);
    font-family: 'Outfit', sans-serif;
    transition: all .15s;
    margin-bottom: -1px;
  }
  .ap-tab:hover { color: var(--text2); background: var(--bg3); }
  .ap-tab.at-pyq  { background:var(--blue-dim);  color:var(--blue);  border-color:rgba(96,165,250,.25);  border-bottom-color:var(--bg1); }
  .ap-tab.at-prac { background:var(--green-dim); color:var(--green); border-color:rgba(74,222,128,.25); border-bottom-color:var(--bg1); }

  .ap-list {
    padding: 14px;
    max-height: 320px;
    overflow-y: auto;
  }
  .ap-list::-webkit-scrollbar { width: 4px; }
  .ap-list::-webkit-scrollbar-track { background: transparent; }
  .ap-list::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  .ap-subj-block { margin-bottom: 14px; }
  .ap-subj-label {
    font-size: 10px; font-weight: 600;
    letter-spacing: .1em; text-transform: uppercase;
    margin-bottom: 6px; padding: 0 2px;
  }
  .ap-subj-label.phy { color: var(--blue); }
  .ap-subj-label.che { color: var(--green); }
  .ap-subj-label.mat { color: var(--pink); }
  .ap-ch-block {
    margin-bottom: 7px;
    padding: 9px 11px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .ap-ch-name {
    font-size: 11px; font-weight: 600; color: var(--text2);
    margin-bottom: 7px; line-height: 1.3;
  }
  .ap-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .ap-chip {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 3px 9px;
    border-radius: 100px;
    font-size: 11px;
    cursor: pointer;
    transition: all .15s;
    font-family: 'Outfit', sans-serif;
    border: 1px solid;
    line-height: 1.35;
  }
  .ap-chip.pyq  { background:var(--blue-dim);  border-color:rgba(96,165,250,.25);  color:var(--blue);  }
  .ap-chip.prac { background:var(--green-dim); border-color:rgba(74,222,128,.25); color:var(--green); }
  .ap-chip.pyq:hover  { background: rgba(96,165,250,.2); }
  .ap-chip.prac:hover { background: rgba(74,222,128,.2); }
  .ap-empty {
    text-align: center; color: var(--text3);
    font-size: 13px; padding: 28px 20px;
    line-height: 1.6;
  }
  .ap-empty-icon { font-size: 26px; margin-bottom: 8px; }

  /* ══════════════════════
     MOBILE OVERRIDES
  ══════════════════════ */
  @media (max-width: 600px) {
    .container { padding: 0 12px 80px; }

    /* Mode switcher */
    .mode-switcher-wrap { padding-top: 14px; }
    .mode-switcher { padding: 4px; gap: 3px; }
    .mode-btn { padding: 10px 12px; gap: 7px; }
    .mode-btn-name { font-size: 12px; }
    .mode-btn-date { font-size: 9px; }
    .mode-btn svg { width:15px; height:15px; }

    /* Header */
    header { padding: 16px 0 14px; margin-bottom: 16px; }
    h1 { font-size: 20px; }
    .subtitle { font-size: 11px; margin-top: 3px; }
    .logo-badge { font-size: 9px; padding: 3px 9px 3px 3px; margin-bottom: 7px; }
    .logo-dot { width:17px; height:17px; font-size:8px; }
    .header-top { gap: 8px; align-items: center; }
    .header-actions { gap: 4px; }
    .btn { padding: 7px 9px; font-size: 11px; gap: 4px; }
    /* Hide button text on very small screens, keep icons */
    .btn .btn-tl { display: none; }

    /* Stats: stay 3-col but compact */
    .overall-stats { grid-template-columns: repeat(3,1fr) !important; gap: 7px; }
    .stat-card { padding: 10px 8px; }
    .stat-label { font-size: 8px; margin-bottom: 2px; letter-spacing: .06em; }
    .stat-val { font-size: 17px; }
    .stat-val small { font-size: 10px; }
    .stat-bar-wrap { margin-top: 7px; height: 3px; }

    /* Overall bar */
    .overall-bar-section { padding: 10px 12px; gap: 8px; margin-bottom: 14px; }
    .overall-bar-label { font-size: 9px; }
    .overall-pct { font-size: 14px; }

    /* Countdown: keep 4-col */
    .countdown-section { grid-template-columns: repeat(4,1fr) !important; gap: 6px; margin-bottom: 14px; }
    .cd-card { padding: 9px 5px; }
    .cd-num { font-size: 17px; }
    .cd-label { font-size: 8px; margin-top: 3px; letter-spacing: .08em; }
    .cd-target { font-size: 10px; margin-top: -8px; margin-bottom: 16px; }

    /* Tabs: horizontal scrollable, never wrap */
    .tabs {
      flex-direction: row !important;
      overflow-x: auto; -webkit-overflow-scrolling: touch;
      scrollbar-width: none; padding: 4px; gap: 3px;
    }
    .tabs::-webkit-scrollbar { display: none; }
    .tab { flex: 1 0 auto; padding: 9px 11px; font-size: 11px; gap: 5px; white-space: nowrap; }
    .tab .tab-count { font-size: 10px; padding: 1px 5px; }

    /* Chapter rows */
    .chapter-header { padding: 11px 13px; gap: 8px; }
    .ch-title { font-size: 13px; }
    .ch-mini-bar { width: 44px; }
    .ch-progress-text { font-size: 11px; }
    .topic-row { padding: 8px 13px; gap: 6px; }
    .topic-label { font-size: 12px; min-width: 0; }
    .pill { padding: 4px 7px; font-size: 10px; gap: 3px; }
    .pill svg { width:9px; height:9px; }

    /* Sync badge */
    .sync-badge { padding: 5px 8px; font-size: 10px; gap: 5px; }
    .sync-dot { width: 5px; height: 5px; }

    /* Action panel */
    .action-panel-header { padding: 11px 14px; gap: 8px; }
    .ap-title { font-size: 12px; }
    .ap-list { max-height: 260px; padding: 10px; }
    .ap-tab { padding: 6px 11px; font-size: 11px; }
    .ap-chip { font-size: 10px; padding: 3px 7px; }
    .ap-ch-block { padding: 7px 9px; }
    .ap-ch-name { font-size: 10px; margin-bottom: 5px; }

    /* Modal */
    .modal { padding: 22px 16px; border-radius: 14px; }
    .modal-title { font-size: 18px; }
    .modal-sub { font-size: 12px; margin-bottom: 18px; }
  }
  `;
  document.head.appendChild(style);

  /* ══════════════════════════════════════════════════════════
     §3  MODAL PATCH — hide URL/key, rename labels
     ══════════════════════════════════════════════════════════ */
  function patchModal() {
    const modal = document.getElementById('supabaseModal');
    if (!modal) return;

    const title = modal.querySelector('.modal-title');
    if (title) title.textContent = '☁ Cloud Sync';
    const sub = modal.querySelector('.modal-sub');
    if (sub) sub.textContent = 'Enter your name to sync progress across devices. Both JEE Main and Advanced data are saved separately.';

    const sbUrlInput = document.getElementById('sbUrl');
    const sbKeyInput = document.getElementById('sbKey');
    if (sbUrlInput) {
      const lbl = sbUrlInput.previousElementSibling;
      const wrap = document.createElement('div'); wrap.id = '_sb-url-row';
      sbUrlInput.parentNode.insertBefore(wrap, lbl);
      wrap.appendChild(lbl); wrap.appendChild(sbUrlInput);
    }
    if (sbKeyInput) {
      const lbl = sbKeyInput.previousElementSibling;
      const wrap = document.createElement('div'); wrap.id = '_sb-key-row';
      sbKeyInput.parentNode.insertBefore(wrap, lbl);
      wrap.appendChild(lbl); wrap.appendChild(sbKeyInput);
    }

    const sbUserInput = document.getElementById('sbUser');
    if (sbUserInput) {
      const lbl = sbUserInput.previousElementSibling;
      if (lbl) { lbl.id = '_sb-name-label'; lbl.innerHTML = 'Your Name'; }
      sbUserInput.placeholder = 'e.g. Rohan';
    }
    const btn = document.getElementById('sbConnectBtn');
    if (btn) btn.textContent = 'Sync';
    const footerBtn = document.querySelector('footer .btn');
    if (footerBtn) footerBtn.textContent = '☁ Sync';
  }

  /* ══════════════════════════════════════════════════════════
     §4  MODAL OVERRIDES — pre-fill creds, name-only validation
     ══════════════════════════════════════════════════════════ */
  window.openSupabaseModal = function () {
    const urlEl = document.getElementById('sbUrl');
    const keyEl = document.getElementById('sbKey');
    if (urlEl && !urlEl.value) urlEl.value = (typeof PRESET_SB_URL !== 'undefined') ? PRESET_SB_URL : '';
    if (keyEl && !keyEl.value) keyEl.value = (typeof PRESET_SB_KEY !== 'undefined') ? PRESET_SB_KEY : '';
    _origOpen();
  };

  window.connectSupabase = async function () {
    const urlEl = document.getElementById('sbUrl');
    const keyEl = document.getElementById('sbKey');
    if (urlEl) urlEl.value = (typeof PRESET_SB_URL !== 'undefined') ? PRESET_SB_URL : urlEl.value;
    if (keyEl) keyEl.value = (typeof PRESET_SB_KEY !== 'undefined') ? PRESET_SB_KEY : keyEl.value;
    const userId = document.getElementById('sbUser').value.trim();
    const errEl  = document.getElementById('sbError');
    if (!userId) {
      errEl.textContent = 'Please enter your name.';
      errEl.className = 'modal-error visible';
      return;
    }
    errEl.className = 'modal-error';
    await _origConnect();
  };

  /* ══════════════════════════════════════════════════════════
     §5  MODE-PREFIXED TOPIC KEYS + MIGRATION
     ══════════════════════════════════════════════════════════ */
  window.topicKey = function (subject, chapterId, topic, type) {
    return `${activeMode}::${subject}::${chapterId}::${topic}::${type}`;
  };

  function migrateCheckedKeys(obj, mode) {
    const prefix = mode + '::';
    const legacy = Object.keys(obj).filter(k => !k.startsWith('main::') && !k.startsWith('adv::'));
    if (!legacy.length) return false;
    legacy.forEach(k => { obj[prefix + k] = obj[k]; delete obj[k]; });
    return true;
  }

  function runCheckedMigration() {
    ['main', 'adv'].forEach(mode => {
      const lsKey = mode === 'main' ? 'jee_main_checked' : 'jee_adv_checked';
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (migrateCheckedKeys(obj, mode)) {
          localStorage.setItem(lsKey, JSON.stringify(obj));
          console.log(`[patch] Migrated ${mode} topic keys to namespaced format.`);
        }
      } catch (e) { /* ignore parse errors */ }
    });
  }

  /* ══════════════════════════════════════════════════════════
     §6  SMOOTH MODE SWITCH
         • push current mode before switching
         • fade chapters out/in
         • animate stat bars from 0 → new values
     ══════════════════════════════════════════════════════════ */
  let _pendingModeSwitch = false;

  window.switchMode = async function (mode) {
    if (mode === activeMode || _pendingModeSwitch) return;
    _pendingModeSwitch = true;

    // Fade out chapters
    const container = document.getElementById('chaptersContainer');
    if (container) container.classList.add('fading');

    // Push current mode data before leaving
    if (typeof sbConfig !== 'undefined' && sbConfig) {
      if (typeof saveDebounceTimer !== 'undefined') clearTimeout(saveDebounceTimer);
      try { await sbPush(); } catch (e) { console.warn('[patch] Pre-switch push failed:', e); }
    }

    // Run original switch (sets activeMode, loads data, pulls cloud)
    await _origSwitchMode(mode);

    // Fade chapters back in
    if (container) {
      requestAnimationFrame(() => requestAnimationFrame(() => container.classList.remove('fading')));
    }

    _pendingModeSwitch = false;
    refreshActionPanel();
  };

  /* ══════════════════════════════════════════════════════════
     §7  SMOOTH STAT BAR ANIMATION
         Zero bars first on mode change so CSS transition plays
         0% → real value.
     ══════════════════════════════════════════════════════════ */
  let _lastStatMode = null;

  window.updateStats = function () {
    const modeChanged = _lastStatMode !== null && _lastStatMode !== activeMode;
    _lastStatMode = activeMode;

    if (modeChanged) {
      // Reset to 0 so the CSS transition plays from scratch
      ['phyBar', 'cheBar', 'matBar', 'overallBar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.width = '0%';
      });
      setTimeout(() => { _origUpdateStats(); refreshActionPanel(); }, 40);
    } else {
      _origUpdateStats();
      refreshActionPanel();
    }
  };

  /* ══════════════════════════════════════════════════════════
     §8  ACTION PANEL  — "What to Do Next"
     ══════════════════════════════════════════════════════════ */
  let _apTab = 'pyq'; // 'pyq' | 'prac'

  function injectActionPanel() {
    if (document.getElementById('actionPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'actionPanel';
    panel.className = 'action-panel';
    panel.innerHTML = `
      <div class="action-panel-header" id="apHeaderBtn">
        <div class="ap-icon">📋</div>
        <div class="ap-title">What to Do Next</div>
        <div class="ap-header-chips" id="apHeaderChips"></div>
        <div class="ap-toggle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
      <div class="ap-body">
        <div class="ap-tab-row">
          <button class="ap-tab at-pyq"  id="apTabPYQ">📄 Try PYQs</button>
          <button class="ap-tab"         id="apTabPrac">✏️ Need Practice</button>
        </div>
        <div class="ap-list" id="apList"></div>
      </div>
    `;
    // Insert right after the overall-bar-section
    const anchor = document.querySelector('.overall-bar-section');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);

    document.getElementById('apHeaderBtn').addEventListener('click', () => {
      panel.classList.toggle('ap-open');
      if (panel.classList.contains('ap-open')) renderApList();
    });
    document.getElementById('apTabPYQ').addEventListener('click', () => { _apTab = 'pyq';  apActivateTab(); renderApList(); });
    document.getElementById('apTabPrac').addEventListener('click', () => { _apTab = 'prac'; apActivateTab(); renderApList(); });
  }

  function apActivateTab() {
    document.getElementById('apTabPYQ').className  = 'ap-tab' + (_apTab === 'pyq'  ? ' at-pyq'  : '');
    document.getElementById('apTabPrac').className = 'ap-tab' + (_apTab === 'prac' ? ' at-prac' : '');
  }

  // Navigate: switch subject tab → open chapter → scroll to it
  window._apGoTo = function (subj, chId, topicEncoded) {
    const topic = decodeURIComponent(topicEncoded);
    switchTab(subj);
    const ch = (syllabus[subj] || []).find(c => c.id === chId);
    if (ch) ch._open = true;
    renderChapters();
    setTimeout(() => {
      const el = document.getElementById('ch-' + chId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    // Close the panel on mobile so user can see the chapter
    if (window.innerWidth <= 600) {
      const panel = document.getElementById('actionPanel');
      if (panel) panel.classList.remove('ap-open');
    }
  };

  function gatherApData() {
    const needPYQ  = {}; // subj → { chId → { chapter, topics[] } }
    const needPrac = {};
    ['Physics', 'Chemistry', 'Mathematics'].forEach(subj => {
      (syllabus[subj] || []).forEach(ch => {
        (ch.topics || []).forEach(t => {
          const theory = !!checked[topicKey(subj, ch.id, t, 'theory')];
          if (!theory) return;
          const pyqDone  = !!checked[topicKey(subj, ch.id, t, 'pyq')];
          const pracDone = !!checked[topicKey(subj, ch.id, t, 'practice')];
          if (!pyqDone)  { addToMap(needPYQ,  subj, ch.id, ch.chapter, t); }
          if (!pracDone) { addToMap(needPrac, subj, ch.id, ch.chapter, t); }
        });
      });
    });
    return { needPYQ, needPrac };
  }

  function addToMap(map, subj, chId, chapter, topic) {
    if (!map[subj]) map[subj] = {};
    if (!map[subj][chId]) map[subj][chId] = { chapter, topics: [] };
    map[subj][chId].topics.push(topic);
  }

  function countMap(map) {
    let n = 0;
    Object.values(map).forEach(m => Object.values(m).forEach(g => n += g.topics.length));
    return n;
  }

  function _aph(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _apa(s) { return String(s).replace(/'/g,"&#39;").replace(/"/g,'&quot;'); }

  function renderApList() {
    const wrap = document.getElementById('apList');
    if (!wrap) return;
    const { needPYQ, needPrac } = gatherApData();
    const data = _apTab === 'pyq' ? needPYQ : needPrac;
    const cls  = _apTab;
    const subjCls = { Physics: 'phy', Chemistry: 'che', Mathematics: 'mat' };
    let html = '';
    let total = 0;
    ['Physics', 'Chemistry', 'Mathematics'].forEach(subj => {
      const byChapter = data[subj];
      if (!byChapter || !Object.keys(byChapter).length) return;
      html += `<div class="ap-subj-block">
        <div class="ap-subj-label ${subjCls[subj]}">${subj}</div>`;
      Object.entries(byChapter).forEach(([chId, g]) => {
        html += `<div class="ap-ch-block">
          <div class="ap-ch-name">${_aph(g.chapter)}</div>
          <div class="ap-chips">`;
        g.topics.forEach(t => {
          total++;
          const label = t.length > 40 ? t.slice(0, 38) + '…' : t;
          html += `<span class="ap-chip ${cls}" title="${_aph(t)}"
            onclick="window._apGoTo('${_apa(subj)}','${_apa(chId)}','${encodeURIComponent(t)}')"
          >${_aph(label)}</span>`;
        });
        html += `</div></div>`;
      });
      html += `</div>`;
    });
    if (!total) {
      const msg = _apTab === 'pyq'
        ? 'Every theory-done topic already has PYQs ticked! 🎉'
        : 'Every theory-done topic already has Practice ticked! 🎉';
      html = `<div class="ap-empty"><div class="ap-empty-icon">✅</div>${msg}</div>`;
    }
    wrap.innerHTML = html;
  }

  function refreshActionPanel() {
    const panel = document.getElementById('actionPanel');
    if (!panel) return;
    const { needPYQ, needPrac } = gatherApData();
    const pyqCt  = countMap(needPYQ);
    const pracCt = countMap(needPrac);
    const chipsEl = document.getElementById('apHeaderChips');
    if (chipsEl) {
      let h = '';
      if (pyqCt > 0)  h += `<span class="ap-hchip pyq">${pyqCt} PYQ</span>`;
      if (pracCt > 0) h += `<span class="ap-hchip prac">${pracCt} Practice</span>`;
      chipsEl.innerHTML = h;
    }
    if (panel.classList.contains('ap-open')) renderApList();
  }

  /* ══════════════════════════════════════════════════════════
     §9  WRAP sbPull — migrate cloud data + refresh panel
     ══════════════════════════════════════════════════════════ */
  function wrapSbPull() {
    const _origSbPull = window.sbPull;
    if (!_origSbPull) return;
    window.sbPull = async function () {
      const result = await _origSbPull();
      if (result && typeof checked !== 'undefined') {
        if (migrateCheckedKeys(checked, activeMode)) {
          const lsKey = activeMode === 'main' ? 'jee_main_checked' : 'jee_adv_checked';
          localStorage.setItem(lsKey, JSON.stringify(checked));
          if (typeof sbConfig !== 'undefined' && sbConfig) {
            try { await sbPush(); } catch (e) { /* ignore */ }
          }
        }
      }
      refreshActionPanel();
      return result;
    };
  }

  /* ══════════════════════════════════════════════════════════
     §10  WRAP BUTTON TEXT for mobile icon-only mode
          Wraps bare text nodes in <span class="btn-tl"> so CSS
          can hide them at ≤400 px without hiding SVG icons.
     ══════════════════════════════════════════════════════════ */
  function wrapBtnLabels() {
    document.querySelectorAll('.btn').forEach(btn => {
      [...btn.childNodes].forEach(node => {
        if (node.nodeType === 3 && node.textContent.trim()) {
          const sp = document.createElement('span');
          sp.className = 'btn-tl';
          sp.textContent = node.textContent;
          btn.replaceChild(sp, node);
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     §11  INIT
     ══════════════════════════════════════════════════════════ */
  function init() {
    patchModal();
    runCheckedMigration();
    injectActionPanel();
    wrapSbPull();
    wrapBtnLabels();
    // First panel population after tracker's own init has run
    setTimeout(refreshActionPanel, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
