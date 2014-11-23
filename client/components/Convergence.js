// Copyright (c) 2011 Moxie Marlinspike <moxie@thoughtcrime.org>
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation; either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307
// USA


/**
  * This XPCOM Component is the main entrypoint for the convergence
  * backend processing.  This initializes the backend system (registers
  * the local proxy, sets up the local CA certificate, initializes the
  * database, etc...) and then dispatches outgoing HTTPS requests to the
  * local proxy.
  *
  **/

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/ctypes.jsm');

function getWscriptPath() {

  if(Services.appinfo.OS == 'WINNT') {
    var wscript_path = false;
    
    wscript_path = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties).get("SysD", Components.interfaces.nsILocalFile);
    wscript_path.append("wscript.exe");
    
    return wscript_path.clone();
  }
  
  return false;
}

function getDaemonsDirectory() {
  var daemons = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsILocalFile);
  daemons.append("extensions");
  daemons.append("convergence@dot-bit.org"); // guid of extension
  
  daemons.append("daemons");
  
  return daemons.clone();
}

function getNamecoindPath() {
  var namecoind_path = getDaemonsDirectory();

  namecoind_path.append("namecoind");
  
  if (Services.appinfo.OS != 'WINNT') {
    dump("Linux in use\n");
    namecoind_path.append("linux");
    namecoind_path.append("x64");
    namecoind_path.append("namecoind");
  }
  else {
    dump("Windows in use\n");
    namecoind_path.append("windows");
    namecoind_path.append("x64");
    namecoind_path.append("namecoind.exe");
  }
  
  if(! namecoind_path.exists()) {
    dump("namecoind is missing!\n");
  }
  
  return namecoind_path.clone();
}

function getInvisibleNamecoindPath() {
  var invisible_namecoind_path = getDaemonsDirectory();
  
  invisible_namecoind_path.append("namecoind");
  
  if (Services.appinfo.OS == 'WINNT') {
    invisible_namecoind_path.append("windows");
    invisible_namecoind_path.append("x64");
    invisible_namecoind_path.append("invisible_namecoind.vbs");
    
    return invisible_namecoind_path.clone();
  }
  
  return false;
}

function getNmcontrolPath() {
  var nmcontrol_path = getDaemonsDirectory();
  
  nmcontrol_path.append("nmcontrol");
  
  if (Services.appinfo.OS != 'WINNT') {
    dump("Linux in use\n");
    nmcontrol_path.append("python");
    nmcontrol_path.append("cd_launcher.sh");
  }
  else {
    dump("Windows in use\n");
    nmcontrol_path.append("windows");
    nmcontrol_path.append("cd_launcher.bat");
  }
  
  if(! nmcontrol_path.exists()) {
    dump("nmcontrol launch script is missing!\n");
  }
  
  return nmcontrol_path.clone();
}

function getInvisibleNmcontrolPath() {
  var invisible_nmcontrol_path = getDaemonsDirectory();
  
  invisible_nmcontrol_path.append("nmcontrol");
  
  if (Services.appinfo.OS == 'WINNT') {
    invisible_nmcontrol_path.append("windows");
    invisible_nmcontrol_path.append("invisible_nmcontrol.vbs");
    
    return invisible_nmcontrol_path.clone();
  }
  
  return false;
}

function getNamecoinConfStr() {
  var namecoin_conf = getNmcontrolPath().parent.parent.clone().path;
  
  if (Services.appinfo.OS != 'WINNT') {
    dump("Linux in use\n");
    namecoin_conf = namecoin_conf + '/namecoin.conf';
  }
  else {
    dump("Windows in use\n");
    namecoin_conf = namecoin_conf + '\\namecoin.conf';
  }
  
  return namecoin_conf;
}

function getNamecoindProfileDirectoryStr() {
  // Create the namecoind profile directory if it's not already there
  Components.utils.import("resource://gre/modules/FileUtils.jsm");
  var namecoind_profile_dir = FileUtils.getDir("Home", [".convergence-namecoin"], true).path;
  
  return namecoind_profile_dir;
}

