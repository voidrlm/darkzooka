// Relay-only messages that content scripts can't send to themselves
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SAVE_SETTINGS') {
        chrome.storage.local.set({ settings: msg.settings }, () => sendResponse({ ok: true }));
        return true;
    }
});
