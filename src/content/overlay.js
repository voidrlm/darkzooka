import { getSelector } from '../shared/selectors.js';

let highlight   = null;
let pickerLabel = null;
let cursorStyle = null;

export function ensureOverlayDOM() {
    if (highlight) return;

    highlight = document.createElement('div');
    highlight.id = '__darkzooka_highlight';
    Object.assign(highlight.style, {
        position: 'fixed', pointerEvents: 'none', zIndex: '2147483646',
        border: '2px solid #7c3aed',
        boxShadow: '0 0 0 1px rgba(124,58,237,.3),inset 0 0 0 1px rgba(124,58,237,.3)',
        background: 'rgba(124,58,237,.08)', borderRadius: '3px',
        transition: 'all .08s ease', display: 'none',
    });

    pickerLabel = document.createElement('div');
    pickerLabel.id = '__darkzooka_label';
    Object.assign(pickerLabel.style, {
        position: 'fixed', zIndex: '2147483647', background: '#7c3aed',
        color: '#fff', fontSize: '11px', fontFamily: 'monospace',
        padding: '3px 7px', borderRadius: '4px', pointerEvents: 'none',
        display: 'none', maxWidth: '320px', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,.4)',
    });

    document.documentElement.appendChild(highlight);
    document.documentElement.appendChild(pickerLabel);
}

export function moveHighlight(el, hint = '') {
    const r = el.getBoundingClientRect();
    Object.assign(highlight.style, {
        display: 'block',
        top: r.top + 'px', left: r.left + 'px',
        width: r.width + 'px', height: r.height + 'px',
    });
    const sel = getSelector(el);
    pickerLabel.innerHTML = (hint ? `<span style="opacity:.6;font-size:10px;margin-right:6px">${hint}</span>` : '')
        + sel.replace(/</g, '&lt;');
    pickerLabel.style.display = 'block';
    const labelTop = r.top > 24 ? r.top - 24 : r.bottom + 4;
    pickerLabel.style.top  = labelTop + 'px';
    pickerLabel.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
}

export function hideOverlay() {
    if (!highlight) return;
    highlight.style.display   = 'none';
    pickerLabel.style.display = 'none';
}

export function setOverlayColor(borderColor, bgColor, shadowColor) {
    if (!highlight) return;
    highlight.style.borderColor = borderColor;
    highlight.style.background  = bgColor;
    highlight.style.boxShadow   = `0 0 0 1px ${shadowColor},inset 0 0 0 1px ${shadowColor}`;
    pickerLabel.style.background = borderColor;
}

export function resetOverlayColor() {
    setOverlayColor('#7c3aed', 'rgba(124,58,237,.08)', 'rgba(124,58,237,.3)');
}

export function setPickerCursor(active) {
    if (!cursorStyle) {
        cursorStyle = document.createElement('style');
        cursorStyle.id = '__darkzooka_picker_cursor';
        document.documentElement.appendChild(cursorStyle);
    }
    cursorStyle.textContent = active ? `html, html * { cursor: crosshair !important; }` : '';
}