function setNamecoindState(enabled) {
  
  var namecoind_path = getNamecoindPath();
  var namecoind_profile_dir = getNamecoindProfileDirectoryStr();
  
  var process = Components.classes['@mozilla.org/process/util;1'].createInstance(Components.interfaces.nsIProcess);
  
  var proc_arguments = [];
  
  if (Services.appinfo.OS != 'WINNT') {
    dump("Linux in use\n");
    
    dump("namecoind path: " + namecoind_path.path + "\n");
    process.init(namecoind_path);
    
    proc_arguments= ['-datadir=' + namecoind_profile_dir + '/', '-server', '-rpcuser=convergence', '-rpcpassword=convergence', '-port=18834', '-rpcport=18835'] ; // command line arguments array
    if(!enabled) {
      proc_arguments.push('stop');
    }
  }
  else {
    dump("Windows in use\n");
    
    var wscript_path = getWscriptPath();
    var invisible_namecoind_path = getInvisibleNamecoindPath();
    
    dump("namecoind path: " + wscript_path.path + "\n");
    process.init(wscript_path);
    
    proc_arguments= [invisible_namecoind_path.path, '\'' + namecoind_path.path + '\'' + ' -datadir=\'' + namecoind_profile_dir + '/\' -server -rpcuser=convergence -rpcpassword=convergence -port=18834 -rpcport=18835'] ; // command line arguments array        
    if(!enabled) {
      proc_arguments[1] = proc_arguments[1] + ' stop';
    }
  }
          
  dump("namecoind args: " + proc_arguments.join(" ") + "\n");
  process.run(false, proc_arguments, proc_arguments.length); 
  
  if(enabled) {
    dump("namecoind started.\n");
  }
  else {
    dump("namecoind stopped.\n");
  }
}

function setNmcontrolState(enabled) {
  
  var nmcontrol_path = getNmcontrolPath();
  var namecoin_conf = getNamecoinConfStr();
  
  var process = Components.classes['@mozilla.org/process/util;1'].createInstance(Components.interfaces.nsIProcess);
  
  var proc_arguments = [];
  
  if (Services.appinfo.OS != 'WINNT') {
    dump("Linux in use\n");
    
    dump("nmcontrol path: " + nmcontrol_path.path + "\n");
    process.init(nmcontrol_path);
    
    proc_arguments= [nmcontrol_path.parent.clone().path, 'python2 nmcontrol.py --daemon=0 --data.update.namecoin="' + namecoin_conf + '" --rpc.port=18836 --dns.port=18837 --http.port=18838'] ; // command line arguments array
    if(!enabled) {
      proc_arguments[1] = proc_arguments[1] + ' stop';
    }    
  }
  else {
    dump("Windows in use\n");
    
    var wscript_path = getWscriptPath();
    var invisible_nmcontrol_path = getInvisibleNmcontrolPath();
    
    dump("nmcontrol path: " + wscript_path.path + "\n");
    process.init(wscript_path);
    
    proc_arguments= [invisible_nmcontrol_path.path, '\'' + nmcontrol_path.path + '\' \'' + nmcontrol_path.parent.clone().path + '\' nmcontrol.exe --daemon=0 \'--data.update.namecoin=' + namecoin_conf + '\' \'--rpc.port=18836\' \'--dns.port=18837\' \'--http.port=18838\''] ; // command line arguments array
    if(!enabled) {
      proc_arguments[1] = proc_arguments[1] + ' stop';
    }
  }
  
  dump("nmcontrol args: " + proc_arguments.join(" ") + "\n");
  process.run(false, proc_arguments, proc_arguments.length); 
    
  if(enabled) {
    dump("nmcontrol started.\n");
  }
  else {
    dump("nmcontrol stopped.\n");
  }
}

function Convergence() {
  try {
    this.wrappedJSObject = this;
    this.initializeCtypes();

    this.initializeSettingsManager();
    this.initializeCertificateManager();
    this.initializeCertificateCache();

    this.initializeLocalProxy();
    this.initializeConnectionManager();
    this.initializeRegularExpressions();
    this.registerProxyObserver();
    this.registerObserverService();

    this.initializeNotaryUpdateTimer(false);
    
    this.initializeNamecoinDaemons();
    
    CV9BLog.core('FreeSpeechMe setup complete');
  } catch (e) {
    CV9BLog.core.error(e, 'Convergence init error - ');
  }
}

