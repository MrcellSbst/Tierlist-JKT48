// ─── Data Sync (runs on ALL matched pages: tierlist, localhost, jkt48.com) ────

const syncDataToLocalStorage = async () => {
  try {
    const result = await chrome.storage.local.get('jkt48_points_history');
    if (result.jkt48_points_history) {
      localStorage.setItem('jkt48_points_history', JSON.stringify(result.jkt48_points_history));
      window.dispatchEvent(new CustomEvent('JKT48_POINTS_HISTORY_UPDATED', {
        detail: result.jkt48_points_history
      }));
    }
  } catch (e) {
    console.error('[JKT48 Ext] Sync error:', e);
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'POINTS_HISTORY_UPDATED' && message.data) {
    try {
      localStorage.setItem('jkt48_points_history', JSON.stringify(message.data));
      window.dispatchEvent(new CustomEvent('JKT48_POINTS_HISTORY_UPDATED', { detail: message.data }));
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }

  // Progress updates from background → update floating panel status
  if (message.type === 'EXPORT_PROGRESS') {
    updateStatus(message.text, message.isError || false);
  }

  return true;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.jkt48_points_history) {
    syncDataToLocalStorage();
  }
});

syncDataToLocalStorage();

// ─── Floating Panel (only on jkt48.com) ──────────────────────────────────────

if (window.location.hostname.includes('jkt48.com')) {
  injectFloatingPanel();
}

