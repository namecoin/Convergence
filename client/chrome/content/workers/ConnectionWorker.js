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
  * This ChromeWorker is responsible for establishing an SSL connection
  * to the destination server, validating the target's SSL certificate
  * with the local cache or with the configured notaries, and then
  * establishing an SSL connection with the client.
  *
  * It then passes off the pair of established connections to its parent,
  * which hands them to the ShuffleWorker for all further shuffling.
  *
  * This is setup by the ConnectionManager in 'components.'
  *
  **/

importScripts(
  'chrome://convergence/content/Logger.js',
  'chrome://convergence/content/ctypes/NSPR.js',
  'chrome://convergence/content/ctypes/NSS.js',
  'chrome://convergence/content/ctypes/SSL.js',
  'chrome://convergence/content/ctypes/SQLITE.js',
  'chrome://convergence/content/ctypes/Serialization.js',
  'chrome://convergence/content/sockets/ConvergenceNotarySocket.js',
  'chrome://convergence/content/sockets/ConvergenceServerSocket.js',
  'chrome://convergence/content/sockets/ConvergenceClientSocket.js',
  'chrome://convergence/content/sockets/MultiDestinationConnector.js',
  'chrome://convergence/content/http/ConnectResponseParser.js',
  'chrome://convergence/content/http/HttpRequestBuilder.js',
  'chrome://convergence/content/http/HttpParser.js',
  'chrome://convergence/content/proxy/HttpProxyServer.js',
  'chrome://convergence/content/proxy/BaseProxyConnector.js',
  'chrome://convergence/content/proxy/HttpProxyConnector.js',
  'chrome://convergence/content/proxy/NotaryProxyConnector.js',
  'chrome://convergence/content/proxy/SOCKS5Connector.js',
  'chrome://convergence/content/proxy/ProxyConnector.js',
  'chrome://convergence/content/ssl/CertificateInfo.js',
  'chrome://convergence/content/ssl/Notary.js',
  'chrome://convergence/content/ssl/PhysicalNotary.js',
  'chrome://convergence/content/ssl/NativeCertificateCache.js',
  'chrome://convergence/content/ssl/ActiveNotaries.js',
  'chrome://convergence/content/ssl/CertificateManager.js',
  'chrome://convergence/content/ConvergenceResponseStatus.js' );

function sendClientResponse(localSocket, certificateManager, certificateInfo) {
  localSocket.writeBytes(NSPR.lib.buffer('HTTP/1.0 200 Connection established\r\n\r\n'), 39);
  localSocket.negotiateSSL(certificateManager, certificateInfo);
};

function waitForInput2(fd, timeoutMillis) {
  var pollfds_t	= ctypes.ArrayType(NSPR.types.PRPollDesc);
  var pollfds	  = new pollfds_t(1);
  pollfds[0].fd	= fd;
  pollfds[0].in_flags  = NSPR.lib.PR_POLL_READ | NSPR.lib.PR_POLL_EXCEPT | NSPR.lib.PR_POLL_ERR;
  pollfds[0].out_flags = 0;

  var status = NSPR.lib.PR_Poll(pollfds, 1, timeoutMillis);
  
  if (status == -1 || status == 0) {
    return false;
  }

  return true;
};

