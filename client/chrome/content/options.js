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

var convergence;
var settingsManager;
var notaries;
var cachedCerts;

function getNotaryTree() {
  return document.getElementById('notaryTree');
}

function onOptionsLoad() {
  convergence = Components.classes['@thoughtcrime.org/convergence;1'].getService().wrappedJSObject;
  settingsManager = convergence.getSettingsManager();
  notaries = settingsManager.getNotaryList();

  updateAdvancedSettings();
  updateNotarySettings();
  updateCacheSettings();
}

function onOptionsSave() {
  settingsManager.setCacheCertificates(document.getElementById('cache-certificates').checked);
  settingsManager.setNotaryBounce(document.getElementById('notary-bounce').checked);
  settingsManager.setConnectivityErrorIsFailure(document.getElementById('connectivity-failure').checked);
  settingsManager.setVerificationThreshold(document.getElementById('threshold').selectedItem.id);
  settingsManager.setMaxNotaryQuorum(document.getElementById('notary-quorum').value);
  settingsManager.setWhitelistPatterns(document.getElementById('exceptions').value);
  settingsManager.setPrivatePkiExempt(document.getElementById('private-pki-exempt').checked);
  settingsManager.setPrivateIpExempt(document.getElementById('private-ip-exempt').checked);
  settingsManager.setNamecoinResolve(document.getElementById("namecoin-resolve").checked);
  settingsManager.setNamecoinBlockchain(document.getElementById("namecoin-blockchain").checked);
  settingsManager.setNamecoinOnly(document.getElementById("namecoin-only").checked);

  settingsManager.setPriority0(document.getElementById('priority-list').getItemAtIndex(0).value);
  settingsManager.setPriority1(document.getElementById('priority-list').getItemAtIndex(1).value);
  settingsManager.setPriority2(document.getElementById('priority-list').getItemAtIndex(2).value);
  settingsManager.setPriority3(document.getElementById('priority-list').getItemAtIndex(3).value);
  settingsManager.setPriority4(document.getElementById('priority-list').getItemAtIndex(4).value);

  settingsManager.setNotaryList(notaries);
  settingsManager.savePreferences();
  issuePreferencesChangedNotification();

  if (isAllNotariesDisabled()) {
    alert('No configured notaries are enabled, disabling Convergence.');
    convergence.setEnabled(false);
    issueConvergenceDisabledNotification();
  }

  return true;
}

function onRemoveNotary() {
  var tree = getNotaryTree();
  var row = tree.currentIndex;
  var parentIndex = tree.view.getParentIndex(row);

  if (parentIndex != -1)
    row = parentIndex;

  var selectedNotary = getNotaryForRow(row);

  for (var i=0;i<notaries.length;i++) {
    if (notaries[i] == selectedNotary) {
      notaries.splice(i, 1);
      break;
    }
  }

  updateNotarySettings();
}

function isDuplicateNotary(notaryOne, notaryTwo) {
  if (notaryOne.getName() == notaryTwo.getName()) {
    if (notaryOne.getRegion() == null ||
        notaryTwo.getRegion() == null)
      return true;

    if (notaryOne.getRegion() ==
        notaryTwo.getRegion())
      return true;
  }

  return false;
}

function onAddNotary() {
  var retVal = {notary: null};
  window.openDialog('chrome://convergence/content/addNotary.xul', 'dialog2', 'modal', retVal).focus();

  if (retVal.notary) {
    for (var i=0;i<notaries.length;i++) {
      if (isDuplicateNotary(notaries[i], retVal.notary)) {
        CV9BLog.settings('Found duplicate: ' + notaries[i].getName());
        alert('Sorry, this notary conflicts with a notary that you already have configured.' +
              '  You can only use two notaries from the same organization if they are'       +
              ' configured  for seperate regions.');
        return;
      }
    }

    notaries.push(retVal.notary);
    updateNotarySettings();
  }
}

function onTreeSelected() {
  var tree = document.getElementById('notaryTree');
  var parentIndex = tree.view.getParentIndex(tree.currentIndex);

  if (parentIndex != -1) {
    tree.view.selection.select(parentIndex);
  }
}

function isAllNotariesDisabled() {
  for (var i=0;i<notaries.length;i++) {
    if (notaries[i].getEnabled()) {
      return false;
    }
  }

  return true;
};