function injectFloatingPanel() {
  // Avoid double-injection
  if (document.getElementById('jkt48ext-root')) return;

  const root = document.createElement('div');
  root.id = 'jkt48ext-root';
  document.body.appendChild(root);

  // Use Shadow DOM to isolate styles from jkt48.com's CSS
  const shadow = root.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      :host { all: initial; }

      #fab {
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 2147483647;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(135deg, #E50014 0%, #a0000f 100%);
        box-shadow: 0 4px 16px rgba(229,0,20,0.45), 0 2px 6px rgba(0,0,0,0.3);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        font-size: 22px;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      #fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 22px rgba(229,0,20,0.55), 0 3px 8px rgba(0,0,0,0.35);
      }
      #fab.open {
        transform: rotate(45deg) scale(1.05);
      }

      #panel {
        position: fixed;
        bottom: 88px;
        left: 24px;
        z-index: 2147483646;
        width: 300px;
        background: #1a1a2e;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3);
        padding: 0;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transform-origin: bottom left;
        transition: transform 0.25s cubic-bezier(0.34,1.3,0.64,1), opacity 0.2s ease;
        transform: scale(0.85) translateY(12px);
        opacity: 0;
        pointer-events: none;
      }
      #panel.visible {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }

      .panel-header {
        background: linear-gradient(135deg, rgba(229,0,20,0.2) 0%, rgba(229,0,20,0.05) 100%);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding: 14px 16px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .panel-header-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      .panel-header-text h3 {
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.3px;
      }
      .panel-header-text p {
        color: rgba(255,255,255,0.45);
        font-size: 10.5px;
        margin-top: 1px;
      }

      .panel-body {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .ext-btn {
        width: 100%;
        padding: 10px 14px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-size: 12.5px;
        font-weight: 600;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        position: relative;
        overflow: hidden;
      }
      .ext-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
      .ext-btn:active { transform: translateY(0); filter: brightness(0.95); }
      .ext-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      .btn-api {
        background: linear-gradient(135deg, #216D94 0%, #00A4A5 100%);
        color: #fff;
        box-shadow: 0 3px 10px rgba(0,164,165,0.3);
      }
      .btn-tierlist {
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.85);
        border: 1px solid rgba(255,255,255,0.15);
      }
      .btn-tierlist:hover { background: rgba(255,255,255,0.12); }

      .btn-icon { font-size: 15px; flex-shrink: 0; }
      .btn-content { display: flex; flex-direction: column; align-items: flex-start; }
      .btn-label { line-height: 1.2; }
      .btn-sub { font-size: 10px; font-weight: 400; opacity: 0.7; margin-top: 1px; }

      .status-area {
        background: rgba(0,0,0,0.25);
        border-radius: 8px;
        padding: 8px 11px;
        min-height: 34px;
        display: flex;
        align-items: center;
        gap: 7px;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        background: rgba(255,255,255,0.3);
        transition: background 0.3s;
      }
      .status-dot.busy {
        background: #00A4A5;
        animation: pulse-dot 1s ease-in-out infinite;
      }
      .status-dot.ok   { background: #4ade80; }
      .status-dot.err  { background: #f87171; }
      @keyframes pulse-dot {
        0%,100% { transform: scale(1); opacity:1; }
        50%      { transform: scale(1.4); opacity:0.6; }
      }
      .status-text {
        color: rgba(255,255,255,0.6);
        font-size: 11px;
        line-height: 1.4;
        flex: 1;
      }
      .status-text.err { color: #fca5a5; }

      .divider {
        height: 1px;
        background: rgba(255,255,255,0.06);
      }
    </style>

    <!-- FAB -->
    <button id="fab" title="JKT48 Exporter">🎀</button>

    <!-- Floating Panel -->
    <div id="panel">
      <div class="panel-header">
        <span class="panel-header-icon">📊</span>
        <div class="panel-header-text">
          <h3>Points History Exporter</h3>
          <p>JKT48 Fan Tools Extension</p>
        </div>
      </div>
      <div class="panel-body">
        <button class="ext-btn btn-api" id="btnApi">
          <span class="btn-icon">⚡</span>
          <span class="btn-content">
            <span class="btn-label">Get Data!</span>
            <span class="btn-sub">Fetch your transaction history via API</span>
          </span>
        </button>
        <button class="ext-btn btn-tierlist" id="btnTierlist">
          <span class="btn-icon">📊</span>
          <span class="btn-content">
            <span class="btn-label">View in Tierlist</span>
            <span class="btn-sub">Open tierlistjkt48.my.id/point-history</span>
          </span>
        </button>
        <div class="divider"></div>
        <div class="status-area">
          <span class="status-dot" id="statusDot"></span>
          <span class="status-text" id="statusText">Ready — navigate to jkt48.com/transaction-history.</span>
        </div>
      </div>
    </div>
  `;

  // ── Toggle panel on FAB click
  const fab = shadow.getElementById('fab');
  const panel = shadow.getElementById('panel');

  fab.addEventListener('click', () => {
    const open = panel.classList.toggle('visible');
    fab.classList.toggle('open', open);
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      panel.classList.remove('visible');
      fab.classList.remove('open');
    }
  });

  // ── Button handlers
  shadow.getElementById('btnApi').addEventListener('click', () => {
    setStatus('Fetching from API...', 'busy');
    setBusy(true);
    chrome.runtime.sendMessage({ type: 'START_EXPORT_API' });
  });

  shadow.getElementById('btnTierlist').addEventListener('click', () => {
    window.open('https://tierlistjkt48.my.id/point-history', '_blank');
  });

  // ── Helpers
  function setStatus(text, state = 'idle') {
    const dot = shadow.getElementById('statusDot');
    const span = shadow.getElementById('statusText');
    dot.className = 'status-dot' + (state !== 'idle' ? ` ${state}` : '');
    span.className = 'status-text' + (state === 'err' ? ' err' : '');
    span.textContent = text;
  }

  function setBusy(busy) {
    shadow.getElementById('btnApi').disabled = busy;
    shadow.getElementById('btnTierlist').disabled = busy;
  }

  // Expose to outer scope so chrome.runtime.onMessage can call it
  window.__jkt48ext_setStatus = setStatus;
  window.__jkt48ext_setBusy = setBusy;
}

// Called when progress messages arrive from background
function updateStatus(text, isError) {
  if (window.__jkt48ext_setStatus) {
    window.__jkt48ext_setStatus(text, isError ? 'err' : 'ok');
    window.__jkt48ext_setBusy(false);
  }
}