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
 * This is setup by the ConnectionManager in "components."
 *
 **/

importScripts("chrome://convergence/content/ctypes/NSPR.js",
	      "chrome://convergence/content/ctypes/NSS.js",
	      "chrome://convergence/content/ctypes/SSL.js",
	      "chrome://convergence/content/ctypes/SQLITE.js",
	      "chrome://convergence/content/ctypes/Serialization.js",
	      "chrome://convergence/content/sockets/ConvergenceNotarySocket.js",
	      "chrome://convergence/content/sockets/ConvergenceServerSocket.js",
	      "chrome://convergence/content/sockets/ConvergenceClientSocket.js",	      
	      "chrome://convergence/content/sockets/MultiDestinationConnector.js",	      
	      "chrome://convergence/content/http/ConnectResponseParser.js",
	      "chrome://convergence/content/http/HttpRequestBuilder.js",
	      "chrome://convergence/content/http/HttpParser.js",
	      "chrome://convergence/content/proxy/HttpProxyServer.js",
	      "chrome://convergence/content/proxy/BaseProxyConnector.js",
	      "chrome://convergence/content/proxy/HttpProxyConnector.js",
	      "chrome://convergence/content/proxy/NotaryProxyConnector.js",
	      "chrome://convergence/content/proxy/SOCKS5Connector.js",
	      "chrome://convergence/content/proxy/ProxyConnector.js",
	      "chrome://convergence/content/ssl/CertificateInfo.js",
	      "chrome://convergence/content/ssl/Notary.js",
	      "chrome://convergence/content/ssl/PhysicalNotary.js",
	      "chrome://convergence/content/ssl/NativeCertificateCache.js",
	      "chrome://convergence/content/ssl/ActiveNotaries.js",
	      "chrome://convergence/content/ssl/CertificateManager.js",
	      "chrome://convergence/content/ConvergenceResponseStatus.js");

function sendClientResponse(localSocket, certificateManager, certificateInfo) {
  localSocket.writeBytes(NSPR.lib.buffer("HTTP/1.0 200 Connection established\r\n\r\n"), 39);
  localSocket.negotiateSSL(certificateManager, certificateInfo);
};

function waitForInput2(fd, timeoutMillis) {
  var pollfds_t        = ctypes.ArrayType(NSPR.types.PRPollDesc);
  var pollfds          = new pollfds_t(1);
  pollfds[0].fd        = fd;
  pollfds[0].in_flags  = NSPR.lib.PR_POLL_READ | NSPR.lib.PR_POLL_EXCEPT | NSPR.lib.PR_POLL_ERR;
  pollfds[0].out_flags = 0;

  var status = NSPR.lib.PR_Poll(pollfds, 1, timeoutMillis);
  
  if (status == -1 || status == 0) {
    return false;
  }

  return true;
};

// ToDo: finish this
function getNamecoinFingerprint(host) {

  // Mostly adapted from ConvergenceClientSocket.js

  var addrInfo = NSPR.lib.PR_GetAddrInfoByName("127.0.0.1", 
					       NSPR.lib.PR_AF_INET, 
					       NSPR.lib.PR_AI_ADDRCONFIG);

  if (addrInfo == null || addrInfo.isNull()) {
    throw "DNS lookup failed: " + NSPR.lib.PR_GetError() + "\n";
  }
  
  var netAddressBuffer = NSPR.lib.PR_Malloc(1024);
  var netAddress       = ctypes.cast(netAddressBuffer, NSPR.types.PRNetAddr.ptr);

  NSPR.lib.PR_EnumerateAddrInfo(null, addrInfo, 0, netAddress);
  NSPR.lib.PR_SetNetAddr(NSPR.lib.PR_IpAddrNull, NSPR.lib.PR_AF_INET, 
			 9000, netAddress);
  
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
  
  var hostSplit = host.split(".").reverse();
  
  var writeString = '{"params": ["getValue", "d/' + hostSplit[1] + '"], "method": "data", "id": 1}'; 

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
  
  if(domainData["fingerprint"]) {
    dump("Found fingerprint in blockchain.\n");
    // transform all fingerprints to uppercase
    if (domainData["fingerprint"] instanceof Array) {
        domainData["fingerprint"] = domainData["fingerprint"].map(function (x) { return x.toUpperCase(); });
    } else if (domainData["fingerprint"] instanceof String) {
        domainData["fingerprint"] = domainData["fingerprint"].toUpperCase();
    }
    return domainData["fingerprint"];
  }
  else {
    dump("No fingerprint in blockchain!\n");
    return null;
  }
  
}

