let currentTab = null;
let currentHost = '';
let pickerActive = false;
let siteEnabled = true;

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

function getHost(url) {
    try { return new URL(url).hostname; } catch { return ''; }
}

async function loadState() {
    currentTab = await getActiveTab();
    currentHost = getHost(currentTab?.url || '');

    document.getElementById('toggle-host').textContent = currentHost || 'unknown';

    const data = await chrome.storage.local.get(['rules', 'settings']);
    siteEnabled = (data.settings || {})[currentHost] !== false;
    document.getElementById('site-toggle').checked = siteEnabled;
    updateStatusUI();

    renderRules((data.rules || {})[currentHost] || []);
}

async function loadRules() {
    const data = await chrome.storage.local.get(['rules']);
    renderRules((data.rules || {})[currentHost] || []);
}

function renderRules(rules) {
    const list = document.getElementById('rules-list');
    list.innerHTML = '';

    if (!rules.length) {
        list.innerHTML = '<div class="rules-empty">No elements picked yet</div>';
        return;
    }

    rules.forEach(sel => {
        const item = document.createElement('div');
        item.className = 'rule-item';
        const label = document.createElement('span');
        label.className = 'rule-selector';
        label.title = sel;
        label.textContent = sel;
        const remove = document.createElement('button');
        remove.className = 'rule-remove';
        remove.title = 'Remove';
        remove.textContent = '×';
        remove.addEventListener('click', async () => {
            await sendToContent({ type: 'REMOVE_RULE', selector: sel });
            await loadRules();
        });
        item.appendChild(label);
        item.appendChild(remove);
        list.appendChild(item);
    });
}

function updateStatusUI() {
    const dot = document.getElementById('status-dot');
    const ring = document.getElementById('pulse-ring');
    const text = document.getElementById('status-text');
    if (siteEnabled) {
        dot.classList.remove('off');
        ring.classList.remove('off');
        text.textContent = 'Active';
    } else {
        dot.classList.add('off');
        ring.classList.add('off');
        text.textContent = 'Paused';
    }
}

async function sendToContent(msg) {
    if (!currentTab?.id) return;
    try {
        return await chrome.tabs.sendMessage(currentTab.id, msg);
    } catch {}
}

// site toggle
document.getElementById('site-toggle').addEventListener('change', async (e) => {
    siteEnabled = e.target.checked;
    const data = await chrome.storage.local.get(['settings']);
    const settings = data.settings || {};
    settings[currentHost] = siteEnabled;
    await chrome.storage.local.set({ settings });
    await sendToContent({ type: 'SET_ENABLED', enabled: siteEnabled });
    updateStatusUI();
});

// rule editor button
document.getElementById('editor-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    window.close();
});

// picker button
document.getElementById('picker-btn').addEventListener('click', async () => {
    if (pickerActive) {
        pickerActive = false;
        document.getElementById('picker-btn').classList.remove('active');
        document.getElementById('picker-label').textContent = 'Pick element to darken';
        await sendToContent({ type: 'STOP_PICKER' });
        window.close();
    } else {
        pickerActive = true;
        document.getElementById('picker-btn').classList.add('active');
        document.getElementById('picker-label').textContent = 'Click element on page… (Esc to cancel)';
        await sendToContent({ type: 'START_PICKER' });
        window.close();
    }
});

// clear all
document.getElementById('clear-btn').addEventListener('click', async () => {
    await sendToContent({ type: 'CLEAR_RULES' });
    await loadRules();
});

// export
document.getElementById('export-btn').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['rules']);
    const payload = JSON.stringify({ version: 1, rules: data.rules || {} }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `darkzooka-rules-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
    const btn = document.getElementById('export-btn');
    const orig = btn.innerHTML;
    btn.textContent = 'Exported!';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
});

// import
const $importFile = document.getElementById('import-file');
document.getElementById('import-btn').addEventListener('click', () => $importFile.click());

$importFile.addEventListener('change', async () => {
    const file = $importFile.files[0];
    if (!file) return;
    const btn = document.getElementById('import-btn');

    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch {
        const orig = btn.innerHTML;
        btn.textContent = 'Invalid JSON';
        setTimeout(() => { btn.innerHTML = orig; }, 1800);
        $importFile.value = '';
        return;
    }

    // Accept both {rules:{...}} (darkzooka format) and a bare {host:[...]} map
    const incoming = parsed.rules && typeof parsed.rules === 'object'
        ? parsed.rules
        : (typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null);

    if (!incoming) {
        const orig = btn.innerHTML;
        btn.textContent = 'Bad format';
        setTimeout(() => { btn.innerHTML = orig; }, 1800);
        $importFile.value = '';
        return;
    }

    // Merge with existing rules (imported selectors are added, not replacing)
    const data = await chrome.storage.local.get(['rules']);
    const existing = data.rules || {};
    for (const [host, sels] of Object.entries(incoming)) {
        if (!Array.isArray(sels)) continue;
        existing[host] = [...new Set([...(existing[host] || []), ...sels])];
    }
    await chrome.storage.local.set({ rules: existing });

    const totalNew = Object.values(incoming).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
    const orig = btn.innerHTML;
    btn.textContent = `Imported ${totalNew} rule${totalNew !== 1 ? 's' : ''}`;
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
    $importFile.value = '';
    await loadRules();
});

// listen for updates from content script
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'RULES_UPDATED' || msg.type === 'PICKER_STOPPED') {
        loadRules();
        pickerActive = false;
        document.getElementById('picker-btn').classList.remove('active');
        document.getElementById('picker-label').textContent = 'Pick element to darken';
    }
});

loadState();
