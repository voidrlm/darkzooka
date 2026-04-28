export function isStableId(id) {
    if (!id || id.length > 20) return false;
    if (/[A-Z]\d[a-zA-Z]|[a-zA-Z]\d[A-Z]/.test(id)) return false;
    if (/[A-Z]{2}\d|\d[A-Z]{2}/.test(id)) return false;
    return true;
}

export function isStableClass(cls) {
    if (!cls || cls.length < 2) return false;
    if (/^_[A-Z0-9]/.test(cls)) return false;
    if (/^_\d/.test(cls)) return false;
    if (cls.length <= 6 && /\d/.test(cls) && /[a-zA-Z]/.test(cls)) return false;
    if (/[_-][A-Z][a-z0-9]{1,4}$/.test(cls)) return false;
    if (/[_-][a-z0-9]{1,3}[A-Z][a-z]{0,2}$/.test(cls)) return false;
    if (/[a-z]\d[A-Z]|[A-Z]\d[a-z]/.test(cls)) return false;
    return true;
}

export function decodeCssEscapes(str) {
    return str.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_m, esc) => {
        if (/^[0-9a-fA-F]/.test(esc)) {
            const cp = parseInt(esc.trim(), 16);
            return Number.isNaN(cp) ? '' : String.fromCodePoint(cp);
        }
        return esc;
    });
}

export function compressNumericPrefix(id) {
    if (!/^\d+$/.test(id)) return id;
    if (id.length >= 3) return id.slice(0, 1);
    return id;
}

export function extractIdPattern(rawId) {
    const id = decodeCssEscapes(rawId);

    const mHexTail = id.match(/^(.+[-_])[0-9a-f]{6,}$/i);
    if (mHexTail && mHexTail[1].length >= 2) return { prefix: mHexTail[1], suffix: null };

    const mGenericMid = id.match(/^(.+?)(\d+)([^\d].+)$/);
    if (mGenericMid && mGenericMid[1].length >= 2 && mGenericMid[3].length >= 2)
        return { prefix: mGenericMid[1], suffix: mGenericMid[3] };

    const mMid = id.match(/^([\w-]*?\D[-_])(\d+)([-_]\D[\w-]*)$/);
    if (mMid && mMid[1].length >= 2) return { prefix: mMid[1], suffix: mMid[3] };

    const mEnd = id.match(/^(.+?)([-_]?\d+)$/);
    if (mEnd && mEnd[1].length >= 2) return { prefix: mEnd[1], suffix: null };

    if (/^\d{4,}$/.test(id)) return { prefix: compressNumericPrefix(id), suffix: null };

    return null;
}

export function idSel(id) {
    const pattern = extractIdPattern(id);
    if (pattern) {
        return pattern.suffix
            ? `[id^="${pattern.prefix}"][id$="${pattern.suffix}"]`
            : `[id^="${pattern.prefix}"]`;
    }
    return '#' + CSS.escape(id);
}

export function normalizeSel(sel) {
    return sel.replace(/\.[^\s.#\[>+~]+/g, cls => isStableClass(cls.slice(1)) ? cls : '')
              .replace(/\s{2,}/g, ' ').trim();
}