function checkCertificateValidity(certificateCache, activeNotaries, host, port, 
				  certificateInfo, privatePkiExempt, namecoinBlockchain) 
{
  var target = host + ":" + port;

  if (privatePkiExempt && certificateInfo.isLocalPki) {
    dump("Certificate is a local PKI cert.\n");
    return {'status'      : true,
	    'target'      : target,
	    'certificate' : certificateInfo.original,
	    'details'     : [{'notary' : 'Local PKI',
	                      'status' : ConvergenceResponseStatus.VERIFICATION_SUCCESS}]};
  }

  dump("Checking certificate cache: " + certificateInfo.sha1 + "\n");

  if (certificateCache.isCached(host, port, certificateInfo.sha1)) 
    return {'status' : true, 
	    'target' : target, 
	    'certificate' : certificateInfo.original,
	    'details' : [{'notary' : 'Certificate Cache', 
		          'status' : ConvergenceResponseStatus.VERIFICATION_SUCCESS}]};

  if(namecoinBlockchain && host.substr(-4) == ".bit") {
    dump("Checking Namecoin blockchain...\n");
	
	var namecoinFingerprints = getNamecoinFingerprint(host);
	
	if(Array.isArray(namecoinFingerprints) && namecoinFingerprints.indexOf(certificateInfo.sha1) != -1)
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

  dump("Not cached, checking notaries: " + certificateInfo.sha1 + "\n");
  var results = activeNotaries.checkValidity(host, port, certificateInfo);

  if (results['status'] == true) {
    dump("Caching notary result: " + certificateInfo.sha1 + "\n");
    certificateCache.cacheFingerprint(host, port, certificateInfo.sha1);
    return results;
  } else {
    return results;
  }  
};

onmessage = function(event) {
  dump("ConnectionWorker got message...\n");
  var localSocket = null;
  var targetSocket = null;

  try {
    NSPR.initialize(event.data.nsprFile);
    NSS.initialize(event.data.nssFile);
    SSL.initialize(event.data.sslFile);
    SQLITE.initialize(event.data.sqliteFile);

    var certificateManager = new CertificateManager(event.data.certificates);
    var activeNotaries     = new ActiveNotaries(event.data.settings, event.data.notaries);
    localSocket            = new ConvergenceServerSocket(null, event.data.clientSocket);
    var destination        = new HttpProxyServer(localSocket).getConnectDestination();
	
	var resolvedHost = destination.host;
	
	// Check for .bit
	if(destination.host.substr(-4) == ".bit") {
	  dump("Resolving .bit HTTPS host " + destination.host + ":" + (destination.port) + "...\n");
	    
      // Mostly adapted from ConvergenceClientSocket.js
      
      var addrInfo = NSPR.lib.PR_GetAddrInfoByName("127.0.0.1", 
					       NSPR.lib.PR_AF_INET, 
					       NSPR.lib.PR_AI_ADDRCONFIG);
      
      if (addrInfo == null || addrInfo.isNull()) {
        throw "DNS lookup failed: " + NSPR.lib.PR_GetError() + "\n";
      }
      
      var netAddressBuffer = NSPR.lib.PR_Malloc(1024);
      var netAddress       = ctypes.cast(netAddressBuffer, NSPR.types.PRNetAddr.ptr);
      
      NSPR.lib.PR_EnumerateAddrInfo(null, addrInfo, 0, netAddress);
      NSPR.lib.PR_SetNetAddr(NSPR.lib.PR_IpAddrNull, NSPR.lib.PR_AF_INET, 
			 9000, netAddress);
        
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
        
      var hostSplit = destination.host.split(".").reverse();
        
      var writeString = '{"params": ["getValue", "d/' + hostSplit[1] + '"], "method": "data", "id": 1}'; 
      
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
      		
      var ipv4 = null;
	  
	  if (domainData["ip"])
	  {
	    if (domainData["ip"] instanceof Array) {
	      ipv4 = domainData["ip"][0];
	    }
	    else
	    {
	      ipv4 = domainData["ip"];
	    }
	  }
	  
	  if(ipv4 != null)
      {
		dump("IPv4 record: " + ipv4 + "\n");
		
		resolvedHost = ipv4;
      }
	}
	
    //targetSocket           = new ConvergenceClientSocket(destination.host, 
	targetSocket           = new ConvergenceClientSocket(resolvedHost, 
							 destination.port, 
							 event.data.proxy);
    var certificate        = targetSocket.negotiateSSL();
    var certificateInfo    = new CertificateInfo(certificate);
    var certificateCache   = new NativeCertificateCache(event.data.cacheFile, 
							event.data.settings['cacheCertificatesEnabled']);
    
    dump("Checking validity...\n");

    var results = this.checkCertificateValidity(certificateCache, activeNotaries,
						destination.host, destination.port,
						certificateInfo, event.data.settings['privatePkiExempt'], event.data.settings['namecoinBlockchain']);

    if (results['status'] == false) {
      certificateInfo.commonName = new NSS.lib.buffer("Invalid Certificate");
      certificateInfo.altNames   = null;      
    }
    
    certificateInfo.encodeVerificationDetails(results);

    this.sendClientResponse(localSocket, certificateManager, certificateInfo);

    postMessage({'clientFd' : Serialization.serializePointer(localSocket.fd), 
    	         'serverFd' : Serialization.serializePointer(targetSocket.fd)});

    certificateCache.close();

    dump("ConnectionWorker moving on!\n");
  } catch (e) {
    dump("ConnectionWorker exception : " + e + " , " + e.stack + "\n");
    if (localSocket != null) localSocket.close();
    if (targetSocket != null) targetSocket.close();
    dump("ConnectionWorker moving on from exception...\n");
  }
};
