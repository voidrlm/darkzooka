export const HOST = location.hostname;

export const state = {
    // CSS application
    appliedRules:       [],
    siteEnabled:        true,
    darkness:           100,
    styleEl:            null,

    // Picker shared navigation
    hoveredEl:          null,
    pickerTarget:       null,

    // Dark picker
    pickerActive:       false,

    // Revert picker
    revertPickerActive:  false,
    revertPreviewActive: false,
};
