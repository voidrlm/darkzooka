(() => {
    if (window.__darkzookaLoaded) return;
    window.__darkzookaLoaded = true;

    const HOST = location.hostname;
    let pickerActive   = false;
    let hoveredEl      = null;
    let appliedRules   = [];
    let siteEnabled    = true;
    let darkness       = 100;   // 10–100

    // ── Style tag injected synchronously — no flash ───────────────────────
    const styleEl = document.createElement('style');
    styleEl.id = '__darkzooka_styles';
    document.documentElement.appendChild(styleEl);

    // CSS variables computed from darkness level (10–100).
    // 100 = deep black (GitHub Dark), 10 = Dracula-style charcoal.
    // Blends between two dark palettes — never goes near white.
    function darkVars(pct) {
        return `
            --dz-bg:color-mix(in srgb,#0d1117 ${pct}%,#282a36);
            --dz-surface:color-mix(in srgb,#161b22 ${pct}%,#313442);
            --dz-card:color-mix(in srgb,#1c2128 ${pct}%,#383a4a);
            --dz-border:color-mix(in srgb,#30363d ${pct}%,#44475a);
            --dz-text:color-mix(in srgb,#e6edf3 ${pct}%,#f8f8f2);
            --dz-link:color-mix(in srgb,#58a6ff ${pct}%,#8be9fd);
        `;
    }

    function buildCSS(selectors) {
        return selectors.map(s => `
${s}{background-color:var(--dz-bg)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}
${s} *{color:var(--dz-text)!important;border-color:var(--dz-border)!important}
${s} a,${s} a *{color:var(--dz-link)!important}
${s} input,${s} textarea,${s} select{background-color:var(--dz-surface)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}
${s} button{background-color:var(--dz-card)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}
${s} [style*="background"],${s} [style*="background-color"]{background-color:var(--dz-surface)!important}
${s} img{filter:brightness(.9)!important}`).join('\n');
    }

    function applyRules(selectors) {
        appliedRules = selectors;
        styleEl.textContent = (siteEnabled && selectors.length)
            ? `:root{${darkVars(darkness)}}\n` + buildCSS(selectors)
            : '';
    }

    // ── Read storage directly — skips background IPC round-trip ──────────
    function loadAndApply() {
        chrome.storage.local.get(['rules', 'settings'], (data) => {
            const settings = data.settings || {};
            siteEnabled = settings[HOST] !== false;
            darkness    = settings.__darkness ?? 100;
            applyRules((data.rules || {})[HOST] || []);
        });
    }

    // Apply immediately — script runs at document_start, page hasn't painted yet
    loadAndApply();

    // ── Storage change listener — keep in sync across tabs ────────────────
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.rules) {
            applyRules((changes.rules.newValue || {})[HOST] || []);
        }
        if (changes.settings) {
            const s = changes.settings.newValue || {};
            siteEnabled = s[HOST] !== false;
            darkness    = s.__darkness ?? 100;
            applyRules(appliedRules);
        }
    });

    // ── CSS selector generation ───────────────────────────────────────────

    function isStableId(id) {
        if (!id || id.length > 20) return false;
        if (/[A-Z]\d[a-zA-Z]|[a-zA-Z]\d[A-Z]/.test(id)) return false;
        if (/[A-Z]{2}\d|\d[A-Z]{2}/.test(id)) return false;
        return true;
    }

    function isStableClass(cls) {
        if (!cls || cls.length < 2) return false;
        if (/^_[A-Z0-9]/.test(cls)) return false;
        if (/^_\d/.test(cls)) return false;
        if (cls.length <= 6 && /\d/.test(cls) && /[a-zA-Z]/.test(cls)) return false;
        if (/[_-][A-Z][a-z0-9]{1,4}$/.test(cls)) return false;
        if (/[_-][a-z0-9]{1,3}[A-Z][a-z]{0,2}$/.test(cls)) return false;
        if (/[a-z]\d[A-Z]|[A-Z]\d[a-z]/.test(cls)) return false;
        return true;
    }

    // Stable classes for a node, up to 2, as a ".cls" string.
    function stableClasses(node) {
        return [...node.classList]
            .filter(c => !c.startsWith('__darkzooka') && isStableClass(c))
            .slice(0, 2)
            .map(c => '.' + CSS.escape(c))
            .join('');
    }

    // Descriptor for a single node: tag + stable classes.
    // nth-of-type is only appended when the node has no stable classes
    // AND has siblings of the same tag (last resort).
    function nodeDesc(node, withNth = true) {
        const tag  = node.tagName.toLowerCase();
        const cls  = stableClasses(node);
        let part   = tag + cls;
        if (withNth && !cls) {
            const siblings = node.parentElement
                ? [...node.parentElement.children].filter(s => s.tagName === node.tagName)
                : [];
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
        return part;
    }

    function decodeCssEscapes(str) {
        return str.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_m, esc) => {
            if (/^[0-9a-fA-F]/.test(esc)) {
                const hex = esc.trim();
                const cp = parseInt(hex, 16);
                return Number.isNaN(cp) ? '' : String.fromCodePoint(cp);
            }
            return esc;
        });
    }

    function compressNumericPrefix(id) {
        if (!/^\d+$/.test(id)) return id;
        // Ultra-broad mode: one numeric bucket covers all related IDs.
        if (id.length >= 3) return id.slice(0, 1);
        return id;
    }

    function extractIdPattern(rawId) {
        const id = decodeCssEscapes(rawId);
        const mHexTail = id.match(/^(.+[-_])[0-9a-f]{6,}$/i);
        if (mHexTail && mHexTail[1].length >= 2) return { prefix: mHexTail[1], suffix: null };

        const mGenericMid = id.match(/^(.+?)(\d+)([^\d].+)$/);
        if (mGenericMid && mGenericMid[1].length >= 2 && mGenericMid[3].length >= 2) {
            return { prefix: mGenericMid[1], suffix: mGenericMid[3] };
        }

        const mMid = id.match(/^([\w-]*?\D[-_])(\d+)([-_]\D[\w-]*)$/);
        if (mMid && mMid[1].length >= 2) return { prefix: mMid[1], suffix: mMid[3] };

        const mEnd = id.match(/^(.+?)([-_]?\d+)$/);
        if (mEnd && mEnd[1].length >= 2) return { prefix: mEnd[1], suffix: null };

        // Numeric-only IDs like "171555" are often sequential.
        if (/^\d{4,}$/.test(id)) return { prefix: compressNumericPrefix(id), suffix: null };

        return null;
    }

    function idSel(id) {
        const pattern = extractIdPattern(id);
        if (pattern) {
            return pattern.suffix
                ? `[id^="${pattern.prefix}"][id$="${pattern.suffix}"]`
                : `[id^="${pattern.prefix}"]`;
        }
        return '#' + CSS.escape(id);
    }

    function getSelector(el) {
        if (el.id && isStableId(el.id)) {
            return idSel(el.id);
        }

        // Find the nearest stable-ID ancestor to use as an anchor.
        let anchor = null;
        let anchorSel = '';
        for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
            if (p.id && isStableId(p.id)) {
                anchor = p;
                anchorSel = idSel(p.id);
                break;
            }
        }

        if (anchor) {
            // Prefer compact selector: anchor + the picked node itself
            // when the node has stable classes (far less brittle than full path).
            const targetWithClasses = nodeDesc(el, false);
            if (targetWithClasses.includes('.')) {
                return anchorSel + ' ' + targetWithClasses;
            }

            const path = [];
            for (let n = el; n && n !== anchor; n = n.parentElement) {
                const cls = stableClasses(n);
                if (cls || n === el) {
                    path.unshift(nodeDesc(n));
                }
            }
            // Keep only the most relevant tail to avoid over-specific selectors.
            const compactPath = path.slice(-2);
            return anchorSel + ' ' + compactPath.join(' ');
        }

        // No stable-ID ancestor — build a short class-based path (max 4 levels).
        const parts = [];
        let node = el, depth = 0;
        while (node && node !== document.body && node.nodeType === 1 && depth < 4) {
            if (node.id && isStableId(node.id)) {
                parts.unshift(idSel(node.id));
                break;
            }
            parts.unshift(nodeDesc(node));
            node = node.parentElement;
            depth++;
        }
        return parts.slice(-2).join(' ');
    }

    // ── Picker overlay — created lazily on first use ───────────────────────
    let highlight   = null;
    let pickerLabel = null;
    let pickerTarget = null;   // may differ from hoveredEl when Tab is used

    function ensurePickerDOM() {
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

    function moveHighlight(el) {
        const r = el.getBoundingClientRect();
        Object.assign(highlight.style, {
            display: 'block',
            top: r.top + 'px', left: r.left + 'px',
            width: r.width + 'px', height: r.height + 'px',
        });
        const sel = getSelector(el);
        pickerLabel.innerHTML =
            `<span style="opacity:.6;font-size:10px;margin-right:6px">Tab ↑ &nbsp;] ↓</span>${sel.replace(/</g,'&lt;')}`;
        pickerLabel.style.display = 'block';
        const labelTop = r.top > 24 ? r.top - 24 : r.bottom + 4;
        pickerLabel.style.top = labelTop + 'px';
        pickerLabel.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
    }

    function hideHighlight() {
        if (!highlight) return;
        highlight.style.display = 'none';
        pickerLabel.style.display = 'none';
    }

    // ── Picker dark preview ───────────────────────────────────────────────
    let previewStyleEl = null;
    let pickerCursorStyleEl = null;

    function applyPreview(el) {
        if (!el) { clearPreview(); return; }
        if (!previewStyleEl) {
            previewStyleEl = document.createElement('style');
            previewStyleEl.id = '__darkzooka_preview';
            document.documentElement.appendChild(previewStyleEl);
        }
        const sel = getSelector(el);
        previewStyleEl.textContent = `:root{${darkVars(darkness)}}\n` + buildCSS([sel]);
    }

    function clearPreview() {
        if (previewStyleEl) previewStyleEl.textContent = '';
    }

    function setPickerCursor(active) {
        if (!pickerCursorStyleEl) {
            pickerCursorStyleEl = document.createElement('style');
            pickerCursorStyleEl.id = '__darkzooka_picker_cursor';
            document.documentElement.appendChild(pickerCursorStyleEl);
        }
        pickerCursorStyleEl.textContent = active
            ? `html, html * { cursor: crosshair !important; }`
            : '';
    }

    // ── Rule consolidation ────────────────────────────────────────────────

    // Strips unstable classes from a stored selector string so that
    // "#desktop-grid-1 div.a-cardui._HashAbc" normalizes to
    // "#desktop-grid-1 div.a-cardui" before grouping.
    function normalizeSel(sel) {
        return sel.replace(/\.[^\s.#\[>+~]+/g, cls => isStableClass(cls.slice(1)) ? cls : '')
                  .replace(/\s{2,}/g, ' ').trim();
    }

    // Groups selectors that share the same numbered-ID prefix and the same
    // descendant path, then replaces them with a single [id^="prefix"] rule.
    // e.g. ["#desktop-btf-grid-1 div.a-cardui", "#desktop-btf-grid-3 div.a-cardui"]
    //   → ["[id^=\"desktop-btf-grid-\"] div.a-cardui"]
    function consolidate(selectors) {
        function parse(sel) {
            const norm  = normalizeSel(sel);
            const sp    = norm.startsWith('#') ? norm.indexOf(' ') : -1;
            const anchor = sp === -1 ? (norm.startsWith('#') ? norm : '') : norm.slice(0, sp);
            const desc   = sp === -1 ? (norm.startsWith('#') ? '' : norm) : norm.slice(sp + 1);
            let prefix = null, suffix = null;
            if (anchor.startsWith('#')) {
                const pattern = extractIdPattern(anchor.slice(1));
                if (pattern) {
                    prefix = pattern.prefix;
                    suffix = pattern.suffix;
                }
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
            // Emit normalized form so hash classes are cleaned even for non-consolidated rules
            const clean = item.anchor
                ? (item.anchor + (item.desc ? ' ' + item.desc : ''))
                : normalizeSel(item.orig);
            result.push(clean);
        }
        return [...new Set(result)];
    }

    // ── Picker event handlers ─────────────────────────────────────────────
    function onMouseMove(e) {
        const el = e.target;
        if (el === highlight || el === pickerLabel || el.id?.startsWith('__darkzooka')) return;
        hoveredEl = el;
        pickerTarget = el;
        moveHighlight(pickerTarget);
        applyPreview(pickerTarget);
    }

    function onPointerDown(e) {
        if (!pickerActive) return;
        e.preventDefault();
        e.stopPropagation();

        const pointTarget = document.elementFromPoint(e.clientX, e.clientY);
        const el = (pointTarget && !pointTarget.id?.startsWith('__darkzooka'))
            ? pointTarget
            : (pickerTarget || hoveredEl);
        if (!el || el.id?.startsWith('__darkzooka')) return;

        const sel = getSelector(el);
        chrome.storage.local.get(['rules'], (data) => {
            const rules     = data.rules || {};
            const siteRules = rules[HOST] || [];
            siteRules.push(sel);
            const consolidated = consolidate(siteRules);
            rules[HOST] = consolidated;
            chrome.storage.local.set({ rules }, () => {
                applyRules(consolidated);
                chrome.runtime.sendMessage({ type: 'RULES_UPDATED' }).catch(() => {});
            });
        });
    }

    function onClick(e) {
        if (!pickerActive) return;
        e.preventDefault();
        e.stopPropagation();
    }

    function onKeyDown(e) {
        if (!pickerActive) return;

        if (e.key === 'Escape') { stopPicker(); return; }

        // Tab / [ — move selection UP to parent element
        if (e.key === 'Tab' || e.key === '[') {
            e.preventDefault();
            const parent = pickerTarget?.parentElement;
            if (parent && parent !== document.documentElement) {
                pickerTarget = parent;
                moveHighlight(pickerTarget);
                applyPreview(pickerTarget);
            }
            return;
        }

        // ] — move selection back DOWN toward originally hovered element
        if (e.key === ']') {
            e.preventDefault();
            if (pickerTarget && hoveredEl && pickerTarget !== hoveredEl) {
                let n = hoveredEl;
                while (n && n.parentElement !== pickerTarget) n = n.parentElement;
                if (n) { pickerTarget = n; moveHighlight(pickerTarget); applyPreview(pickerTarget); }
            }
        }
    }

    function startPicker() {
        ensurePickerDOM();
        pickerActive  = true;
        pickerTarget  = null;
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown, true);
        setPickerCursor(true);
    }

    function stopPicker() {
        pickerActive = false;
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeyDown, true);
        setPickerCursor(false);
        hideHighlight();
        clearPreview();
        chrome.runtime.sendMessage({ type: 'PICKER_STOPPED' }).catch(() => {});
    }

    // ── Message bus from popup ────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type === 'START_PICKER') { startPicker(); sendResponse({ ok: true }); }
        if (msg.type === 'STOP_PICKER')  { stopPicker();  sendResponse({ ok: true }); }

        if (msg.type === 'SET_ENABLED') {
            siteEnabled = msg.enabled;
            applyRules(appliedRules);
            sendResponse({ ok: true });
        }

        if (msg.type === 'SET_DARKNESS') {
            darkness = msg.darkness;
            applyRules(appliedRules);
            sendResponse({ ok: true });
        }

        if (msg.type === 'REMOVE_RULE') {
            chrome.storage.local.get(['rules'], (data) => {
                const rules = data.rules || {};
                rules[HOST] = (rules[HOST] || []).filter(s => s !== msg.selector);
                chrome.storage.local.set({ rules }, () => {
                    applyRules(rules[HOST]);
                    sendResponse({ ok: true });
                });
            });
            return true;
        }

        if (msg.type === 'CLEAR_RULES') {
            chrome.storage.local.get(['rules'], (data) => {
                const rules = data.rules || {};
                rules[HOST] = [];
                chrome.storage.local.set({ rules }, () => {
                    applyRules([]);
                    sendResponse({ ok: true });
                });
            });
            return true;
        }
    });
})();
