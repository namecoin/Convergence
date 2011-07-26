// Copyright (c) 2010 Moxie Marlinspike <moxie@thoughtcrime.org>

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

Components.utils.import("resource://gre/modules/NetUtil.jsm");

var Convergence = {

  convergenceManager: null,
  results: null,

  onLoad: function(event) {
    this.installToolbarIcon();
    this.initializeConvergenceManager();
    this.updateLocalStatus();
    this.setToolTip(null);
    this.initializeTabWatcher();
    this.initializeObserver();
  },

  setToolTip: function(status) {
    var panel = document.getElementById("convergence-button");

    if (status == null) {
      panel.tooltipText = "Page not secure.";
      return;
    }

    var tip = "";
      
    for (var i in status) {      
      tip += (status[i].notary + " : " + status[i].status + "\n");
    }

    panel.tooltipText = tip;
  },

  initializeTabWatcher: function() {
    var container   = gBrowser.tabContainer;
    var convergence = this;

    container.addEventListener("TabSelect", function(event) {
	dump("On tab selected..\n");
	try {
	  var status = new CertificateStatus().getCurrentTabStatus();	  
	  dump("Got status: " + status + "\n");
	  convergence.setToolTip(status);
	} catch (e) {
	  dump(e + " , " + e.stack);
	}
      }, false);
  },

  initializeConvergenceManager: function() {
    this.convergenceManager = Components.classes['@thoughtcrime.org/convergence;1']
    .getService().wrappedJSObject;
  },

  initializeObserver: function() {
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

    observerService.addObserver(this, "convergence-add-notary", false);
  },

  addNotaryFromFile: function(path) {
    var file = Components.classes["@mozilla.org/file/local;1"]
    .createInstance(Components.interfaces.nsILocalFile);	
    file.initWithPath(path);

    var convergenceManager = this.convergenceManager;

    NetUtil.asyncFetch(file, function(inputStream, status) {
	if (!Components.isSuccessCode(status)) {
	  return;
	}
	 
	var data          = NetUtil.readInputStreamToString(inputStream, inputStream.available());
	var notaryObject  = JSON.parse(data);
	var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
	.getService(Components.interfaces.nsIPromptService);

	var status        = promptService.confirm(null, "Trust This Notary?", 
						  "Are you sure that you would like to trust this notary: \n\n" +
						  notaryObject.host + "\n\n" +
						  "To verify the authenticity of your secure communication?");
	
	if (status) {
	  var notaryList = convergenceManager.getSettingsManager().getNotaryList();
	  var notary     = convergenceManager.getNewNotary();

	  notary.setHost(notaryObject.host);
	  notary.setSSLPort(notaryObject.ssl_port);
	  notary.setHTTPPort(notaryObject.http_port);
	  notary.setCertificate(notaryObject.certificate);
	  notary.setEnabled(true);

	  notaryList.push(notary);
	  convergenceManager.getSettingsManager().setNotaryList(notaryList);
	  convergenceManager.getSettingsManager().savePreferences();
	}
      });
  },

  observe: function(subject, topic, data) {
    dump("Observe called!\n");
    if (topic == "convergence-add-notary") {
      dump("Adding notary from file: " + data + "\n");
      this.addNotaryFromFile(data);
    }
  },

  onStatusBarClick: function(event) {
    if (event.button != 0) return;
    this.updateSystemStatus();
    this.updateLocalStatus();
  },

  onToolBarClick: function(event) {
    if (event.target.id == 'convergence-button' ||
	event.target.id == 'convergence-menu-toggle') 
    {
      dump("onToolBarClick\n");    
      this.updateSystemStatus();
      this.updateLocalStatus();
    }
  },

  onContentLoad: function(event) {
    var status = new CertificateStatus().getCurrentTabStatus();	  
    this.setToolTip(status);    
  },

  updateSystemStatus: function() {
    this.convergenceManager.setEnabled(!this.convergenceManager.isEnabled());
  },

  updateLocalStatus: function() {
    (this.convergenceManager.isEnabled() ? this.setEnabledStatus() : this.setDisabledStatus());
  },

  setEnabledStatus: function() {
    document.getElementById("convergence-menu-toggle").label    = "Disable";
    document.getElementById("convergence-button").image         = "chrome://convergence/content/images/status-enabled.png";
  },

  setDisabledStatus: function() {
    document.getElementById("convergence-menu-toggle").label    = "Enable";
    document.getElementById("convergence-button").image         = "chrome://convergence/content/images/status-disabled.png";
  },

  installToolbarIcon: function() {
    var toolbutton = document.getElementById("convergence-button");
    if (toolbutton && toolbutton.parentNode.localName != "toolbarpalette")
      return;
	  
    var toolbar = document.getElementById("nav-bar");
    if (!toolbar || typeof toolbar.insertItem != "function")
      return;

    toolbar.insertItem("convergence-button", null, null, false);    
    toolbar.setAttribute("currentset", toolbar.currentSet);
    document.persist(toolbar.id, "currentset");
  },


};


window.addEventListener("load", function(e) { Convergence.onLoad(e); }, false); 
window.document.addEventListener("DOMContentLoaded", function(e) {Convergence.onContentLoad(e);}, true);