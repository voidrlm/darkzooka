import { HOST, state } from './state.js';
import { darkVars, buildCSS } from '../shared/css.js';

function isStorageAvailable() {
    return typeof chrome !== 'undefined'
        && chrome.runtime?.id
        && chrome.storage?.local
        && chrome.storage?.onChanged;
}

export function applyRules(selectors) {
    state.appliedRules = selectors;
    if (state.styleEl?.parentNode) {
        document.documentElement.appendChild(state.styleEl);
    }
    state.styleEl.textContent = (state.siteEnabled && selectors.length)
        ? `:root{${darkVars(state.darkness)}}\n` + buildCSS(selectors)
        : '';
    window.__darkzookaDebug = {
        host: HOST,
        enabled: state.siteEnabled,
        darkness: state.darkness,
        rules: state.appliedRules,
        cssLength: state.styleEl?.textContent.length || 0,
    };
}

export function loadAndApply() {
    if (!isStorageAvailable()) return;

    try {
        chrome.storage.local.get(['rules', 'settings'], (data) => {
            if (chrome.runtime.lastError) return;

            const settings   = data.settings || {};
            state.siteEnabled = settings[HOST] !== false;
            state.darkness    = settings.__darkness ?? 100;
            applyRules((data.rules || {})[HOST] || []);
        });
    } catch (_err) {
        // The extension can be reloaded while an old content script is still alive.
    }
}

export function initStorageListener() {
    if (!isStorageAvailable()) return;

    try {
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
    } catch (_err) {
        // The extension can be reloaded while an old content script is still alive.
    }
}
