if (!window.__darkzookaLoaded) {
    window.__darkzookaLoaded = true;

    // Inject style tag synchronously at document_start to prevent FOUC.
    // The module receives this element so applyRules can write to it immediately.
    const styleEl = document.createElement('style');
    styleEl.id = '__darkzooka_styles';
    document.documentElement.appendChild(styleEl);

    import(chrome.runtime.getURL('src/content/index.js'))
        .then(mod => mod.init(styleEl));
}
