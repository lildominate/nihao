declare const __APP_VERSION__: string

/** e.g. "v2.1.0 · 28 sep. 16:40" — version from package.json + build time (Stockholm). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
