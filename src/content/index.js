import { HOST, state } from './state.js';
import { applyRules, loadAndApply, initStorageListener } from './storage.js';
import { startPicker, stopPicker } from './picker.js';
import { startRevertPicker, stopRevertPicker } from './revert.js';

if (!window.__darkzookaLoaded) {
    window.__darkzookaLoaded = true;
    init();
}

function init() {
    state.styleEl = document.createElement('style');
    state.styleEl.id = '__darkzooka_styles';
    document.documentElement.appendChild(state.styleEl);

    loadAndApply();
    initStorageListener();
    initMessageBus();
}

function initMessageBus() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type === 'START_PICKER')        { startPicker();       sendResponse({ ok: true }); return; }
        if (msg.type === 'STOP_PICKER')         { stopPicker();        sendResponse({ ok: true }); return; }
        if (msg.type === 'START_REVERT_PICKER') { startRevertPicker(); sendResponse({ ok: true }); return; }
        if (msg.type === 'STOP_REVERT_PICKER')  { stopRevertPicker();  sendResponse({ ok: true }); return; }

        if (msg.type === 'SET_ENABLED') {
            state.siteEnabled = msg.enabled;
            applyRules(state.appliedRules);
            sendResponse({ ok: true });
            return;
        }

        if (msg.type === 'SET_DARKNESS') {
            state.darkness = msg.darkness;
            applyRules(state.appliedRules);
            sendResponse({ ok: true });
            return;
        }

        if (msg.type === 'REMOVE_RULE') {
            chrome.storage.local.get(['rules'], (data) => {
                const rules = data.rules || {};
                rules[HOST] = (rules[HOST] || []).filter(s => s !== msg.selector);
                chrome.storage.local.set({ rules }, () => {
                    applyRules(rules[HOST]);
                    sendResponse({ ok: true });
                });
            });
            return true;
        }

        if (msg.type === 'CLEAR_RULES') {
            chrome.storage.local.get(['rules'], (data) => {
                const rules = data.rules || {};
                rules[HOST] = [];
                chrome.storage.local.set({ rules }, () => {
                    applyRules([]);
                    sendResponse({ ok: true });
                });
            });
            return true;
        }
    });
}