function getNamecoinDnsField(host, method, params, settings) {
  
    // Mostly adapted from ConvergenceClientSocket.js

  var nmcontrol_host;
  var nmcontrol_port;

  if(settings['daemonMode'] == 'namecoind-nmcontrol') {
    nmcontrol_host = "127.0.0.1";
    nmcontrol_port = 18836;
  } else {
    nmcontrol_host = "127.0.0.1";
    nmcontrol_port = 9000;
  }

  var addrInfo = NSPR.lib.PR_GetAddrInfoByName(nmcontrol_host, 
					       NSPR.lib.PR_AF_INET, 
					       NSPR.lib.PR_AI_ADDRCONFIG);

  if (addrInfo == null || addrInfo.isNull()) {
    throw "DNS lookup failed: " + NSPR.lib.PR_GetError() + "\n";
  }
  
  var netAddressBuffer = NSPR.lib.PR_Malloc(1024);
  var netAddress       = ctypes.cast(netAddressBuffer, NSPR.types.PRNetAddr.ptr);

  NSPR.lib.PR_EnumerateAddrInfo(null, addrInfo, 0, netAddress);
  NSPR.lib.PR_SetNetAddr(NSPR.lib.PR_IpAddrNull, NSPR.lib.PR_AF_INET, 
			 nmcontrol_port, netAddress);
  
  var fd = NSPR.lib.PR_OpenTCPSocket(NSPR.lib.PR_AF_INET);

  if (fd == null) {
    throw "Unable to construct socket!\n";
  }
  
  var status = NSPR.lib.PR_Connect(fd, netAddress, NSPR.lib.PR_SecondsToInterval(5));

  if (status != 0) {
    NSPR.lib.PR_Free(netAddressBuffer);
    NSPR.lib.PR_FreeAddrInfo(addrInfo);
    NSPR.lib.PR_Close(fd);
    throw "Failed to connect to nmcontrol" + " -- " + NSPR.lib.PR_GetError();
  }
  
  NSPR.lib.PR_Free(netAddressBuffer);
  NSPR.lib.PR_FreeAddrInfo(addrInfo);
  
  // Not needed with new nmcontrol
  //var hostSplit = host.split(".").reverse();
  
  // Fixed for new nmcontrol
  //var writeString = '{"params": ["getValue", "d/' + hostSplit[1] + '"], "method": "data", "id": 1}'; 
  var writeObj = {method: "dns", id: 1};
  writeObj.params = [method, host].concat(params);
  var writeString = JSON.stringify(writeObj);
  dump("writing data to nmcontrol:\n" + writeString + "\n");

  NSPR.lib.PR_Write(fd, NSPR.lib.buffer(writeString), writeString.length);
  
  var buffer = new NSPR.lib.buffer(4096);
  var read;

  while (((read = NSPR.lib.PR_Read(fd, buffer, 4095)) == -1) && 
	 (NSPR.lib.PR_GetError() == NSPR.lib.PR_WOULD_BLOCK_ERROR))
  {
    dump("polling on read...\n");
    if (!waitForInput2(fd, -1))
      return null;
  }

  if (read <= 0) {
    dump("Error read: " + read + " , " + NSPR.lib.PR_GetError() + "\n");
    return null;
  }

  buffer[read] = 0;
  var resultString = buffer.readString();
  
  dump("nmcontrol returned:\n" + resultString + "\n");
  
  var domainData = JSON.parse(resultString)["result"]["reply"];
  
  dump("domain data:\n" + domainData + "\n");
  
  domainData = JSON.parse(domainData);

  return domainData;
};

function getNamecoinIp4(host, settings) {

  var domainData = getNamecoinDnsField(host, "getIp4", [], settings);

  // returns empty array when no IP found
  if(! (domainData instanceof Array && ! domainData[0] ) ) {
    dump("Found IPv4 address in blockchain.\n");
    return domainData;
  }
  else {
    dump("No IPv4 address in blockchain!\n");
    return null;
  }
  
};

function getNamecoinIp6(host, settings) {

  var domainData = getNamecoinDnsField(host, "getIp6", [], settings);

  // returns empty array when no IP found
  if(! (domainData instanceof Array && ! domainData[0] ) ) {
    dump("Found IPv6 address in blockchain.\n");
    return domainData;
  }
  else {
    dump("No IPv6 address in blockchain!\n");
    return null;
  }
  
};

function getNamecoinTor(host, settings) {

  var domainData = getNamecoinDnsField(host, "getOnion", [], settings);

  // returns empty array when no IP found
  if(! (domainData instanceof Array && ! domainData[0] ) ) {
    dump("Found Tor address in blockchain.\n");
    return domainData;
  }
  else {
    dump("No Tor address in blockchain!\n");
    return null;
  }
  
};

function getNamecoinI2p(host, settings) {

  var domainData = getNamecoinDnsField(host, "getI2p_b32", [], settings);

  // returns empty array when no IP found
  if(! (domainData instanceof Array && ! domainData[0] ) ) {
    dump("Found I2P address in blockchain.\n");
    return domainData;
  }
  else {
    dump("No I2P address in blockchain!\n");
    return null;
  }
  
};

var namecoinResolvers = {"Ip4": getNamecoinIp4, "Ip6": getNamecoinIp6, "Tor": getNamecoinTor, "I2p": getNamecoinI2p, "DontUse": function(){return null;}};

