// Data selection never grants an authentication exemption.
export function authenticatedDemoEnabled() { return process.env.BSMOSS_DATA_MODE === "demo"; }
export function demoDataEnabled() { return authenticatedDemoEnabled() || process.env.BSMOSS_PRODUCT_PREVIEW === "on"; }
