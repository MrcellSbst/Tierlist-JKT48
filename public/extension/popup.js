document.getElementById('exportBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on the correct page
    if (!tab.url.includes('jkt48.com/mypage/point-history')) {
      statusDiv.textContent = 'Please navigate to the JKT48 Points History page first';
      statusDiv.className = 'error';
      return;
    }

    statusDiv.textContent = 'Collecting data from all pages...';

    // First, get the total number of pages
    const pageCountResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getTotalPages
    });

    const totalPages = pageCountResult[0].result;
    console.log('[JKT48 Extension] Total pages:', totalPages);

    // Array to store all data
    let allData = [];

    // Scrape each page
    for (let page = 1; page <= totalPages; page++) {
      statusDiv.textContent = `Collecting data from page ${page} of ${totalPages}...`;
      
      // Navigate to the page
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: (pageNum) => {
          window.location.href = `/mypage/point-history?page=${pageNum}&lang=id`;
        },
        args: [page]
      });

      // Wait for page load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Scrape the current page
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapeCurrentPage
      });

      if (result[0].result.error) {
        statusDiv.textContent = result[0].result.error;
        statusDiv.className = 'error';
        return;
      }

      allData = allData.concat(result[0].result.data);
      console.log(`[JKT48 Extension] Collected ${result[0].result.data.length} records from page ${page}`);
    }

    // Prepare the data
    const pointsData = {
      data: allData,
      timestamp: new Date().toISOString()
    };

    // Store data in chrome.storage.local
    await chrome.storage.local.set({ 'jkt48_points_history': pointsData });
    console.log('[JKT48 Extension] Data saved to chrome.storage.local');

    // Send data to content script to store in localStorage
    try {
      // Send to JKT48 page
      await chrome.tabs.sendMessage(tab.id, {
        type: 'POINTS_HISTORY_UPDATED',
        data: pointsData
      });
      
      // Find and send to your website tab if it's open
      const allTabs = await chrome.tabs.query({});
      for (const otherTab of allTabs) {
        if (otherTab.url && (
          otherTab.url.includes('www.tierlistjkt48.my.id') || 
          otherTab.url.includes('tierlistjkt48.my.id') || 
          otherTab.url.includes('localhost') ||
          otherTab.url.includes('vercel.app')
        )) {
          console.log('[JKT48 Extension] Found website tab:', otherTab.url);
          try {
            await chrome.tabs.sendMessage(otherTab.id, {
              type: 'POINTS_HISTORY_UPDATED',
              data: pointsData
            });
            console.log('[JKT48 Extension] Message sent to tab:', otherTab.id);
          } catch (err) {
            console.error('[JKT48 Extension] Error sending to tab:', err);
          }
        }
      }

      statusDiv.textContent = `Successfully collected data from all ${totalPages} pages! You can now view it in the JKT48 Fan Tools.`;
      statusDiv.className = '';
    } catch (error) {
      console.error('[JKT48 Extension] Error:', error);
      statusDiv.textContent = 'Error saving data. Please try again.';
      statusDiv.className = 'error';
    }
  } catch (error) {
    console.error('[JKT48 Extension] Error:', error);
    statusDiv.textContent = 'Error: ' + error.message;
    statusDiv.className = 'error';
  }
});

// Function to get total number of pages
function getTotalPages() {
  const paginationElement = document.querySelector('.entry-news__list--pagination .page');
  if (!paginationElement) {
    return 1; // Default to 1 if pagination element not found
  }

  const pageText = paginationElement.textContent.trim(); // Should be in format "X / Y"
  const match = pageText.match(/\d+\s*\/\s*(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1]);
  }
  
  return 1; // Default to 1 if we can't parse the page number
}