var priorityLabels = {"Ip4": "IPv4", "Ip6": "IPv6", "Tor": "Tor Hidden Service (.onion)", "I2p": "I2P Eepsite", "DontUse": "<Resolvers below this line will not be used.>"}

function updateAdvancedSettings() {
  var cacheCertificatesEnabled = convergence.getSettingsManager().getCacheCertificates();
  var notaryBounceEnabled = convergence.getSettingsManager().getNotaryBounce();
  var connectivityIsFailureEnabled = convergence.getSettingsManager().getConnectivityErrorIsFailure();
  var verificationThreshold = convergence.getSettingsManager().getVerificationThreshold();
  var maxQuorum = convergence.getSettingsManager().getMaxNotaryQuorum();
  var whitelistPatterns = convergence.getSettingsManager().getWhitelistPatterns();
  var privateIpExempt = convergence.getSettingsManager().getPrivateIpExempt();
  var privatePkiExempt = convergence.getSettingsManager().getPrivatePkiExempt();
  var namecoinResolve = convergence.getSettingsManager().getNamecoinResolve();
  var namecoinBlockchain = convergence.getSettingsManager().getNamecoinBlockchain();
  var namecoinOnly = convergence.getSettingsManager().getNamecoinOnly();
  var priority0 = convergence.getSettingsManager().getPriority0();
  var priority1 = convergence.getSettingsManager().getPriority1();
  var priority2 = convergence.getSettingsManager().getPriority2();
  var priority3 = convergence.getSettingsManager().getPriority3();
  var priority4 = convergence.getSettingsManager().getPriority4();

  document.getElementById('cache-certificates').checked = cacheCertificatesEnabled;
  document.getElementById('notary-bounce').checked = notaryBounceEnabled;
  document.getElementById('connectivity-failure').checked = connectivityIsFailureEnabled;
  document.getElementById('threshold').selectedItem = document.getElementById(verificationThreshold);
  document.getElementById('notary-quorum').value = maxQuorum;
  document.getElementById('exceptions').value = whitelistPatterns.source;
  document.getElementById('private-ip-exempt').checked = privateIpExempt;
  document.getElementById('private-pki-exempt').checked = privatePkiExempt;
  document.getElementById("namecoin-resolve").checked = namecoinResolve;
  document.getElementById("namecoin-blockchain").checked = namecoinBlockchain;
  document.getElementById("namecoin-only").checked = namecoinOnly;
  
  if(priority0 != "") document.getElementById('priority-list').appendItem(priorityLabels[priority0], priority0);
  if(priority1 != "" && priority1 != priority0) document.getElementById('priority-list').appendItem(priorityLabels[priority1], priority1);
  if(priority2 != "" && priority2 != priority0 && priority2 != priority1) document.getElementById('priority-list').appendItem(priorityLabels[priority2], priority2);
  if(priority3 != "" && priority3 != priority0 && priority3 != priority1 && priority3 != priority2) document.getElementById('priority-list').appendItem(priorityLabels[priority3], priority3); 
  if(priority4 != "" && priority4 != priority0 && priority4 != priority1 && priority4 != priority2 && priority4 != priority3) document.getElementById('priority-list').appendItem(priorityLabels[priority4], priority4);
  
  var all_resolvers = priority0 + priority1 + priority2 + priority3 + priority4;
  if(all_resolvers.indexOf("Ip4") == -1) document.getElementById('priority-list').appendItem(priorityLabels["Ip4"], "Ip4");
  if(all_resolvers.indexOf("Ip6") == -1) document.getElementById('priority-list').appendItem(priorityLabels["Ip6"], "Ip6");
  if(all_resolvers.indexOf("DontUse") == -1) document.getElementById('priority-list').appendItem(priorityLabels["DontUse"], "DontUse");
  if(all_resolvers.indexOf("Tor") == -1) document.getElementById('priority-list').appendItem(priorityLabels["Tor"], "Tor");
  if(all_resolvers.indexOf("I2p") == -1) document.getElementById('priority-list').appendItem(priorityLabels["I2p"], "I2p");
  
  updateAnonWarning();
  
};