Convergence.prototype = {
  classDescription:   'Convergence Javascript Component',
  classID:            Components.ID('{44d8bf5b-d0f8-4e2a-876d-5df3813a56c6}'),
  contractID:         '@fraggod.net/convergence;1',
  QueryInterface:     XPCOMUtils.generateQI([Components.interfaces.nsIClassInfo]),
  extensionVersion:   '0.0',
  enabled:            true,
  localProxy:         null,
  flags:              Components.interfaces.nsIClassInfo.THREADSAFE,
  nsprFile:           null,
  nssFile:            null,
  sslFile:            null,
  sqliteFile:         null,
  cacheFile:          null,
  certificateManager: null,
  rfc1918:            null,
  timer:              Components.classes['@mozilla.org/timer;1'].createInstance(Components.interfaces.nsITimer),

  initializeCtypes: function() {
    try {
      Components.utils.import('resource://gre/modules/Services.jsm');
      Components.utils.import('resource://gre/modules/ctypes.jsm');

      var FFLibDir = Services.dirsvc.get('GreD', Components.interfaces.nsILocalFile);
      var FFLibGet = function(name, fallback) {
        var libPath = FFLibDir.clone();
        libPath.append(ctypes.libraryName(name));
        if (fallback && !libPath.exists()) {
          var libPathFallback = FFLibDir.clone();
          libPathFallback.append(ctypes.libraryName(fallback));
          if (libPathFallback.exists()) {
            CV9BLog.core('Using fallback (' + fallback + ') for lib ' + name + ': ' + libPathFallback.path);
            libPath = libPathFallback;
          }
        }
        return libPath;
      }

      if (Services.appinfo.OS != 'WINNT') {
        // Assuming unix-like system - i.e. Linux, FreeBSD.
        // SInce FF22, all major libs are folded into libxul on unixes, but separate libs
        //  should also be available, so we use these to (possibly) work with older versions.
        // libxul is used as a fallback just in case of weirder platforms.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=648407
        this.nssFile = FFLibGet('nss3', 'xul');
        this.nsprFile = FFLibGet('nspr4', 'xul');
        this.sslFile = FFLibGet('ssl3', 'xul');
        this.sqliteFile = FFLibGet('mozsqlite3', 'xul');
      } else {
        // On windows, separate libs are available only until FF22, after which they're folded into nss3.
        this.nssFile = FFLibGet('nss3');
        this.nsprFile = FFLibGet('nspr4', 'nss3');
        this.sslFile = FFLibGet('ssl3', 'nss3');
        this.sqliteFile = FFLibGet('mozsqlite3', 'nss3');
      }

      NSPR.initialize(this.nsprFile.path);
      NSS.initialize(this.nssFile.path);
      SSL.initialize(this.sslFile.path);
      SQLITE.initialize(this.sqliteFile.path);
    } catch (e) {
      CV9BLog.core.error(e, 'Error initializing ctypes - ');
      throw e;
    }
  },

  initializeConnectionManager : function() {
    if (this.certificateManager != null) {
      this.connectionManager = new ConnectionManager(
        this.localProxy.getListenSocket(),
        this.nssFile,
        this.sslFile,
        this.nsprFile,
        this.sqliteFile,
        this.cacheFile,
        this.certificateManager,
        this.settingsManager );
    }
  },

  initializeRegularExpressions: function() {
    this.rfc1918 = new RegExp(
      '(^10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$)|'
      + '(^172\\.1[6-9]\\.\\d{1,3}\\.\\d{1,3}$)|'
      + '(^172\\.2[0-9]\\.\\d{1,3}\\.\\d{1,3}$)|'
      + '(^172\\.3[0-1]\\.\\d{1,3}\\.\\d{1,3}$)|'
      + '(^192\\.168\\.\\d{1,3}\\.\\d{1,3}$)' );
  },

  initializeLocalProxy: function() {
    this.localProxy = new LocalProxy();
  },

  initializeSettingsManager: function() {
    try {
      this.settingsManager = new SettingsManager();
      this.enabled = this.settingsManager.isEnabled();
    } catch (e) {
      CV9BLog.core('Error initializing notary manager: ' + e);
      throw e;
    }
  },

  initializeCertificateManager: function() {
    CV9BLog.core('Configuring cache...');
    SSL.lib.SSL_ConfigServerSessionIDCache(1000, 60, 60, null);

    try {
      this.certificateManager = new CertificateManager();
    } catch (e) {
      CV9BLog.core('User declined password entry, disabling FreeSpeechMe...');
      this.certificateManager = null;
      this.enabled = false;
      return false;
    }

    if (this.certificateManager.needsReboot) {
      Components.classes['@mozilla.org/toolkit/app-startup;1'].getService(Components.interfaces.nsIAppStartup)
        .quit(Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eAttemptQuit);
    }

    return true;
  },

  initializeCertificateCache: function() {
    this.cacheFile = Components.classes['@mozilla.org/file/directory_service;1']
      .getService(Components.interfaces.nsIProperties)
      .get('ProfD', Components.interfaces.nsIFile);

    this.cacheFile.append('convergence.sqlite');

    var databaseHelper = new DatabaseHelper(this.cacheFile);

    databaseHelper.initialize();
    databaseHelper.close();
  },

  initializeNotaryUpdateTimer: function(reschedule) {
    var prefs = Components.classes['@mozilla.org/preferences-service;1']
                .getService(Components.interfaces.nsIPrefService)
                .getBranch('extensions.convergence.');

    var updateBundleTime = 0;

    try {
      if (!reschedule)
        updateBundleTime = parseInt(prefs.getCharPref('updateBundleTime'));
    } catch (e) {}

    if (updateBundleTime == 0) {
      updateBundleTime = Date.now() + (24 * 60 * 60 * 1000) + Math.floor((Math.random() * (12 * 60 * 60 *1000)));
      // updateBundleTime = Date.now() + 10000;
      prefs.setCharPref('updateBundleTime', updateBundleTime + '');
    }

    var difference = Math.max(1, updateBundleTime - Date.now());
    this.timer.init(this, difference, 0);

    CV9BLog.core('Timer will fire in: ' + difference);
  },

  initializeNamecoinDaemons: function() {
    
    if(this.settingsManager.getDaemonMode() == "namecoind-nmcontrol") {
      
      setNamecoindState(true);
      setNmcontrolState(true);
      
    }
  },

  setEnabled: function(value) {
    if (value && (this.certificateManager == null)) {
      if (this.initializeCertificateManager())
        this.initializeConnectionManager();
      else
        return;
    }

    this.enabled = value;
    this.settingsManager.setEnabled(value);
    this.settingsManager.savePreferences();
  },

  isEnabled: function() {
    return this.enabled;
  },

  getNewNotary: function() {
    return new Notary();
  },

  getNewNotaryFromBundle: function(bundlePath) {
    return Notary.constructFromBundle(bundlePath);
  },

  getSettingsManager: function() {
    return this.settingsManager;
  },

  getCertificateManager: function() {
    return this.certificateManager;
  },

  getCertificateCache: function() {
    return this.certificateCache;
  },

  registerObserverService: function() {
    var observerService = Components.classes['@mozilla.org/observer-service;1']
      .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(this, 'quit-application', false);
    observerService.addObserver(this, 'network:offline-status-changed', false);
    observerService.addObserver(this, 'convergence-notary-updated', false);
  },

  registerProxyObserver: function() {
    var protocolService = Components.classes['@mozilla.org/network/protocol-proxy-service;1']
      .getService(Components.interfaces.nsIProtocolProxyService);

    protocolService.unregisterFilter(this);
    protocolService.registerFilter(this, 9999);
  },

  observe: function(subject, topic, data) {
    if (topic == 'quit-application') {
      CV9BLog.core('Got application shutdown request...');
      if (this.connectionManager != null)
        this.connectionManager.shutdown();
      if(this.settingsManager.getDaemonStop() || (this.settingsManager.getDaemonMode() != "namecoind-nmcontrol") ) {
        
        setNamecoindState(false);
        setNmcontrolState(false);
          
      }
    } else if (topic == 'network:offline-status-changed') {
      if (data == 'online') {
        CV9BLog.core('Got network state change, shutting down listensocket...');
        if (this.connectionManager != null)
          this.connectionManager.shutdown();
        CV9BLog.core('Initializing listensocket...');
        this.initializeConnectionManager();
      }
    } else if (topic == 'timer-callback') {
      CV9BLog.core('Got timer update...');
      this.handleNotaryUpdates();
    } else if (topic == 'convergence-notary-updated') {
      CV9BLog.core('Got update callback...');
      this.settingsManager.savePreferences();
    }
  },

  handleNotaryUpdates: function() {
    var notaries = this.settingsManager.getNotaryList();

    for (var i in notaries) {
      notaries[i].update();
    }

    this.initializeNotaryUpdateTimer(true);
  },

  isNotaryUri: function(uri) {
    var notaries = this.settingsManager.getNotaryList();
    var uriPort = uri.port;

    if (uriPort == -1)
      uriPort = 443;

    for (var i in notaries) {
      var physicalNotaries = notaries[i].getPhysicalNotaries();

      for (var j in physicalNotaries) {
        if ((physicalNotaries[j].host == uri.host) &&
            ((physicalNotaries[j].httpPort == uriPort) ||
            (physicalNotaries[j].sslPort == uriPort)))
        {
          return true;
        }
      }
    }

    return false;
  },

  isWhitelisted: function(uri) {
    return (
      this.settingsManager.getWhitelistPatterns().testHost(uri.host) ||
      (this.settingsManager.getPrivateIpExempt() && this.rfc1918.test(uri.host)) );
  },

  applyFilter : function(protocolService, uri, proxy) {
    if (!this.enabled)
      return proxy;

    // Namecoin goes through the proxy if resolution is enabled
    if(this.settingsManager.namecoinResolve && uri.host.substr(-4) == ".bit") {
      this.connectionManager.setProxyTunnel(proxy);
      
      return this.localProxy.getProxyInfo();
    }

    // Namecoin HTTPS goes through the proxy if verification is enabled
    if(this.settingsManager.namecoinBlockchain && uri.scheme == "https" && uri.host.substr(-4) == ".bit") {
      this.connectionManager.setProxyTunnel(proxy);
      
      return this.localProxy.getProxyInfo();
    }

    if ((uri.scheme == "https") && (!this.isNotaryUri(uri)) && (!this.isWhitelisted(uri))) {
	  //dump("Setting: namecoinOnly == " + this.settingsManager.namecoinOnly);
	  
      if(this.settingsManager.namecoinOnly) // Don't verify non-Namecoin connections if only Namecoin verification is requested
	  {
	    dump("Not verifying non-Namecoin site '" + uri.host + "'...\n");
	    return proxy;
	  }
	  else
	  {
	    this.connectionManager.setProxyTunnel(proxy);
      
            return this.localProxy.getProxyInfo();
	  }
    } else {
      // Not HTTPS and not Namecoin
      return proxy;
    }
  },

  getInterfaces: function(countRef) {
    var interfaces = [Components.interfaces.nsIClassInfo];
    countRef.value = interfaces.length;
    return interfaces;
  },

  getHelperForLanguage: function getHelperForLanguage(aLanguage) {
    return null;
  },

  getNativeCertificateCache: function() {
    return new NativeCertificateCache(this.cacheFile.path, this.settingsManager.getCacheCertificates());
  },

};

