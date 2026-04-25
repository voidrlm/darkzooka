(() => {
    if (window.__darkzookaLoaded) return;
    window.__darkzookaLoaded = true;

    const HOST = location.hostname;
    let pickerActive = false;
    let hoveredEl = null;
    let appliedRules = [];
    let siteEnabled = true;

    // ── Style tag injected synchronously — no flash ───────────────────────
    const styleEl = document.createElement('style');
    styleEl.id = '__darkzooka_styles';
    document.documentElement.appendChild(styleEl);

    const DARK_VARS = `
        --dz-bg:#0d1117;--dz-surface:#161b22;--dz-card:#1c2128;
        --dz-border:#30363d;--dz-text:#e6edf3;--dz-subtext:#8b949e;--dz-link:#58a6ff;
    `;

    function buildCSS(selectors) {
        return selectors.map(s => `
${s}{background-color:var(--dz-bg,#0d1117)!important;color:var(--dz-text,#e6edf3)!important;border-color:var(--dz-border,#30363d)!important}
${s} *{color:var(--dz-text,#e6edf3)!important;border-color:var(--dz-border,#30363d)!important}
${s} a,${s} a *{color:var(--dz-link,#58a6ff)!important}
${s} input,${s} textarea,${s} select{background-color:var(--dz-surface,#161b22)!important;color:var(--dz-text,#e6edf3)!important;border-color:var(--dz-border,#30363d)!important}
${s} button{background-color:var(--dz-card,#1c2128)!important;color:var(--dz-text,#e6edf3)!important;border-color:var(--dz-border,#30363d)!important}
${s} [style*="background"],${s} [style*="background-color"]{background-color:var(--dz-surface,#161b22)!important}
${s} img{filter:brightness(.9)!important}`).join('\n');
    }

    function applyRules(selectors) {
        appliedRules = selectors;
        styleEl.textContent = (siteEnabled && selectors.length)
            ? `:root{${DARK_VARS}}\n` + buildCSS(selectors)
            : '';
    }

    // ── Read storage directly — skips background IPC round-trip ──────────
    function loadAndApply() {
        chrome.storage.local.get(['rules', 'settings'], (data) => {
            const settings = data.settings || {};
            siteEnabled = settings[HOST] !== false;
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
            siteEnabled = (changes.settings.newValue || {})[HOST] !== false;
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

    function getSelector(el) {
        if (el.id && isStableId(el.id)) return '#' + CSS.escape(el.id);

        // Find the nearest stable-ID ancestor to use as an anchor.
        let anchor = null;
        for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
            if (p.id && isStableId(p.id)) { anchor = p; break; }
        }

        if (anchor) {
            const anchorSel = '#' + CSS.escape(anchor.id);
            // Build path from el up to (but not including) anchor.
            // Skip bare nodes that have no stable classes — they add noise and length.
            // Use descendant combinators (space) so nth-of-type is rarely needed.
            const path = [];
            for (let n = el; n && n !== anchor; n = n.parentElement) {
                const cls = stableClasses(n);
                if (cls || n === el) {          // always include the picked element itself
                    path.unshift(nodeDesc(n));
                }
            }
            return anchorSel + ' ' + path.join(' ');
        }

        // No stable-ID ancestor — build a short class-based path (max 4 levels).
        const parts = [];
        let node = el, depth = 0;
        while (node && node !== document.body && node.nodeType === 1 && depth < 4) {
            if (node.id && isStableId(node.id)) { parts.unshift('#' + CSS.escape(node.id)); break; }
            parts.unshift(nodeDesc(node));
            node = node.parentElement;
            depth++;
        }
        return parts.join(' ');
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

    // ── Picker event handlers ─────────────────────────────────────────────
    function onMouseMove(e) {
        const el = e.target;
        if (el === highlight || el === pickerLabel || el.id?.startsWith('__darkzooka')) return;
        hoveredEl = el;
        pickerTarget = el;      // reset target to actual hovered element on every move
        moveHighlight(pickerTarget);
    }

    function onClick(e) {
        if (!pickerActive) return;
        e.preventDefault();
        e.stopPropagation();
        const el = pickerTarget || hoveredEl;
        if (!el || el.id?.startsWith('__darkzooka')) return;

        const sel = getSelector(el);
        chrome.storage.local.get(['rules'], (data) => {
            const rules = data.rules || {};
            const siteRules = rules[HOST] || [];
            if (!siteRules.includes(sel)) siteRules.push(sel);
            rules[HOST] = siteRules;
            chrome.storage.local.set({ rules }, () => {
                applyRules(siteRules);
                chrome.runtime.sendMessage({ type: 'RULES_UPDATED' }).catch(() => {});
            });
        });
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
            }
            return;
        }

        // ] — move selection back DOWN toward originally hovered element
        if (e.key === ']') {
            e.preventDefault();
            // Walk back down: find hoveredEl's ancestor that is a direct child of pickerTarget
            if (pickerTarget && hoveredEl && pickerTarget !== hoveredEl) {
                let n = hoveredEl;
                while (n && n.parentElement !== pickerTarget) n = n.parentElement;
                if (n) { pickerTarget = n; moveHighlight(pickerTarget); }
            }
        }
    }

    function startPicker() {
        ensurePickerDOM();
        pickerActive  = true;
        pickerTarget  = null;
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown, true);
        document.body.style.cursor = 'crosshair';
    }

    function stopPicker() {
        pickerActive = false;
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeyDown, true);
        document.body.style.cursor = '';
        hideHighlight();
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