function updateCacheSettings(sortColumn, sortDirection) {
  var certificateCache = convergence.getNativeCertificateCache();
  cachedCerts = certificateCache.fetchAll(sortColumn, sortDirection);
  certificateCache.close();

  var cacheTree = document.getElementById('cacheTree');

  cacheTree.view = {
    rowCount: cachedCerts.length,

    getCellText : function(row, column) {
      var cachedCert = cachedCerts[row];

      if      (column.id == 'cacheLocation')    return cachedCert.location;
      else if (column.id == 'cacheFingerprint') return cachedCert.fingerprint;
      else if (column.id == 'cacheTimestamp')   return formatDate(cachedCert.timestamp);
    },

    setTree: function(treebox){this.treebox = treebox; },
    isContainer: function(row){return false;},
    isSeparator: function(row){ return false; },
    isSorted: function(){ return false; },
    isEditable: function(row, column) {return false;},
    getLevel: function(row){ return 0; },
    getImageSrc: function(row,col){ return null; },
    getRowProperties: function(row,props){},
    getCellProperties: function(row,col,props){},
    getColumnProperties: function(colid,col,props){},
    cycleHeader: function(col){}
  };
};

function getNotaryForRow(row) {
  var index = 0;

  for (var i=0;i<notaries.length;i++) {
    if (index == row)
      return notaries[i];

    if (notaries[i].open) {
      var subnotaries = notaries[i].getPhysicalNotaries();

      for (var j=0;j<subnotaries.length;j++) {
        if (++index == row)
          return subnotaries[j];
      }
    }

    index++;
  }
};

function getNotaryRowCount() {
  var count = 0;

  for (var i=0;i<notaries.length;i++) {
    count++;

    if (notaries[i].open) {
      count += notaries[i].getPhysicalNotaries().length;
    }
  }

  CV9BLog.settings('Notary row count: ' + count);
  return count;
};

function getLogicalNotaryName(notary) {
  if (notary.getRegion() != null) {
    return notary.getName() + ' (' + notary.getRegion() + ')';
  }

  return notary.getName();
};

function updateNotarySettings() {
  var notaryTree = getNotaryTree();

  notaryTree.view = {
    rowCount : getNotaryRowCount(),

    getCellText : function(row, col) {
      var notary = getNotaryForRow(row);
      var isLogical = (notary.parent == true);

      if (col.id == 'notaryHost') return (isLogical ? getLogicalNotaryName(notary) : notary.getHost());
      if (col.id == 'notaryHTTPPort') return (isLogical ? '' : notary.getHTTPPort());
      if (col.id == 'notarySSLPort') return (isLogical ? '' : notary.getSSLPort());
    },

    getCellValue: function(row, col) {
      var notary = getNotaryForRow(row);
      var isLogical = (notary.parent == true);

      if (col.id == 'notaryEnabled') return (isLogical ? notary.getEnabled() : false);
      if (col.id == 'notaryPriority') return (isLogical ? notary.getPriority() : false);
    },

    setCellValue: function(row, col, val) {
      var notary = getNotaryForRow(row);
      var isLogical = (notary.parent == true);
      if (!isLogical) return;
      if (col.id == 'notaryEnabled') return notary.setEnabled(val == 'true');
      if (col.id == 'notaryPriority') return notary.setPriority(val == 'true');
    },

    setTree: function(treebox){this.treebox = treebox; },

    isContainer: function(row){
      var notary = getNotaryForRow(row);
      return (notary.parent == true)
    },

    isContainerOpen: function(row) { return getNotaryForRow(row).open; },
    isContainerEmpty: function(idx) { return false; },
    isSeparator: function(row){ return false; },
    isSorted: function(){ return false; },
    isEditable: function(row, col) {
      return (col.id == 'notaryEnabled' || col.id == 'notaryPriority');
    },
    getLevel: function(row){
      return this.isContainer(row) ? 0 : 1;
    },
    getImageSrc: function(row,col){ return null; },
    getRowProperties: function(row,props){},
    getCellProperties: function(row,col,props){},
    getColumnProperties: function(colid,col,props){},
    getParentIndex: function(index) {
      if (this.isContainer(index))
        return -1;

      for (var t = index - 1; t >= 0 ; t--) {
        if (this.isContainer(t))
          return t;
      }
    },

    hasNextSibling: function(index, after) {
      var thisLevel = this.getLevel(index);

      for (var t = after + 1; t < this.rowCount; t++) {
        var nextLevel = this.getLevel(t);
        if (nextLevel == thisLevel) return true;
        if (nextLevel < thisLevel) break;
      }

      return false;
    },

    toggleOpenState: function(index) {
      var notary = getNotaryForRow(index);
      notary.open = !(notary.open);
    }

  };
}

