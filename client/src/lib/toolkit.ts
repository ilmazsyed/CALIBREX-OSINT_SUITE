/** Phase 1: curated OSINT tool directory, grouped by the kind of input you start with.
 *  Each tool opens in a new tab; where a site supports deep-link search, {q} is filled in.
 *  Distilled from awesome-osint, the OSINT Framework and awesome-osint-repos. */

export interface DirTool {
  name: string;
  desc: string;
  url: string;
  search?: string;   // deep-link with {q}
  gh?: boolean;      // a code project (runs on the analyst's machine), not a website
}
export interface ToolGroup { id: string; label: string; hint: string; tools: DirTool[] }

export const TOOLKIT: ToolGroup[] = [
  { id: 'domain', label: 'Domain & website', hint: 'A website address, e.g. example.com', tools: [
    { name: 'Calibrex Infrastructure Recon', desc: 'Built in: subdomains, DNS, host, registration and reputation in one view', url: '#recon' },
    { name: 'VirusTotal', desc: 'Reputation, resolutions, detected files', url: 'https://www.virustotal.com/gui/home/search', search: 'https://www.virustotal.com/gui/domain/{q}' },
    { name: 'urlscan.io', desc: 'Screenshots and behaviour of a page when loaded', url: 'https://urlscan.io/', search: 'https://urlscan.io/domain/{q}' },
    { name: 'crt.sh', desc: 'TLS certificates and subdomains from Certificate Transparency', url: 'https://crt.sh/', search: 'https://crt.sh/?q={q}' },
    { name: 'SecurityTrails', desc: 'DNS and subdomain history', url: 'https://securitytrails.com/', search: 'https://securitytrails.com/domain/{q}/dns' },
    { name: 'Wayback Machine', desc: 'Archived versions of the site over time', url: 'https://web.archive.org/', search: 'https://web.archive.org/web/*/{q}' },
    { name: 'ThreatCrowd / ThreatMiner', desc: 'Related domains, IPs and samples', url: 'https://www.threatminer.org/', search: 'https://www.threatminer.org/domain.php?q={q}' },
  ]},
  { id: 'ip', label: 'IP address & host', hint: 'A server address, e.g. 8.8.8.8', tools: [
    { name: 'Calibrex Infrastructure Recon', desc: 'Built in: owner, network, country, reverse DNS, reputation', url: '#recon' },
    { name: 'Shodan', desc: 'Open ports, services and banners on the host', url: 'https://www.shodan.io/', search: 'https://www.shodan.io/host/{q}' },
    { name: 'Censys', desc: 'Host and certificate scan data', url: 'https://search.censys.io/', search: 'https://search.censys.io/hosts/{q}' },
    { name: 'AbuseIPDB', desc: 'Abuse reports against the IP', url: 'https://www.abuseipdb.com/', search: 'https://www.abuseipdb.com/check/{q}' },
    { name: 'GreyNoise', desc: 'Whether the IP is mass-scanning the internet', url: 'https://viz.greynoise.io/', search: 'https://viz.greynoise.io/ip/{q}' },
    { name: 'IPinfo', desc: 'Geolocation and network owner', url: 'https://ipinfo.io/', search: 'https://ipinfo.io/{q}' },
  ]},
  { id: 'email', label: 'Email & breaches', hint: 'An email address', tools: [
    { name: 'Have I Been Pwned', desc: 'Whether the address appears in known data breaches', url: 'https://haveibeenpwned.com/', search: 'https://haveibeenpwned.com/account/{q}' },
    { name: 'Hunter.io', desc: 'Email addresses associated with a company domain', url: 'https://hunter.io/', search: 'https://hunter.io/search/{q}' },
    { name: 'EmailRep', desc: 'Reputation and public profile of an address', url: 'https://emailrep.io/', search: 'https://emailrep.io/{q}' },
    { name: 'theHarvester', desc: 'Gathers emails and subdomains for a domain (command line)', url: 'https://github.com/laramies/theHarvester', gh: true },
  ]},
  { id: 'username', label: 'Username & social', hint: 'A handle used across sites', tools: [
    { name: 'WhatsMyName', desc: 'Checks a username across hundreds of sites (web)', url: 'https://whatsmyname.app/', search: 'https://whatsmyname.app/?q={q}' },
    { name: 'Sherlock', desc: 'Username across ~400 sites (command line)', url: 'https://github.com/sherlock-project/sherlock', gh: true },
    { name: 'Blackbird', desc: 'Username across ~600 sites with a profile summary (command line)', url: 'https://github.com/p1ngul1n0/blackbird', gh: true },
    { name: 'Social Searcher', desc: 'Real-time public social media mentions', url: 'https://www.social-searcher.com/', search: 'https://www.social-searcher.com/search-users/?q5={q}' },
  ]},
  { id: 'phone', label: 'Phone number', hint: 'An international number, e.g. +9198...', tools: [
    { name: 'PhoneInfoga', desc: 'Carrier, type and footprint of a number (command line)', url: 'https://github.com/sundowndev/phoneinfoga', gh: true },
    { name: 'Truecaller', desc: 'Crowd-sourced caller identification', url: 'https://www.truecaller.com/', search: 'https://www.truecaller.com/search/in/{q}' },
  ]},
  { id: 'geo', label: 'Maps, satellite & movement', hint: 'A place, vessel or aircraft', tools: [
    { name: 'Google Earth', desc: 'Historical high-resolution satellite imagery', url: 'https://earth.google.com/web/' },
    { name: 'Sentinel Hub EO Browser', desc: 'Free 10 m Sentinel-2 imagery by date', url: 'https://apps.sentinel-hub.com/eo-browser/' },
    { name: 'NASA FIRMS', desc: 'Active fire and heat detections', url: 'https://firms.modaps.eosdis.nasa.gov/map/' },
    { name: 'Zoom Earth', desc: 'Near-real-time weather and wildfire imagery', url: 'https://zoom.earth/' },
    { name: 'ADS-B Exchange', desc: 'Unfiltered live aircraft tracking', url: 'https://globe.adsbexchange.com/' },
    { name: 'MarineTraffic', desc: 'Live vessel positions', url: 'https://www.marinetraffic.com/', search: 'https://www.marinetraffic.com/en/ais/home/searchbox_term:{q}' },
    { name: 'SunCalc', desc: 'Sun position for verifying photo/video time of day', url: 'https://www.suncalc.org/' },
  ]},
  { id: 'image', label: 'Images & video', hint: 'A photo, still or video', tools: [
    { name: 'Google Lens', desc: 'Reverse image search', url: 'https://lens.google.com/' },
    { name: 'Yandex Images', desc: 'Reverse image search, strong on faces and places', url: 'https://yandex.com/images/' },
    { name: 'TinEye', desc: 'Finds where an image first appeared', url: 'https://tineye.com/' },
    { name: 'InVID / WeVerify', desc: 'Video verification and keyframe search', url: 'https://www.invid-project.eu/tools-and-services/invid-verification-plugin/' },
    { name: 'Forensically', desc: 'Image manipulation and error-level analysis', url: 'https://29a.ch/photo-forensics/' },
  ]},
  { id: 'company', label: 'Companies & records', hint: 'A company or organisation name', tools: [
    { name: 'OpenCorporates', desc: 'Company registrations worldwide', url: 'https://opencorporates.com/', search: 'https://opencorporates.com/companies?q={q}' },
    { name: 'OpenSanctions', desc: 'Sanctions, watchlists and politically exposed persons', url: 'https://www.opensanctions.org/', search: 'https://www.opensanctions.org/search/?q={q}' },
    { name: 'Aleph (OCCRP)', desc: 'Cross-border investigative document archive', url: 'https://aleph.occrp.org/', search: 'https://aleph.occrp.org/search?q={q}' },
    { name: 'India MCA', desc: 'Indian company and director registry', url: 'https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do' },
  ]},
  { id: 'crypto', label: 'Cryptocurrency', hint: 'A wallet address or transaction', tools: [
    { name: 'Blockchain Explorer', desc: 'Bitcoin address and transaction history', url: 'https://www.blockchain.com/explorer', search: 'https://www.blockchain.com/explorer/search?search={q}' },
    { name: 'Etherscan', desc: 'Ethereum address and token activity', url: 'https://etherscan.io/', search: 'https://etherscan.io/address/{q}' },
    { name: 'Breadcrumbs', desc: 'Visualise flows between wallets', url: 'https://www.breadcrumbs.app/' },
  ]},
  { id: 'frameworks', label: 'Directories & automation', hint: 'Reference lists and full toolkits', tools: [
    { name: 'awesome-osint', desc: 'The definitive categorised list of OSINT tools', url: 'https://github.com/jivoi/awesome-osint', gh: true },
    { name: 'OSINT Framework', desc: 'Visual directory of data sources by type', url: 'https://osintframework.com/' },
    { name: 'awesome-osint-repos', desc: 'Code tools sorted by input type', url: 'https://github.com/oryon-osint/awesome-osint-repos', gh: true },
    { name: 'SpiderFoot', desc: 'Automated recon across 200+ sources (self-host)', url: 'https://github.com/smicallef/spiderfoot', gh: true },
    { name: 'Maltego', desc: 'Link-analysis graphs of relationships', url: 'https://www.maltego.com/' },
    { name: 'Photon', desc: 'Fast web crawler for data extraction (command line)', url: 'https://github.com/s0md3v/Photon', gh: true },
  ]},
];
