import { HOST, state } from './state.js';
import { darkVars, buildCSS } from '../shared/css.js';

export function applyRules(selectors) {
    state.appliedRules = selectors;
    state.styleEl.textContent = (state.siteEnabled && selectors.length)
        ? `:root{${darkVars(state.darkness)}}\n` + buildCSS(selectors)
        : '';
}

export function loadAndApply() {
    chrome.storage.local.get(['rules', 'settings'], (data) => {
        const settings   = data.settings || {};
        state.siteEnabled = settings[HOST] !== false;
        state.darkness    = settings.__darkness ?? 100;
        applyRules((data.rules || {})[HOST] || []);
    });
}

export function initStorageListener() {
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.rules) {
            applyRules((changes.rules.newValue || {})[HOST] || []);
        }
        if (changes.settings) {
            const s = changes.settings.newValue || {};
            state.siteEnabled = s[HOST] !== false;
            state.darkness    = s.__darkness ?? 100;
            applyRules(state.appliedRules);
        }
    });
}
