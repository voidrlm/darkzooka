export const HOST = location.hostname;

export const state = {
    // CSS application
    appliedRules:       [],
    exceptions:         [],
    siteEnabled:        true,
    darkness:           100,
    styleEl:            null,

    // Picker shared navigation
    hoveredEl:          null,
    pickerTarget:       null,

    // Dark picker (smart)
    pickerActive:        false,

    // Simple picker
    simplePickerActive:  false,

    // Exception picker
    exceptionPickerActive: false,
};
