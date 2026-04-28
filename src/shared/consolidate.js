import { decodeCssEscapes, compressNumericPrefix, extractIdPattern, normalizeSel } from './utils.js';

export function consolidate(selectors) {
    function parse(sel) {
        const norm   = normalizeSel(sel);
        const sp     = norm.startsWith('#') ? norm.indexOf(' ') : -1;
        const anchor = sp === -1 ? (norm.startsWith('#') ? norm : '') : norm.slice(0, sp);
        const desc   = sp === -1 ? (norm.startsWith('#') ? '' : norm) : norm.slice(sp + 1);
        let prefix = null, suffix = null;
        if (anchor.startsWith('#')) {
            const pattern = extractIdPattern(anchor.slice(1));
            if (pattern) { prefix = pattern.prefix; suffix = pattern.suffix; }
        } else if (anchor.startsWith('[id^="')) {
            const m = anchor.match(/^\[id\^="([^"]+)"\](?:\[id\$="([^"]+)"\])?$/);
            if (m) {
                prefix = compressNumericPrefix(decodeCssEscapes(m[1]));
                suffix = m[2] ? decodeCssEscapes(m[2]) : null;
            }
        }
        return { orig: sel, anchor, desc, prefix, suffix };
    }

    const parsed = selectors.map(parse);
    const groups = new Map();
    for (const item of parsed) {
        if (!item.prefix) continue;
        const key = item.prefix + '\0' + (item.suffix || '') + '\0' + item.desc;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    }

    const consumed = new Set();
    const result   = [];
    for (const group of groups.values()) {
        if (group.length < 2) continue;
        group.forEach(i => consumed.add(i.orig));
        const { prefix, suffix, desc } = group[0];
        const merged = suffix ? `[id^="${prefix}"][id$="${suffix}"]` : `[id^="${prefix}"]`;
        result.push(desc ? `${merged} ${desc}` : merged);
    }
    for (const item of parsed) {
        if (consumed.has(item.orig)) continue;
        const clean = item.anchor
            ? (item.anchor + (item.desc ? ' ' + item.desc : ''))
            : normalizeSel(item.orig);
        result.push(clean);
    }
    return [...new Set(result)];
}
