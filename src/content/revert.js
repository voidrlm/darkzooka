import { HOST, state } from './state.js';
import { applyRules } from './storage.js';
import { darkVars, buildCSS } from '../shared/css.js';
import {
    ensureOverlayDOM, moveHighlight, hideOverlay,
    setOverlayColor, resetOverlayColor, setPickerCursor,
} from './overlay.js';

function findMatchingRules(el) {
    return state.appliedRules.filter(sel => {
        try { return !!el.closest(sel); } catch { return false; }
    });
}

function applyRevertPreview(el) {
    if (!el) { clearRevertPreview(); return; }
    const matching = findMatchingRules(el);
    state.revertPreviewActive = true;
    const remaining = state.appliedRules.filter(s => !matching.includes(s));
    state.styleEl.textContent = (state.siteEnabled && remaining.length)
        ? `:root{${darkVars(state.darkness)}}\n` + buildCSS(remaining)
        : '';
    if (matching.length > 0) {
        setOverlayColor('#f85149', 'rgba(248,81,73,.06)', 'rgba(248,81,73,.3)');
    } else {
        setOverlayColor('#484f58', 'rgba(72,79,88,.06)', 'rgba(72,79,88,.3)');
    }
}

function clearRevertPreview() {
    if (!state.revertPreviewActive) return;
    state.revertPreviewActive = false;
    state.styleEl.textContent = (state.siteEnabled && state.appliedRules.length)
        ? `:root{${darkVars(state.darkness)}}\n` + buildCSS(state.appliedRules)
        : '';
    resetOverlayColor();
}

function onMouseMove(e) {
    const el = e.target;
    if (el.id?.startsWith('__darkzooka')) return;
    state.hoveredEl    = el;
    state.pickerTarget = el;
    moveHighlight(el, 'Tab ↑ &nbsp;] ↓');
    applyRevertPreview(el);
}

function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const pt = document.elementFromPoint(e.clientX, e.clientY);
    const el = (pt && !pt.id?.startsWith('__darkzooka')) ? pt : (state.pickerTarget || state.hoveredEl);
    if (!el || el.id?.startsWith('__darkzooka')) return;

    const matching = findMatchingRules(el);
    if (!matching.length) return;

    chrome.storage.local.get(['rules'], (data) => {
        const rules = data.rules || {};
        rules[HOST] = (rules[HOST] || []).filter(s => !matching.includes(s));
        chrome.storage.local.set({ rules }, () => {
            state.revertPreviewActive = false;
            applyRules(rules[HOST]);
            chrome.runtime.sendMessage({ type: 'RULES_UPDATED' }).catch(() => {});
        });
    });
}

function onClick(e) { e.preventDefault(); e.stopPropagation(); }

function onKeyDown(e) {
    if (e.key === 'Escape') { stopRevertPicker(); return; }
    if (e.key === 'Tab' || e.key === '[') {
        e.preventDefault();
        const parent = state.pickerTarget?.parentElement;
        if (parent && parent !== document.documentElement) {
            state.pickerTarget = parent;
            moveHighlight(state.pickerTarget);
            applyRevertPreview(state.pickerTarget);
        }
        return;
    }
    if (e.key === ']') {
        e.preventDefault();
        if (state.pickerTarget && state.hoveredEl && state.pickerTarget !== state.hoveredEl) {
            let n = state.hoveredEl;
            while (n && n.parentElement !== state.pickerTarget) n = n.parentElement;
            if (n) { state.pickerTarget = n; moveHighlight(n); applyRevertPreview(n); }
        }
    }
}

export function startRevertPicker() {
    ensureOverlayDOM();
    state.revertPickerActive = true;
    state.pickerTarget       = null;
    document.addEventListener('mousemove',   onMouseMove,   true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click',       onClick,       true);
    document.addEventListener('keydown',     onKeyDown,     true);
    setPickerCursor(true);
}

export function stopRevertPicker() {
    state.revertPickerActive = false;
    document.removeEventListener('mousemove',   onMouseMove,   true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click',       onClick,       true);
    document.removeEventListener('keydown',     onKeyDown,     true);
    setPickerCursor(false);
    hideOverlay();
    clearRevertPreview();
    chrome.runtime.sendMessage({ type: 'REVERT_PICKER_STOPPED' }).catch(() => {});
}
