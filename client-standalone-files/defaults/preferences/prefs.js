pref("toolkit.defaultChromeURI", "chrome://convergence/content/main.xul");

/* debugging prefs */
pref("browser.dom.window.dump.enabled", true);
pref("javascript.options.showInConsole", true);
pref("javascript.options.strict", true);
pref("nglayout.debug.disable_xul_cache", true);
pref("nglayout.debug.disable_xul_fastload", true);

/* added to allow <label class="text-links" ... /> to work */
pref("network.protocol-handler.expose.http", false);
pref("network.protocol-handler.warn-external.http", false);

// Some logging where "Components" interface is inaccessible (workers) might
//  get lost with just about:config flag, but available if print_all=true is set in Logging.js.
// Changes require restart.
pref("convergence.logging.enabled", false);