function issuePreferencesChangedNotification() {
  // convergence.update();
}

function issueConvergenceDisabledNotification() {
  var observerService = Components.classes['@mozilla.org/observer-service;1']
    .getService(Components.interfaces.nsIObserverService);
  observerService.notifyObservers(observerService, 'convergence-disabled', null);
}

function onRemoveCertificate() {
  var tree = document.getElementById('cacheTree');
  var id = cachedCerts[tree.currentIndex].id;
  var certificateCache = convergence.getNativeCertificateCache();

  certificateCache.deleteCertificate(id);
  certificateCache.close();
  updateCacheSettings();
}

function onClearCache() {
  var certificateCache = convergence.getNativeCertificateCache();
  certificateCache.clearCache();
  certificateCache.close();
  updateCacheSettings();
}

function onAddCertificate() {
  var retVal = {fingerprint: null};
  window.openDialog('chrome://convergence/content/addCertificate.xul', 'dialog2', 'modal', retVal).focus();

  if (retVal.fingerprint) {
    var certificateCache = convergence.getNativeCertificateCache();
    certificateCache.cacheFingerprint(retVal.fingerprint.host, retVal.fingerprint.port, retVal.fingerprint.fingerprint);
    certificateCache.close();
    updateCacheSettings();
  }
}

function formatDate(date) {
  var year = date.getFullYear();
  var month = date.getMonth()+1;
  var dom = date.getDate();
  var hour = date.getHours();
  var min = date.getMinutes();
  var sec = date.getSeconds();

  if (month < 10) month = '0' + month;
  if (dom < 10)   dom = '0' + dom;
  if (hour < 10)  hour = '0' + hour;
  if (min < 10)   min = '0' + min;
  if (sec < 10)   sec = '0' + sec;

  return year + '-' + month + '-' + dom + ' ' + hour + ':' + min + ':' + sec;
}

function sortCacheTree(column) {
  var id = column.getAttribute('id');
  var sortDirection = column.getAttribute('sortDirection');
  var sortColumn = 'location';

  switch(sortDirection) {
    case 'ASC':
      sortDirection = 'DESC';
      break;
    case 'DESC':
      sortDirection = 'ASC';
      break;
    default:
  }

  if      (id == 'cacheLocation')    sortColumn = 'location';
  else if (id == 'cacheFingerprint') sortColumn = 'fingerprint';
  else if (id == 'cacheTimestamp')   sortColumn = 'timestamp';

  CV9BLog.settings('id: ' + id + ' column: ' + sortColumn + ' direction: ' + sortDirection);

  this.updateCacheSettings(sortColumn, sortDirection);
  column.setAttribute('sortDirection', sortDirection);
}

function updateAnonWarning() {
  
  var priorities = document.getElementById('priority-list');
  var itemValue;
  
  for(var index=0; index < priorities.getRowCount(); index++) {
  
    itemValue = priorities.getItemAtIndex(index).value;
  
    if(itemValue == "Tor" || itemValue == "I2p") {
      document.getElementById("anon-warning").classList.add("active-warning");
      return;
    }
    
    if(itemValue == "DontUse") {
      document.getElementById("anon-warning").classList.remove("active-warning");
      return;
    }
  }
  
  var torIndex = document.getElementById('priority-list').currentIndex;
  
}

function priorityIncrease() {
  
  var index = document.getElementById('priority-list').currentIndex;
  var label = document.getElementById('priority-list').selectedItem.label;
  var value = document.getElementById('priority-list').selectedItem.value;  
  
  document.getElementById('priority-list').removeItemAt(index);
  
  //alert("" + label + "," + value);
  
  document.getElementById('priority-list').selectItem(document.getElementById('priority-list').insertItemAt( (index-1 >= 0 ? index-1 : 0), label, value));
  
  updateAnonWarning();
  
}

function priorityDecrease() {

  var index = document.getElementById('priority-list').currentIndex;
  var label = document.getElementById('priority-list').selectedItem.label;
  var value = document.getElementById('priority-list').selectedItem.value;  
  
  document.getElementById('priority-list').removeItemAt(index);
  
  //alert("" + label + "," + value);
  
  document.getElementById('priority-list').selectItem(document.getElementById('priority-list').insertItemAt(index+1, label, value));
  
  updateAnonWarning();
}