// Function to scrape current page
function scrapeCurrentPage() {
  try {
    const table = document.querySelector('.table-pink__scroll .table');
    if (!table) {
      return { error: 'Points history table not found' };
    }

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const data = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const pointsText = cells[5]?.textContent || '';
      const pointsLines = pointsText.split('\n').map(line => line.trim());
      const bonusPoints = pointsLines[0]?.replace('Bonus:', '').trim() || '0 P';
      const buyPoints = pointsLines[1]?.replace('Buy:', '').trim() || '0 P';

      return {
        operation: cells[0]?.querySelector('a')?.textContent || '',
        id: cells[1]?.textContent || '',
        date: cells[2]?.textContent || '',
        purpose: cells[3]?.textContent || '',
        quantity: cells[4]?.textContent || '',
        bonusPoints: bonusPoints,
        buyPoints: buyPoints,
        status: cells[6]?.textContent || ''
      };
    });

    return { data };
  } catch (error) {
    return { error: error.message };
  }
}

// API Export Logic (V2)
document.getElementById('exportApiBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Fetching from API... Please wait.';
  statusDiv.className = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('jkt48.com')) {
      statusDiv.textContent = 'Please navigate to any page on jkt48.com first.';
      statusDiv.className = 'error';
      return;
    }

    // Retrieve captured token headers from background script
    const storageRes = await chrome.storage.local.get('jkt48_auth_headers');
    const authHeaders = storageRes.jkt48_auth_headers || {};

    if (Object.keys(authHeaders).length === 0) {
      statusDiv.textContent = 'Missing API token. Please refresh the jkt48.com page once so the extension can capture the token.';
      statusDiv.className = 'error';
      return;
    }

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (headers) => {
        try {
          let allRawData = [];
          let page = 1;

          while (true) {
            const res = await fetch(`https://jkt48.com/api/v1/accounts/purchase-history?lang=id&page=${page}`, {
              headers: headers
            });
            
            if (!res.ok) {
              if (res.status === 404 || res.status === 401) break;
              throw new Error("API responded with " + res.status);
            }
            
            const json = await res.json();
            
            // Extract items based on typical structures
            let items = [];
            if (Array.isArray(json)) items = json;
            else if (json.data && Array.isArray(json.data.data)) items = json.data.data;
            else if (json.data && Array.isArray(json.data)) items = json.data;
            else if (json.items && Array.isArray(json.items)) items = json.items;
            else if (json.purchases && Array.isArray(json.purchases)) items = json.purchases;
            
            if (!items || items.length === 0) break;
            
            allRawData = allRawData.concat(items);
            
            // Check Laravel pagination
            if (json.data && json.data.last_page) {
              if (page >= json.data.last_page) break;
            }
            
            page++;
          }
          
          return { success: true, allRawData, sample: allRawData.length > 0 ? allRawData[0] : null };
        } catch (e) {
          return { error: e.message };
        }
      },
      args: [authHeaders]
    });

    const res = result[0].result;
    
    if (res.error) {
      statusDiv.textContent = 'Error: ' + res.error;
      statusDiv.className = 'error';
      return;
    }

    if (!res.allRawData || res.allRawData.length === 0) {
      statusDiv.textContent = 'No records found, or you are not logged in.';
      statusDiv.className = 'error';
      return;
    }

    // Try to auto-map fields for PointHistory
    const mappedData = res.allRawData.map((item, index) => {
      // Fix date to only use YYYY-MM-DD directly without the trailing T...Z text
      let formattedDate = String(item.created_date || item.date || item.created_at || item.tanggal || '');
      if (formattedDate.includes('T')) {
          formattedDate = formattedDate.split('T')[0];
      } else if (formattedDate && !formattedDate.match(/[a-zA-Z]/)) { 
        // Likely YYYY-MM-DD logic fallback
        const dateObj = new Date(formattedDate);
        if (!isNaN(dateObj.getTime())) {
          const monthsId = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
          formattedDate = `${dateObj.getDate()} ${monthsId[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        }
      }

      const rawTxNo = item.transaction_no || item.id || item.transaction_id || item.invoice || item.no || '';
      const rawType = (item.type || item.operation || 'Unknown').toUpperCase().trim();

      // Map API type values to human-friendly display names
      const TYPE_LABELS = {
        'EXCLUSIVE': 'VC/MnG',
        'OFC_REGISTER': 'Membership Official',
      };
      const categoryType = TYPE_LABELS[rawType.toUpperCase()] || (item.type || item.operation || 'Unknown');
      let purpose = item.description || item.purpose || item.title || item.keterangan || item.category || categoryType || '';
      
      // Determine if it's a Topup strictly by checking if the transaction NO starts with "OJKTPT"
      const isTopup = String(rawTxNo).toUpperCase().startsWith('OJKTPT');
      const purposeLower = purpose.toLowerCase();
      const isExpired = purposeLower.includes('masa berlaku habis');
      
      // Override purpose to standard names if matched so charts work correctly
      if (isTopup) purpose = 'JKT48 POINTS';
      else if (isExpired) purpose = 'Masa Berlaku Habis';

      const rawBonus = item.bonusPoints || item.bonus_points || item.bonus || 0;
      
      const totalAmt = item.total_amount ?? item.buyPoints ?? item.points ?? item.point ?? item.total ?? item.amount ?? 0;
      const paymentAmt = item.payment_amount ?? totalAmt;
      const svcCharge = Math.max(0, paymentAmt - totalAmt);
      
      let rawBuy = totalAmt; // Requested: Instead of using payment amount, use total_amount for calculation

      // Ensure spendings are negative numbers and topups are positive
      // ONLY apply this math if the transaction was actually successful (PAID/Lunas)
      const statusText = String(item.payment_status || item.status || 'Lunas').toUpperCase();
      const isSuccessful = statusText === 'PAID' || statusText === 'LUNAS' || statusText === 'SUCCESS' || statusText === 'BERHASIL' || statusText === 'SETTLEMENT';

      if (!isSuccessful) {
        rawBuy = 0; // Don't affect totals if payment wasn't complete
      } else {
        if (!isTopup && !isExpired && rawBuy > 0) {
          rawBuy = -Math.abs(rawBuy);
        } else if ((isTopup || isExpired) && rawBuy < 0) {
          rawBuy = Math.abs(rawBuy);
        }
      }

      const qty = item.total_quantity ?? item.quantity ?? item.qty ?? item.jumlah ?? 1;

      return {
        operation: String(categoryType),
        category: String(categoryType),
        title: String(item.title || item.description || purpose || ''),
        id: String(rawTxNo || `api-${index}`),
        date: String(formattedDate),
        purpose: String(purpose),
        quantity: String(qty),
        bonusPoints: String(rawBonus).replace(' P', '') + ' P',
        buyPoints: String(rawBuy).replace(' P', '') + ' P',
        status: String(item.payment_status || item.status || 'Lunas'),
        paymentMethod: String(item.payment_method_name || item.payment_method || 'Unknown'),
        serviceCharge: String(svcCharge)
      };
    });

    const pointsData = {
      data: mappedData,
      timestamp: new Date().toISOString()
    };

    // Store in extension local
    await chrome.storage.local.set({ 'jkt48_points_history': pointsData });

    // Send to current tab to process into localStorage
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'POINTS_HISTORY_UPDATED',
        data: pointsData
      });
      
      // Update any tierlist tabs open
      const allTabs = await chrome.tabs.query({});
      for (const t of allTabs) {
        if (t.url && (
          t.url.includes('tierlistjkt48.my.id') || 
          t.url.includes('localhost') ||
          t.url.includes('vercel.app')
        )) {
          chrome.tabs.sendMessage(t.id, {
            type: 'POINTS_HISTORY_UPDATED',
            data: pointsData
          }).catch(err => console.error(err));
        }
      }
    } catch(err) {
      console.warn("Could not dispatch message to tabs:", err);
    }

    statusDiv.innerHTML = `Successfully collected ${mappedData.length} records via API!<br><br>Sample Data:<br><div class="code-preview">${JSON.stringify(res.sample, null, 2)}</div>`;
    
  } catch (error) {
    statusDiv.textContent = 'Extension Error: ' + error.message;
    statusDiv.className = 'error';
  }
});