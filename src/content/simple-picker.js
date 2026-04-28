import { HOST, state } from './state.js';
import { applyRules } from './storage.js';
import { darkVars, buildCSS } from '../shared/css.js';
import {
    ensureOverlayDOM, moveHighlight, hideOverlay,
    resetOverlayColor, setPickerCursor,
} from './overlay.js';

function getSimpleSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const tag     = el.tagName.toLowerCase();
    const classes = [...el.classList].map(c => '.' + CSS.escape(c)).join('');
    return tag + classes || tag;
}

let previewStyleEl = null;

function applyPreview(el) {
    if (!previewStyleEl) {
        previewStyleEl = document.createElement('style');
        previewStyleEl.id = '__darkzooka_simple_preview';
        document.documentElement.appendChild(previewStyleEl);
    }
    const sel = getSimpleSelector(el);
    previewStyleEl.textContent = `:root{${darkVars(state.darkness)}}\n` + buildCSS([sel]);
}

function clearPreview() {
    if (previewStyleEl) previewStyleEl.textContent = '';
}

function onMouseMove(e) {
    const el = e.target;
    if (el.id?.startsWith('__darkzooka')) return;
    state.hoveredEl    = el;
    state.pickerTarget = el;
    resetOverlayColor();
    moveHighlight(el);
    applyPreview(el);
}

function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const pt = document.elementFromPoint(e.clientX, e.clientY);
    const el = (pt && !pt.id?.startsWith('__darkzooka')) ? pt : state.hoveredEl;
    if (!el || el.id?.startsWith('__darkzooka')) return;

    const sel = getSimpleSelector(el);
    chrome.storage.local.get(['rules'], (data) => {
        const rules     = data.rules || {};
        const siteRules = [...new Set([...(rules[HOST] || []), sel])];
        rules[HOST] = siteRules;
        chrome.storage.local.set({ rules }, () => {
            applyRules(siteRules);
            chrome.runtime.sendMessage({ type: 'RULES_UPDATED' }).catch(() => {});
        });
    });
}

function onClick(e) { e.preventDefault(); e.stopPropagation(); }

function onKeyDown(e) {
    if (e.key === 'Escape') stopSimplePicker();
}

export function startSimplePicker() {
    ensureOverlayDOM();
    state.simplePickerActive = true;
    state.pickerTarget       = null;
    document.addEventListener('mousemove',   onMouseMove,   true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click',       onClick,       true);
    document.addEventListener('keydown',     onKeyDown,     true);
    setPickerCursor(true);
}

export function stopSimplePicker() {
    state.simplePickerActive = false;
    document.removeEventListener('mousemove',   onMouseMove,   true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click',       onClick,       true);
    document.removeEventListener('keydown',     onKeyDown,     true);
    setPickerCursor(false);
    hideOverlay();
    clearPreview();
    chrome.runtime.sendMessage({ type: 'SIMPLE_PICKER_STOPPED' }).catch(() => {});
}