function getNamecoinResolution(host, settings) {
  
  var resolvedData;
  var giveUp = false;
  var ns = false;
  var unsupportedResolver = "";
  
  for(var priority=0; priority <= 4; priority++)
  {
    // If this is true, then we're looking at resolvers that the user hasn't authorized
    if(settings['priority'+priority] == "DontUse") giveUp = true;
    
    dump("Checking resolver " + settings['priority'+priority] + "\n");
    
    // Resolve the domain using the currently iterated resolver
    resolvedData = namecoinResolvers[settings['priority'+priority]](host, settings);
    
    // Check if nmcontrol is complaining about "ns"
    if (resolvedData instanceof Array && resolvedData[0] && resolvedData.indexOf("ns")>=0) {
      ns = true;
      continue;
    }
    
    // If we found something... 
    if (resolvedData instanceof Array && resolvedData[0] ) {
      
      // if the resolver is authorized, return it
      if(! giveUp) return resolvedData;
      
      // if the resolver is unauthorized, log an error
      unsupportedResolver = unsupportedResolver + ", " + settings['priority'+priority];
    }
  }
  
  var errorMessage = "";
  
  if(ns) errorMessage = errorMessage + "The requested domain " + host + " would bypass the Namecoin blockchain.  " ;
  if(unsupportedResolver !== "") errorMessage = errorMessage + "The following domain resolvers are disabled: " + unsupportedResolver.slice(2) + ".  ";
  
  if(!ns && unsupportedResolver === "") errorMessage = errorMessage + "No resolvable address was found for the requested domain " + host + ".  ";
  
  throw errorMessage;
  
  return null;
  
};

function checkCertificateValidity(
  certificateCache, activeNotaries, host, port, ip,
  certificateInfo, privatePkiExempt, namecoinBlockchain, settings)
{
  var target = host + ':' + port;

  if (privatePkiExempt && certificateInfo.isLocalPki) {
    CV9BLog.worker_conn('Certificate is a local PKI cert.');
    return {
      'status' : true,
      'target' : target,
      'certificate' : certificateInfo.original,
      'details' : [{
	'notary' : 'Local PKI',
	'status' : ConvergenceResponseStatus.VERIFICATION_SUCCESS }] };
  }

  CV9BLog.worker_conn('Checking certificate cache: ' + certificateInfo.sha1);

  if (certificateCache.isCached(host, port, certificateInfo.sha1))
    return {
      'status' : true,
      'target' : target,
      'certificate' : certificateInfo.original,
      'details' : [{
	'notary' : 'Certificate Cache',
	'status' : ConvergenceResponseStatus.VERIFICATION_SUCCESS }] };

  if(namecoinBlockchain && host.substr(-4) == ".bit") {
    dump("Checking Namecoin blockchain...\n");
	
	var fprOk = getNamecoinDnsField(host, "verifyFingerprint",
					[certificateInfo.sha1], settings);
	dump("Result of verifyFingerprint: " + fprOk + "\n");

	if (fprOk)
	{
		dump("Fingerprint matched blockchain.\n");
	
		dump("Caching blockchain result: " + certificateInfo.sha1 + "\n");
		certificateCache.cacheFingerprint(host, port, certificateInfo.sha1);
	
		// Fingerprint found
		return {'status'      : true,
			'target'      : target,
			'certificate' : certificateInfo.original,
			'details'     : [{'notary' : 'Namecoin',
			'status' : ConvergenceResponseStatus.VERIFICATION_SUCCESS}]};
	}
	else
	{
		dump("Fingerprint did not match blockchain.\n");
		// Fingerprint not found
		return {'status'      : false,
			'target'      : target,
			'certificate' : certificateInfo.original,
			'details'     : [{'notary' : 'Namecoin',
			'status' : ConvergenceResponseStatus.VERIFICATION_FAILURE}]};
	}
  }

  CV9BLog.worker_conn('Not cached, checking notaries: ' + certificateInfo.sha1);
  var results = activeNotaries.checkValidity(host, port, ip, certificateInfo);

  if (results['status'] === true) {
    CV9BLog.worker_conn('Caching notary result: ' + certificateInfo.sha1);
    certificateCache.cacheFingerprint(host, port, certificateInfo.sha1);
    return results;
  } else {
    return results;
  }
};

