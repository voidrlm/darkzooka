import { HOST, state } from './state.js';
import { applyRules } from './storage.js';
import { getSelector } from '../shared/selectors.js';
import { darkVars, buildCSS } from '../shared/css.js';
import {
    ensureOverlayDOM, moveHighlight, hideOverlay,
    resetOverlayColor, setPickerCursor,
} from './overlay.js';

let previewStyleEl = null;

export function applyPreview(el) {
    if (!el) { clearPreview(); return; }
    if (!previewStyleEl) {
        previewStyleEl = document.createElement('style');
        previewStyleEl.id = '__darkzooka_preview';
        document.documentElement.appendChild(previewStyleEl);
    }
    document.documentElement.appendChild(previewStyleEl);
    const sel = getSelector(el);
    previewStyleEl.textContent = `:root{${darkVars(state.darkness)}}\n` + buildCSS([sel], state.exceptions);
}

export function clearPreview() {
    if (previewStyleEl) previewStyleEl.textContent = '';
}

function onMouseMove(e) {
    const el = e.target;
    if (el.id?.startsWith('__darkzooka')) return;
    state.hoveredEl    = el;
    state.pickerTarget = el;
    resetOverlayColor();
    moveHighlight(el, 'Tab ↑ &nbsp;] ↓');
    applyPreview(el);
}

function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const pt = document.elementFromPoint(e.clientX, e.clientY);
    const el = (pt && !pt.id?.startsWith('__darkzooka')) ? pt : (state.pickerTarget || state.hoveredEl);
    if (!el || el.id?.startsWith('__darkzooka')) return;

    const sel = getSelector(el);
    chrome.storage.local.get(['rules', 'settings'], (data) => {
        const rules     = data.rules || {};
        const settings  = data.settings || {};
        const siteRules = [...new Set([...(rules[HOST] || []), sel])];
        settings[HOST] = true;
        state.siteEnabled = true;
        rules[HOST] = siteRules;
        chrome.storage.local.set({ rules, settings }, () => {
            applyRules(siteRules, state.exceptions);
            chrome.runtime.sendMessage({ type: 'RULES_UPDATED' }).catch(() => {});
        });
    });
}

function onClick(e) { e.preventDefault(); e.stopPropagation(); }

function onKeyDown(e) {
    if (e.key === 'Escape') { stopPicker(); return; }
    if (e.key === 'Tab' || e.key === '[') {
        e.preventDefault();
        const parent = state.pickerTarget?.parentElement;
        if (parent && parent !== document.documentElement) {
            state.pickerTarget = parent;
            moveHighlight(state.pickerTarget);
            applyPreview(state.pickerTarget);
        }
        return;
    }
    if (e.key === ']') {
        e.preventDefault();
        if (state.pickerTarget && state.hoveredEl && state.pickerTarget !== state.hoveredEl) {
            let n = state.hoveredEl;
            while (n && n.parentElement !== state.pickerTarget) n = n.parentElement;
            if (n) { state.pickerTarget = n; moveHighlight(n); applyPreview(n); }
        }
    }
}

export function startPicker() {
    ensureOverlayDOM();
    state.pickerActive  = true;
    state.pickerTarget  = null;
    document.addEventListener('mousemove',   onMouseMove,   true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click',       onClick,       true);
    document.addEventListener('keydown',     onKeyDown,     true);
    setPickerCursor(true);
}

export function stopPicker() {
    state.pickerActive = false;
    document.removeEventListener('mousemove',   onMouseMove,   true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click',       onClick,       true);
    document.removeEventListener('keydown',     onKeyDown,     true);
    setPickerCursor(false);
    hideOverlay();
    clearPreview();
    chrome.runtime.sendMessage({ type: 'PICKER_STOPPED' }).catch(() => {});
}
