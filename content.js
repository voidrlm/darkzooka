if (!window.__darkzookaLoaded) {
    window.__darkzookaLoaded = true;

    const _HOST = location.hostname;

    // Injected synchronously — no paint happens before this runs.
    const styleEl = document.createElement('style');
    styleEl.id = '__darkzooka_styles';
    document.documentElement.appendChild(styleEl);

    // Read storage and write CSS immediately, before the module loads.
    // chrome.storage.local is near-instant (no network); this fires long before
    // any DOM elements are painted, eliminating the flash of unstyled content.
    chrome.storage.local.get(['rules', 'exceptions', 'settings'], (data) => {
        const settings = data.settings || {};
        if (settings[_HOST] === false) return;
        const selectors = (data.rules || {})[_HOST] || [];
        const exceptions = (data.exceptions || {})[_HOST] || [];
        if (!selectors.length) return;
        const pct = settings.__darkness ?? 100;
        const ex = exceptions.map(sel => `:not(${sel}):not(${sel} *)`).join('');
        styleEl.textContent =
            `:root{--dz-bg:color-mix(in srgb,#0d1117 ${pct}%,#282a36);` +
            `--dz-surface:color-mix(in srgb,#161b22 ${pct}%,#313442);` +
            `--dz-card:color-mix(in srgb,#1c2128 ${pct}%,#383a4a);` +
            `--dz-border:color-mix(in srgb,#30363d ${pct}%,#44475a);` +
            `--dz-text:color-mix(in srgb,#e6edf3 ${pct}%,#f8f8f2);` +
            `--dz-link:color-mix(in srgb,#58a6ff ${pct}%,#8be9fd)}\n` +
            selectors.map(s =>
                `${s}${ex}{background-color:var(--dz-bg)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}` +
                `${s} *${ex}{color:var(--dz-text)!important;border-color:var(--dz-border)!important}` +
                `${s} :where(div,span,section,article,aside,nav,header,footer,main,ul,ol,li,p,h1,h2,h3,h4,h5,h6)${ex}{background-color:transparent!important}` +
                `${s} :where([class*="bg-"],[class*="background"],[class*="white"],[class*="surface"],[class*="card"],[role="main"],[role="region"],[role="dialog"],[role="listitem"],section,article,aside,nav,header,footer)${ex}{background-color:var(--dz-surface)!important}` +
                `${s} a${ex},${s} a *${ex}{color:var(--dz-link)!important}` +
                `${s} input${ex},${s} textarea${ex},${s} select${ex}{background-color:var(--dz-surface)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}` +
                `${s} button${ex}{background-color:var(--dz-card)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}` +
                `${s} [style*="background" i]${ex},${s} [style*="background-color" i]${ex}{background-color:var(--dz-surface)!important}` +
                `${s} img${ex}{filter:brightness(.9)!important}`
            ).join('\n');
    });

    // Load the full module for picker, revert, storage sync, message bus, etc.
    import(chrome.runtime.getURL('src/content/index.js'))
        .then(mod => mod.init(styleEl));
}
