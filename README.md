# Convergence for Namecoin

Convergence for Namecoin is a modification to Moxie Marlinspike's tool Convergence, modified to verify .bit TLS certficates via the Namecoin blockchain.  This allows safe usage of self-signed certificates, without trusting any third party.  TLS fingerprints are stored in the Namecoin blockchain; see the .bit specification for more details.

Convergence for Namecoin is a product of Viral Electron Chaos Laboratories (VECLabs).

## End-User Installation

1. Install namecoind and nmcontrol as per their documentation, and ensure that they are both running.
2. Ensure that you are able to browse HTTP .bit websites; this could be via a DNS server or a SOCKS proxy (run by you or a third-party).  Obviously, using third-party DNS/SOCKS is a bad idea for security/privacy.  My testing was done with a third-party DNS.  http://dot-bit.bit is a good test website.
3. Install the supplied XPI into Firefox.
4. Restart Firefox when prompted.
5. There will be a Convergence icon in the toolbar.  Click its dropdown menu and choose Options.
6. On the Advanced tab, make sure that "Verify Namecoin (.bit) domains" and "Only verify Namecoin (.bit) domains" are both checked.
7. Click OK.
8. Click the Convergence icon to turn it green.
9. That's it!  .bit HTTPS websites will automatically have their certificates verified.

Website Administrators should consult the .bit specification for information on how to embed TLS fingerprints in the Namecoin blockchain.  An example configuration is at "d/namecoin-tls-test".

## Known Bugs

1. Subdomains are currently assumed to have the same fingerprints as their parent domains.

## Thanks to:

* Moxie Marlinspike for Convergence.
* phelix and the Namecoin Marketing and Development Fund for supporting the project bounty.
* itsnotlupus for adding TLS to the .bit spec.
* khal for nmcontrol.
* khal and vinced for namecoind.
* Anyone else I forgot.
