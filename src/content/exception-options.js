import { moveHighlight } from './overlay.js';
import { getSelector } from '../shared/selectors.js';

let panel = null;
let activeRoot = null;
let handlers = null;

function isDarkzookaNode(el) {
    return !!el.closest?.('[id^="__darkzooka"]');
}

function isVisible(el) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width >= 8
        && r.height >= 8
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0';
}

function labelFor(el) {
    const tag = el.tagName.toLowerCase();
    const aria = el.getAttribute('aria-label');
    const testId = el.getAttribute('data-testid');
    const role = el.getAttribute('role');
    const id = el.id ? `#${el.id}` : '';
    const cls = [...el.classList]
        .filter(c => !c.startsWith('__darkzooka'))
        .slice(0, 2)
        .map(c => `.${c}`)
        .join('');
    const name = aria || testId || role || id || cls || tag;
    return `${tag} ${name}`.trim();
}

function score(el) {
    let n = 0;
    if (el === activeRoot) n += 100;
    if (el.matches('button,a,input,select,textarea,img,video')) n += 40;
    if (el.hasAttribute('aria-label')) n += 30;
    if (el.hasAttribute('data-testid')) n += 25;
    if (el.hasAttribute('role')) n += 15;
    if (el.id) n += 10;
    if (el.classList.length) n += 5;
    const r = el.getBoundingClientRect();
    n += Math.min(20, (r.width * r.height) / 6000);
    return n;
}

function collectOptions(root) {
    const seen = new Set();
    return [root, ...root.querySelectorAll('*')]
        .filter(el => el.nodeType === 1 && !isDarkzookaNode(el) && isVisible(el))
        .map(el => {
            let selector = '';
            try { selector = getSelector(el); } catch { return null; }
            if (!selector || seen.has(selector)) return null;
            seen.add(selector);
            return { el, selector, label: labelFor(el), score: score(el) };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 24);
}

function ensurePanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = '__darkzooka_exception_options';
    panel.dataset.darkzookaPanel = 'true';
    Object.assign(panel.style, {
        position: 'fixed',
        zIndex: '2147483647',
        width: '300px',
        maxHeight: '340px',
        overflowY: 'auto',
        background: '#0d1117',
        color: '#e6edf3',
        border: '1px solid rgba(63,185,80,.75)',
        borderRadius: '6px',
        boxShadow: '0 12px 28px rgba(0,0,0,.45)',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        fontSize: '12px',
        padding: '8px',
    });
    document.documentElement.appendChild(panel);
    return panel;
}

function positionPanel(root) {
    const r = root.getBoundingClientRect();
    const p = ensurePanel();
    const gap = 8;
    const rightSpace = window.innerWidth - r.right;
    const left = rightSpace >= 320 ? r.right + gap : Math.max(8, Math.min(r.left, window.innerWidth - 308));
    const top = Math.max(8, Math.min(r.top, window.innerHeight - 360));
    p.style.left = `${left}px`;
    p.style.top = `${top}px`;
}

export function isExceptionOptionsNode(el) {
    return !!el.closest?.('[data-darkzooka-panel="true"]');
}

export function renderExceptionOptions(root, nextHandlers) {
    if (!root || isDarkzookaNode(root)) return;
    activeRoot = root;
    handlers = nextHandlers;
    const options = collectOptions(root);
    const p = ensurePanel();
    positionPanel(root);

    p.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Exception options inside selection';
    Object.assign(title.style, {
        color: '#3fb950',
        fontWeight: '700',
        margin: '0 0 6px',
        fontSize: '12px',
    });
    p.appendChild(title);

    options.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = item.selector;
        btn.dataset.selector = item.selector;
        btn.textContent = `${index + 1}. ${item.label}`;
        Object.assign(btn.style, {
            display: 'block',
            width: '100%',
            minHeight: '28px',
            margin: '0 0 4px',
            padding: '6px 8px',
            border: '1px solid #30363d',
            borderRadius: '4px',
            background: '#161b22',
            color: '#e6edf3',
            font: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        });
        btn.addEventListener('mouseenter', () => {
            moveHighlight(item.el, 'Exception option');
            handlers?.previewSelector(item.selector);
        });
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handlers?.pickSelector(item.selector);
        });
        p.appendChild(btn);
    });
}

export function hideExceptionOptions() {
    if (panel) panel.remove();
    panel = null;
    activeRoot = null;
    handlers = null;
}
