(async () => {
    // rules: { [hostname]: string[] }
    let rules       = {};
    let query       = '';
    let siteFilter  = ''; // '' = all sites

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const $siteList      = document.getElementById('site-list');
    const $selList       = document.getElementById('sel-list');
    const $siteBadge     = document.getElementById('site-badge');
    const $selBadge      = document.getElementById('sel-badge');
    const $statSites     = document.getElementById('stat-sites');
    const $statSels      = document.getElementById('stat-sels');
    const $search        = document.getElementById('search');
    const $searchClr     = document.getElementById('search-clear');
    const $siteChips     = document.getElementById('site-chips');
    const $selInput      = document.getElementById('sel-input');
    const $selAdd        = document.getElementById('sel-add');
    const $addRow        = document.getElementById('add-row');
    const $selPanelTitle = document.getElementById('sel-panel-title');

    // ── Load / Save ───────────────────────────────────────────────────────────
    async function load() {
        const d = await chrome.storage.local.get(['rules']);
        rules = d.rules || {};
        render();
    }

    async function save() {
        await chrome.storage.local.set({ rules });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function esc(str) {
        return String(str).replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
        );
    }

    function hl(str, q) {
        if (!q) return esc(str);
        const idx = str.toLowerCase().indexOf(q.toLowerCase());
        if (idx === -1) return esc(str);
        return esc(str.slice(0, idx)) +
               `<mark>${esc(str.slice(idx, idx + q.length))}</mark>` +
               esc(str.slice(idx + q.length));
    }

    function selectorType(sel) {
        if (sel.startsWith('#'))    return ['id',   'ID'];
        if (/^\w+\[/.test(sel))    return ['attr', 'Attr'];
        if (sel.includes('.'))     return ['cls',  'Class'];
        return ['tag', 'Tag'];
    }

    function totalSelectors() {
        return Object.values(rules).reduce((n, a) => n + a.length, 0);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────
    function updateStats() {
        const sites = Object.keys(rules).filter(s => rules[s].length);
        $statSites.textContent = sites.length;
        $statSels.textContent  = totalSelectors();
    }

    // ── Left panel: sites list ────────────────────────────────────────────────
    function renderSites() {
        const q     = query.toLowerCase();
        const sites = Object.keys(rules).filter(s => rules[s].length).sort();
        const vis   = sites.filter(s => !q || s.includes(q) || rules[s].some(r => r.toLowerCase().includes(q)));

        $siteBadge.textContent = sites.length;
        $siteBadge.className   = 'badge' + (q && vis.length < sites.length ? ' highlight' : '');

        if (!sites.length) {
            $siteList.innerHTML = `<div class="empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              <div>No sites with dark rules yet.<br>Use the picker on a page first.</div>
            </div>`;
            return;
        }

        $siteList.innerHTML = '';
        for (const site of sites) {
            const matches = !q || site.includes(q) || rules[site].some(r => r.toLowerCase().includes(q));
            if (!matches) continue;

            const row = document.createElement('div');
            row.className = 'site-row' + (siteFilter === site ? ' active' : '');
            row.dataset.site = site;
            row.innerHTML = `
              <span class="site-row-name">${hl(site, query)}</span>
              <span class="site-row-count">${rules[site].length}</span>
              <button class="site-row-del" data-site="${esc(site)}" title="Delete site">✕</button>`;
            $siteList.appendChild(row);
        }

        if (!$siteList.children.length) {
            $siteList.innerHTML = `<div class="empty"><div>No matches for "<strong>${esc(query)}</strong>"</div></div>`;
        }
    }

    // ── Chips ─────────────────────────────────────────────────────────────────
    function renderChips() {
        const sites = Object.keys(rules).filter(s => rules[s].length).sort();
        $siteChips.innerHTML = '';

        const allChip = document.createElement('button');
        allChip.className = 'chip' + (siteFilter === '' ? ' active' : '');
        allChip.textContent = 'All sites';
        allChip.dataset.site = '';
        $siteChips.appendChild(allChip);

        for (const site of sites) {
            const chip = document.createElement('button');
            chip.className = 'chip' + (siteFilter === site ? ' active' : '');
            chip.textContent = site;
            chip.dataset.site = site;
            $siteChips.appendChild(chip);
        }
    }

    // ── Right panel: selectors ────────────────────────────────────────────────
    function renderSelectors() {
        const q     = query.toLowerCase();
        const sites = Object.keys(rules)
            .filter(s => rules[s].length)
            .filter(s => !siteFilter || s === siteFilter)
            .sort();

        const totalVis = sites.reduce((n, s) => n + rules[s].length, 0);
        $selBadge.textContent = totalVis;
        $selBadge.className   = 'badge' + (siteFilter || q ? ' highlight' : '');

        $selPanelTitle.textContent = siteFilter ? `Selectors — ${siteFilter}` : 'All Selectors';
        $addRow.style.display = siteFilter ? '' : 'none';

        if (!Object.keys(rules).filter(s => rules[s].length).length) {
            $selList.innerHTML = `<div class="empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
              <div>No dark rules yet.<br>Pick elements on a page to get started.</div>
            </div>`;
            return;
        }

        $selList.innerHTML = '';

        for (const site of sites) {
            const sels = rules[site];
            const visSels = sels.filter(s => !q || s.toLowerCase().includes(q) || site.toLowerCase().includes(q));
            if (!visSels.length) continue;

            const group = document.createElement('div');
            group.className = 'site-group';
            group.dataset.site = site;

            const label = document.createElement('div');
            label.className = 'site-label';
            label.innerHTML = `
              <span class="site-label-name">
                ${hl(site, query)}
                <span class="site-badge">${visSels.length}${visSels.length < sels.length ? ` / ${sels.length}` : ''}</span>
              </span>
              <button class="clear-site-btn" data-site="${esc(site)}">Clear all</button>`;
            group.appendChild(label);

            sels.forEach((sel, j) => {
                const matches = !q || sel.toLowerCase().includes(q) || site.toLowerCase().includes(q);
                if (!matches) return;
                const [typeKey, typeLabel] = selectorType(sel);
                const row = document.createElement('div');
                row.className = 'sel-row';
                row.innerHTML = `
                  <span class="sel-type ${typeKey}">${typeLabel}</span>
                  <span class="sel-text" title="${esc(sel)}">${hl(sel, query)}</span>
                  <button class="del-btn" data-site="${esc(site)}" data-j="${j}" title="Remove">✕</button>`;
                group.appendChild(row);
            });

            $selList.appendChild(group);
        }

        if (!$selList.children.length) {
            $selList.innerHTML = `<div class="empty"><div>No matches for "<strong>${esc(query)}</strong>"</div></div>`;
        }
    }

    function render() {
        updateStats();
        renderChips();
        renderSites();
        renderSelectors();
    }

    // ── Search ────────────────────────────────────────────────────────────────
    $search.addEventListener('input', () => {
        query = $search.value;
        $searchClr.classList.toggle('visible', !!query);
        render();
    });
    $searchClr.addEventListener('click', () => {
        $search.value = ''; query = '';
        $searchClr.classList.remove('visible');
        render(); $search.focus();
    });
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); $search.focus(); $search.select(); }
        if (e.key === 'Escape' && document.activeElement === $search) $searchClr.click();
    });

    // ── Site filter: left panel click ─────────────────────────────────────────
    $siteList.addEventListener('click', e => {
        const delBtn = e.target.closest('.site-row-del');
        if (delBtn) {
            const site = delBtn.dataset.site;
            delete rules[site];
            if (siteFilter === site) siteFilter = '';
            save(); render(); return;
        }
        const row = e.target.closest('.site-row');
        if (!row) return;
        siteFilter = siteFilter === row.dataset.site ? '' : row.dataset.site;
        render();
    });

    // ── Site filter chips ─────────────────────────────────────────────────────
    $siteChips.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        siteFilter = chip.dataset.site;
        render();
    });

    // ── Add selector (only when a site is selected) ───────────────────────────
    async function addSelector() {
        const val = $selInput.value.trim();
        if (!val || !siteFilter) return;
        if (!(rules[siteFilter] || []).includes(val)) {
            rules[siteFilter] = rules[siteFilter] || [];
            rules[siteFilter].push(val);
            await save();
            render();
        }
        $selInput.value = '';
        $selInput.focus();
    }
    $selAdd.addEventListener('click', addSelector);
    $selInput.addEventListener('keydown', e => { if (e.key === 'Enter') addSelector(); });

    // ── Delete selector / clear site ─────────────────────────────────────────
    $selList.addEventListener('click', async e => {
        const clearBtn = e.target.closest('.clear-site-btn');
        if (clearBtn) {
            delete rules[clearBtn.dataset.site];
            if (siteFilter === clearBtn.dataset.site) siteFilter = '';
            await save(); render(); return;
        }
        const delBtn = e.target.closest('.del-btn');
        if (!delBtn) return;
        const { site } = delBtn.dataset;
        const j = parseInt(delBtn.dataset.j, 10);
        rules[site].splice(j, 1);
        if (!rules[site].length) {
            delete rules[site];
            if (siteFilter === site) siteFilter = '';
        }
        await save(); render();
    });

    // ── Consolidation ─────────────────────────────────────────────────────────

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

    function normalizeSel(sel) {
        return sel.replace(/\.[^\s.#\[>+~]+/g, cls => isStableClass(cls.slice(1)) ? cls : '')
                  .replace(/\s{2,}/g, ' ').trim();
    }

    function consolidateSite(selectors) {
        function parse(sel) {
            const norm = normalizeSel(sel);
            const sp   = norm.startsWith('#') ? norm.indexOf(' ') : -1;
            const anchor = sp === -1 ? (norm.startsWith('#') ? norm : '') : norm.slice(0, sp);
            const desc   = sp === -1 ? (norm.startsWith('#') ? '' : norm) : norm.slice(sp + 1);
            let prefix = null, suffix = null;
            if (anchor.startsWith('#')) {
                const id = anchor.slice(1);
                const mMid = id.match(/^([\w-]*?\D[-_])(\d+)([-_]\D[\w-]*)$/);
                if (mMid && mMid[1].length >= 2) { prefix = mMid[1]; suffix = mMid[3]; }
                else {
                    const mEnd = id.match(/^([\w-]*?\D)([-_]?\d+)$/);
                    if (mEnd && mEnd[1].length >= 2) prefix = mEnd[1];
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

    document.getElementById('consolidate-btn').addEventListener('click', async () => {
        const btn = document.getElementById('consolidate-btn');
        let totalBefore = 0, totalAfter = 0;
        for (const site of Object.keys(rules)) {
            const before = rules[site].length;
            rules[site] = consolidateSite(rules[site]);
            totalBefore += before;
            totalAfter  += rules[site].length;
        }
        await save();
        render();
        const saved = totalBefore - totalAfter;
        const orig  = btn.innerHTML;
        btn.textContent = saved > 0 ? `Saved ${saved} rule${saved !== 1 ? 's' : ''}` : 'Already clean';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
    });

    // ── Live storage updates ──────────────────────────────────────────────────
    chrome.storage.onChanged.addListener(changes => {
        if (changes.rules) { rules = changes.rules.newValue || {}; render(); }
    });

    load();
})();