onmessage = function(event) {
  var localSocket = null;
  var targetSocket = null;

  try {
    if (typeof event.data.logging === 'boolean') CV9BLog.print_all = event.data.logging;
    CV9BLog.worker_conn('Got message...');

    NSPR.initialize(event.data.nsprFile);
    NSS.initialize(event.data.nssFile);
    SSL.initialize(event.data.sslFile);
    SQLITE.initialize(event.data.sqliteFile);

    var certificateManager = new CertificateManager(event.data.certificates);
    var activeNotaries     = new ActiveNotaries(event.data.settings, event.data.notaries);
    localSocket	    = new ConvergenceServerSocket(null, event.data.clientSocket);
    var destination	= new HttpProxyServer(localSocket).getConnectDestination();
	
	var resolvedHost = destination.host;
	
	// Check for .bit
	if(event.data.settings['namecoinResolve'] && destination.host.substr(-4) == ".bit") {
	  dump("Resolving .bit host " + destination.host + ":" + (destination.port) + "...\n");
	
      try {
	
	var domainData = getNamecoinResolution(destination.host, event.data.settings);
      	
	var resolved = domainData[0]; // ToDo: round-robin balancing
	
	dump("Resolved record: " + resolved + "\n");
	
	resolvedHost = resolved;

	} catch(e) {

	    // .bit DNS resolution error

	    localSocket.close();

	    postMessage({'namecoinError' : e});

	    return;

	}

	}
	else {
	  dump("ConnectionWorker non-Namecoin host '" + destination.host + "'\n");
	}
	
	var new_proxy = event.data.proxy;
	
	// ToDo: nest the below if statements
	// ToDo: move the proxy settings into GUI config
	
	if(event.data.settings['namecoinResolve'] && destination.host.substr(-4) == ".bit" && resolvedHost.substr(-6) == ".onion") {
	  
	  new_proxy = {
	    'host' : event.data.settings['proxyTorHost'],
	    'port' : event.data.settings['proxyTorPort'],
	    'type' : event.data.settings['proxyTorProtocol'] };
	}
	
	if(event.data.settings['namecoinResolve'] && destination.host.substr(-4) == ".bit" && resolvedHost.substr(-4) == ".i2p") {
	  
	  new_proxy = {
	    'host' : event.data.settings['proxyI2pHost'],
	    'port' : event.data.settings['proxyI2pPort'],
	    'type' : event.data.settings['proxyI2pProtocol'] };
	}
	
	dump("ConnectionWorker connecting client socket to " + resolvedHost + ":" + destination.port + "\n");
	
	
	
    //targetSocket	   = new ConvergenceClientSocket(destination.host, 
	targetSocket	   = new ConvergenceClientSocket(resolvedHost, 
							 destination.port, 
							 new_proxy);

    if(! destination.passThroughHeaders) {
    
    // If not a Namecoin domain, don't try to MITM it
    if(event.data.settings['namecoinOnly'] && destination.host.substr(-4) != ".bit") {
      dump("Skipping MITM...\n");
      localSocket.writeBytes(NSPR.lib.buffer('HTTP/1.0 200 Connection established\r\n\r\n'), 39);
      postMessage({'clientFd' : Serialization.serializePointer(localSocket.fd), 
    	           'serverFd' : Serialization.serializePointer(targetSocket.fd)});
      
      dump("Standard TLS launched.\n");
    }
    else {
    
    var certificate	= targetSocket.negotiateSSL();
    var certificateInfo    = new CertificateInfo(certificate);
    var certificateCache   = new NativeCertificateCache(event.data.cacheFile, 
							event.data.settings['cacheCertificatesEnabled']);
    
    dump("Checking validity...\n");

    var results = this.checkCertificateValidity(certificateCache, activeNotaries,
						destination.host, destination.port, targetSocket.ip,
						certificateInfo, event.data.settings['privatePkiExempt'], event.data.settings['namecoinBlockchain'], event.data.settings);

    CV9BLog.worker_conn('Validity check results:', results);

    // Such override allows totally invalid certificates to be used,
    //  e.g. if CN and SubjectAltNames had nothing to do with the hostname/ip.
    certificateInfo.commonName = new NSS.lib.buffer(
      results['status'] === true ? destination.host : 'Invalid Certificate' );
    certificateInfo.altNames = null;    
    
    certificateInfo.encodeVerificationDetails(results);

    certificateInfo.encodeVerificationDetails(results);
    this.sendClientResponse(localSocket, certificateManager, certificateInfo);
    postMessage({
      'clientFd' : Serialization.serializePointer(localSocket.fd),
      'serverFd' : Serialization.serializePointer(targetSocket.fd) });
    certificateCache.close();

    }
    }
    else {
      targetSocket.writeBytes(NSPR.lib.buffer(destination.passThroughHeaders), destination.passThroughHeaders.length);

      postMessage({'clientFd' : Serialization.serializePointer(localSocket.fd), 
    		   'serverFd' : Serialization.serializePointer(targetSocket.fd)});
    }

    CV9BLog.worker_conn('done');
  } catch (e) {
    CV9BLog.worker_conn('exception - ' + e + ', ' + e.stack);
    if (localSocket != null) localSocket.close();
    if (targetSocket != null) targetSocket.close();
    CV9BLog.worker_conn('moving on from exception...');
  }
};
