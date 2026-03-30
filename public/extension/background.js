// ─── Token Capture (unchanged) ────────────────────────────────────────────────

let capturedTokens = {};

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    let newTokens = false;
    if (details.requestHeaders) {
      for (const header of details.requestHeaders) {
        const name = header.name.toLowerCase();
        if (['authorization', 'x-csrf-token', 'token', 'x-xsrf-token'].includes(name)) {
          if (capturedTokens[name] !== header.value) {
            capturedTokens[name] = header.value;
            newTokens = true;
          }
        }
      }
    }
    if (newTokens) {
      chrome.storage.local.set({ jkt48_auth_headers: capturedTokens });
    }
  },
  { urls: ['*://jkt48.com/*', '*://*.jkt48.com/*'] },
  ['requestHeaders']
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendProgress(tabId, text, isError = false) {
  chrome.tabs.sendMessage(tabId, { type: 'EXPORT_PROGRESS', text, isError }).catch(() => { });
}

async function broadcastToTierlistTabs(data) {
  const allTabs = await chrome.tabs.query({});
  for (const t of allTabs) {
    if (t.url && (
      t.url.includes('tierlistjkt48.my.id') ||
      t.url.includes('localhost') ||
      t.url.includes('vercel.app')
    )) {
      chrome.tabs.sendMessage(t.id, { type: 'POINTS_HISTORY_UPDATED', data }).catch(() => { });
    }
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (message.type === 'START_EXPORT_API') {
    handleApiExport(tabId);
  }
});


// ─── API Fetch ────────────────────────────────────────────────────────────────

async function handleApiExport(tabId) {
  try {
    const storageRes = await chrome.storage.local.get('jkt48_auth_headers');
    const authHeaders = storageRes.jkt48_auth_headers || {};

    if (Object.keys(authHeaders).length === 0) {
      sendProgress(tabId, '⚠ No auth token captured. Browse any jkt48.com page first, then try again.', true);
      return;
    }

    sendProgress(tabId, 'Connecting to API…');

    let allRawData = [];
    let page = 1;
    const MAX_PAGES = 100;

    while (page <= MAX_PAGES) {
      sendProgress(tabId, `Fetching page ${page}…`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000); // 15s per request

      let json;
      try {
        const res = await fetch(
          `https://jkt48.com/api/v1/accounts/purchase-history?lang=id&page=${page}`,
          { headers: authHeaders, signal: controller.signal }
        );
        clearTimeout(timer);

        if (res.status === 401 || res.status === 403) {
          sendProgress(tabId, '⚠ Session expired. Refresh jkt48.com and try again.', true);
          return;
        }
        if (!res.ok) {
          if (res.status === 404) break; // no more pages
          throw new Error(`API error ${res.status}`);
        }

        json = await res.json();
      } catch (fetchErr) {
        clearTimeout(timer);
        if (fetchErr.name === 'AbortError') {
          sendProgress(tabId, `✗ Request timed out on page ${page}.`, true);
          return;
        }
        throw fetchErr;
      }

      // Normalise: find the items array wherever it lives in the response
      let items = [];
      if (Array.isArray(json))                               items = json;
      else if (json.data?.data && Array.isArray(json.data.data)) items = json.data.data;
      else if (json.data && Array.isArray(json.data))        items = json.data;
      else if (json.items && Array.isArray(json.items))      items = json.items;
      else if (json.purchases && Array.isArray(json.purchases)) items = json.purchases;

      if (!items.length) break; // empty page = done

      allRawData = allRawData.concat(items);
      sendProgress(tabId, `Fetched ${allRawData.length} records so far…`);

      // Laravel pagination: stop when we've hit the last page
      const lastPage = json.data?.last_page ?? json.meta?.last_page ?? null;
      if (lastPage !== null && page >= lastPage) break;

      page++;
    }

    if (!allRawData.length) {
      sendProgress(tabId, '✗ No records found. Make sure you are logged into jkt48.com.', true);
      return;
    }

    // ── Map raw API data to the internal format ──────────────────────────────
    const TYPE_LABELS = { EXCLUSIVE: 'VC/MnG', OFC_REGISTER: 'Membership Official' };

    const mappedData = allRawData.map((item, index) => {
      let date = String(item.created_date || item.date || item.created_at || item.tanggal || '');
      if (date.includes('T')) date = date.split('T')[0];

      const rawTxNo   = item.transaction_no || item.id || item.transaction_id || item.invoice || item.no || '';
      const rawType   = (item.type || item.operation || 'Unknown').toUpperCase().trim();
      const catType   = TYPE_LABELS[rawType] || (item.type || item.operation || 'Unknown');
      let   purpose   = item.description || item.purpose || item.title || item.keterangan || item.category || catType || '';

      const isTopup   = purpose.toLowerCase().includes('pembelian poin jkt48');
      const isExpired = purpose.toLowerCase().includes('masa berlaku habis');
      if (isTopup)        purpose = 'Pembelian Poin JKT48';
      else if (isExpired) purpose = 'Masa Berlaku Habis';

      const rawBonus  = item.bonusPoints || item.bonus_points || item.bonus || 0;
      const totalAmt  = item.total_amount ?? item.buyPoints ?? item.points ?? item.point ?? item.total ?? item.amount ?? 0;
      const payAmt    = item.payment_amount ?? totalAmt;
      const svcCharge = Math.max(0, payAmt - totalAmt);

      let rawBuy = totalAmt;
      const statusText = String(item.payment_status || item.status || 'Lunas').toUpperCase();
      const isOk = ['PAID', 'LUNAS', 'SUCCESS', 'BERHASIL', 'SETTLEMENT'].includes(statusText);

      if (!isOk) rawBuy = 0;
      else if (!isTopup && !isExpired && rawBuy > 0) rawBuy = -Math.abs(rawBuy);
      else if ((isTopup || isExpired) && rawBuy < 0)  rawBuy =  Math.abs(rawBuy);

      return {
        operation:    String(catType),
        category:     String(catType),
        title:        String(item.title || item.description || purpose || ''),
        id:           String(rawTxNo || `api-${index}`),
        date:         String(date),
        purpose:      String(purpose),
        quantity:     String(item.total_quantity ?? item.quantity ?? item.qty ?? item.jumlah ?? 1),
        bonusPoints:  String(rawBonus).replace(' P', '') + ' P',
        buyPoints:    String(rawBuy).replace(' P', '') + ' P',
        status:       String(item.payment_status || item.status || 'Lunas'),
        paymentMethod: String(item.payment_method_name || item.payment_method || 'Unknown'),
        serviceCharge: String(svcCharge)
      };
    });

    const pointsData = { data: mappedData, timestamp: new Date().toISOString() };
    await chrome.storage.local.set({ jkt48_points_history: pointsData });
    await chrome.tabs.sendMessage(tabId, { type: 'POINTS_HISTORY_UPDATED', data: pointsData });
    await broadcastToTierlistTabs(pointsData);

    sendProgress(tabId, `✓ Done! ${mappedData.length} records saved.`);
  } catch (e) {
    sendProgress(tabId, '✗ Error: ' + e.message, true);
  }
}

