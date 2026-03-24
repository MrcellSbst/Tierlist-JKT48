console.log('[JKT48 Extension] Background service worker started');

let capturedTokens = {};

chrome.webRequest.onSendHeaders.addListener(
  function (details) {
    let newTokens = false;
    if (details.requestHeaders) {
      for (let header of details.requestHeaders) {
        const headerName = header.name.toLowerCase();
        // Capture common authentication headers
        if (headerName === 'authorization' || headerName === 'x-csrf-token' || headerName === 'token' || headerName === 'x-xsrf-token') {
          if (capturedTokens[headerName] !== header.value) {
            capturedTokens[headerName] = header.value;
            newTokens = true;
          }
        }
      }
    }

    // If we found a new auth header, store it globally for popup.js to use
    if (newTokens) {
      chrome.storage.local.set({ 'jkt48_auth_headers': capturedTokens }, () => {
        console.log('[JKT48 Extension] Captured new API tokens:', capturedTokens);
      });
    }
  },
  { urls: ["*://jkt48.com/*", "*://*.jkt48.com/*"] },
  ["requestHeaders"] // Removed extraHeaders to ensure broad compatibility without errors if not needed
);
