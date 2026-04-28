export function darkVars(pct) {
    return `
        --dz-bg:color-mix(in srgb,#0d1117 ${pct}%,#282a36);
        --dz-surface:color-mix(in srgb,#161b22 ${pct}%,#313442);
        --dz-card:color-mix(in srgb,#1c2128 ${pct}%,#383a4a);
        --dz-border:color-mix(in srgb,#30363d ${pct}%,#44475a);
        --dz-text:color-mix(in srgb,#e6edf3 ${pct}%,#f8f8f2);
        --dz-link:color-mix(in srgb,#58a6ff ${pct}%,#8be9fd);
    `;
}

export function buildCSS(selectors) {
    return selectors.map(s => `
${s}{background-color:var(--dz-bg)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}
${s} *{color:var(--dz-text)!important;border-color:var(--dz-border)!important}
${s} a,${s} a *{color:var(--dz-link)!important}
${s} input,${s} textarea,${s} select{background-color:var(--dz-surface)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}
${s} button{background-color:var(--dz-card)!important;color:var(--dz-text)!important;border-color:var(--dz-border)!important}
${s} [style*="background"],${s} [style*="background-color"]{background-color:var(--dz-surface)!important}
${s} img{filter:brightness(.9)!important}`).join('\n');
}
