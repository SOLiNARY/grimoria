// The build replaces `__APP_VERSION__` with the VERSION file. Declaring it
// inside this module keeps the read in one place for UI code.
declare const __APP_VERSION__: string;

export const APP_VERSION = __APP_VERSION__;
