# Convergence for Namecoin

Convergence for Namecoin is a modification to Moxie Marlinspike's tool Convergence, modified to implement the Namecoin .bit specification.  It can resolve .bit domains to IPv4 addresses, and verify .bit TLS certficates via the Namecoin blockchain.  This allows safe usage of self-signed certificates, without trusting any third party.  IP address mappings and TLS fingerprints are stored in the Namecoin blockchain; see the .bit specification for more details.

Convergence for Namecoin is a product of Viral Electron Chaos Laboratories (VECLabs).

## End-User Installation

1. Install namecoind and nmcontrol as per their documentation, and ensure that they are both running.
2. Install the XPI into Firefox.
3. Restart Firefox when prompted.
4. There will be a Convergence icon in the toolbar.  Click its dropdown menu and choose Options.
5. On the Advanced tab, make sure that "Verify Namecoin (.bit) domains" and "Only verify Namecoin (.bit) domains" are both checked.
6. Click OK.
7. Click the Convergence icon to turn it green.
8. That's it!  You can safely browse .bit websites without relying on third-party DNS, and .bit HTTPS websites will automatically have their certificates verified.

Website Administrators should consult the .bit specification for information on how to embed TLS fingerprints in the Namecoin blockchain.  An example configuration is at "d/namecoin-tls-test-3".

## Known Bugs

1. Some .bit websites don't load; this is because nmcontrol doesn't yet support the entire .bit specification.  (Placing bounties might improve this situation.)

## Donate

If you like Convergence for Namecoin and want to show your support, you can donate at the following addresses:

* Bitcoin: 19XajoDkrxKeDcXaCJVhBMeK83RSQ69HEV
* Namecoin: NCN4RnK2mKrLmYcLpNYvuLc1cZpTtiV7ZZ

## Thanks to:

* Moxie Marlinspike for Convergence.
* phelix and the Namecoin Marketing and Development Fund for supporting the project bounty.
* itsnotlupus for adding TLS to the .bit spec.
* khal for nmcontrol.
* khal and vinced for namecoind.
* Anyone else I forgot.
