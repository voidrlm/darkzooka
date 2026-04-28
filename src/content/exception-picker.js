import { HOST, state } from './state.js';
import { applyRules } from './storage.js';
import { getSelector } from '../shared/selectors.js';
import {
    ensureOverlayDOM, moveHighlight, hideOverlay,
    setOverlayColor, resetOverlayColor, setPickerCursor,
} from './overlay.js';
import {
    hideExceptionOptions,
    isExceptionOptionsNode,
    renderExceptionOptions,
} from './exception-options.js';

let baseExceptions = [];
let savedExceptions = null;
let lastOptionsRoot = null;

function previewSelector(sel) {
    const previewExceptions = [...new Set([...baseExceptions, sel])];
    setOverlayColor('#3fb950', 'rgba(63,185,80,.08)', 'rgba(63,185,80,.35)');
    applyRules(state.appliedRules, previewExceptions);
}

function previewException(el) {
    if (!el) return;
    previewSelector(getSelector(el));
}

function clearPreview() {
    applyRules(state.appliedRules, savedExceptions || baseExceptions);
    resetOverlayColor();
}

function saveException(selector) {
    chrome.storage.local.get(['exceptions'], (data) => {
        const exceptions = data.exceptions || {};
        const siteExceptions = [...new Set([...(exceptions[HOST] || []), selector])];
        exceptions[HOST] = siteExceptions;
        chrome.storage.local.set({ exceptions }, () => {
            savedExceptions = siteExceptions;
            applyRules(state.appliedRules, siteExceptions);
            stopExceptionPicker();
            chrome.runtime.sendMessage({ type: 'EXCEPTIONS_UPDATED' }).catch(() => {});
        });
    });
}

function showChildOptions(root) {
    if (!root || root === lastOptionsRoot) return;
    lastOptionsRoot = root;
    renderExceptionOptions(root, {
        previewSelector,
        pickSelector: saveException,
    });
}

function onMouseMove(e) {
    if (isExceptionOptionsNode(e.target)) return;
    const el = e.target;
    if (el.id?.startsWith('__darkzooka')) return;
    state.hoveredEl    = el;
    state.pickerTarget = el;
    moveHighlight(el, 'Tab up &nbsp;] down');
    previewException(el);
    showChildOptions(el);
}

function onPointerDown(e) {
    if (isExceptionOptionsNode(e.target)) return;
    e.preventDefault();
    e.stopPropagation();

    const pt = document.elementFromPoint(e.clientX, e.clientY);
    const el = (pt && !pt.id?.startsWith('__darkzooka')) ? pt : (state.pickerTarget || state.hoveredEl);
    if (!el || el.id?.startsWith('__darkzooka')) return;

    saveException(getSelector(el));
}

function onClick(e) {
    if (isExceptionOptionsNode(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
}

function onKeyDown(e) {
    if (e.key === 'Escape') { stopExceptionPicker(); return; }
    if (e.key === 'Tab' || e.key === '[') {
        e.preventDefault();
        const parent = state.pickerTarget?.parentElement;
        if (parent && parent !== document.documentElement) {
            state.pickerTarget = parent;
            moveHighlight(parent, 'Tab up &nbsp;] down');
            previewException(parent);
            showChildOptions(parent);
        }
        return;
    }
    if (e.key === ']') {
        e.preventDefault();
        if (state.pickerTarget && state.hoveredEl && state.pickerTarget !== state.hoveredEl) {
            let n = state.hoveredEl;
            while (n && n.parentElement !== state.pickerTarget) n = n.parentElement;
            if (n) {
                state.pickerTarget = n;
                moveHighlight(n, 'Tab up &nbsp;] down');
                previewException(n);
                showChildOptions(n);
            }
        }
    }
}

export function startExceptionPicker() {
    ensureOverlayDOM();
    state.exceptionPickerActive = true;
    state.pickerTarget = null;
    baseExceptions = [...state.exceptions];
    savedExceptions = null;
    lastOptionsRoot = null;
    document.addEventListener('mousemove',   onMouseMove,   true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click',       onClick,       true);
    document.addEventListener('keydown',     onKeyDown,     true);
    setPickerCursor(true);
}

export function stopExceptionPicker() {
    state.exceptionPickerActive = false;
    document.removeEventListener('mousemove',   onMouseMove,   true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click',       onClick,       true);
    document.removeEventListener('keydown',     onKeyDown,     true);
    setPickerCursor(false);
    hideOverlay();
    hideExceptionOptions();
    clearPreview();
    chrome.runtime.sendMessage({ type: 'EXCEPTION_PICKER_STOPPED' }).catch(() => {});
}
