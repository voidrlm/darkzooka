import { isStableId, isStableClass, idSel } from './utils.js';

export function stableClasses(node) {
    return [...node.classList]
        .filter(c => !c.startsWith('__darkzooka') && isStableClass(c))
        .slice(0, 2)
        .map(c => '.' + CSS.escape(c))
        .join('');
}

export function nodeDesc(node, withNth = true) {
    const tag = node.tagName.toLowerCase();
    const cls = stableClasses(node);
    let part  = tag + cls;
    if (withNth && !cls) {
        const siblings = node.parentElement
            ? [...node.parentElement.children].filter(s => s.tagName === node.tagName)
            : [];
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    return part;
}

export function getSelector(el) {
    if (el.id && isStableId(el.id)) return idSel(el.id);

    let anchor = null, anchorSel = '';
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        if (p.id && isStableId(p.id)) { anchor = p; anchorSel = idSel(p.id); break; }
    }

    if (anchor) {
        const targetWithClasses = nodeDesc(el, false);
        if (targetWithClasses.includes('.')) return anchorSel + ' ' + targetWithClasses;

        const path = [];
        for (let n = el; n && n !== anchor; n = n.parentElement) {
            const cls = stableClasses(n);
            if (cls || n === el) path.unshift(nodeDesc(n));
        }
        return anchorSel + ' ' + path.slice(-2).join(' ');
    }

    const parts = [];
    let node = el, depth = 0;
    while (node && node !== document.body && node.nodeType === 1 && depth < 4) {
        if (node.id && isStableId(node.id)) { parts.unshift(idSel(node.id)); break; }
        parts.unshift(nodeDesc(node));
        node = node.parentElement;
        depth++;
    }
    return parts.slice(-2).join(' ');
}