var components = [Convergence];

/**
  * XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
  * XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
  */
if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
else
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);

/** Component Loading **/

var loadScript = function(isChrome, subdir, filename) {
  try { logger = CV9BLog.core; }
  catch (e) {
    logger = (filename != 'Logger.js') ?
      function(line) { dump('Convergence.dump: ' + line + '\n') } :
      function(line) {} }
  try {
    var path = __LOCATION__.parent.clone();

    if (isChrome) {
      path = path.parent.clone();
      path.append('chrome');
      path.append('content');
    }

    if (subdir != null) {
      path.append(subdir);
    }

    path.append(filename);

    logger('Loading: ' + path.path);

    var fileProtocol = Components.classes['@mozilla.org/network/protocol;1?name=file']
      .getService(Components.interfaces['nsIFileProtocolHandler']);
    var loader = Components.classes['@mozilla.org/moz/jssubscript-loader;1']
      .getService(Components.interfaces['mozIJSSubScriptLoader']);

    loader.loadSubScript(fileProtocol.getURLSpecFromFile(path));

    logger('Loaded!');
  } catch (e) { logger('Error loading component script: ' + path.path + ' : ' + e); }
};

loadScript(true, null, 'Logger.js');

loadScript(true, 'ctypes', 'NSPR.js');
loadScript(true, 'ctypes', 'NSS.js');
loadScript(true, 'ctypes', 'SSL.js');
loadScript(true, 'ctypes', 'SQLITE.js');

loadScript(true, 'sockets', 'ConvergenceListenSocket.js');
loadScript(true, 'sockets', 'ConvergenceClientSocket.js');
loadScript(true, 'sockets', 'ConvergenceServerSocket.js');
loadScript(true, 'ctypes', 'Serialization.js');
loadScript(true, 'ssl', 'CertificateManager.js');
loadScript(true, 'ssl', 'CertificateInfo.js');
loadScript(true, 'proxy', 'HttpProxyServer.js');
loadScript(true, 'proxy', 'PatternList.js');

loadScript(false, null, 'LocalProxy.js');

loadScript(true, 'ssl', 'PhysicalNotary.js');
loadScript(true, 'ssl', 'Notary.js');
loadScript(false, null, 'SettingsManager.js');
loadScript(false, null, 'ConnectionManager.js');
loadScript(true, 'ssl', 'NativeCertificateCache.js');
loadScript(false, null, 'DatabaseHelper.js');
loadScript(true, 'util', 'ConvergenceUtil.js');
