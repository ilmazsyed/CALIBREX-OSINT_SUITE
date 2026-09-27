
import React, { useState } from 'react';
import { ToolItem } from '../types';
import { ExternalLink, Search } from 'lucide-react';

interface FunctionalToolItem extends ToolItem {
    searchPattern?: string; // URL pattern with {q} placeholder
}

const Tools: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const tools: FunctionalToolItem[] = [
    { title: '🌐 Domain Intelligence', description: 'WHOIS, DNS, IP Geolocation', url: 'https://who.is/', searchPattern: 'https://who.is/whois/{q}' },
    { title: '💰 Financial Tracking', description: 'Crypto, Bank Transfers, Shell Cos', url: 'https://www.blockchain.com/explorer', searchPattern: 'https://www.blockchain.com/explorer/search?search={q}' },
    { title: '👤 People Search', description: 'Social Media, Personnel Tracking', url: 'https://whatsmyname.app/', searchPattern: 'https://whatsmyname.app/?q={q}' },
    { title: '📚 Data Archives', description: 'Wayback Machine, Historical Records', url: 'https://web.archive.org/', searchPattern: 'https://web.archive.org/web/*/{q}' },
    { title: '🔐 Cyber Infrastructure', description: 'Shodan, Port Scanning, Servers', url: 'https://www.shodan.io/', searchPattern: 'https://www.shodan.io/search?query={q}' },
    { title: '📡 Satellite Imagery', description: 'Facility Monitoring, Changes Detection', url: 'https://apps.sentinel-hub.com/eo-browser/', searchPattern: null }, // Maps usually don't support simple string query deep linking easily
    { title: '✈️ Flight Tracking', description: 'ADS-B Exchange, FlightAware', url: 'https://globe.adsbexchange.com/', searchPattern: null },
    { title: '🚢 Maritime Tracking', description: 'MarineTraffic, VesselFinder', url: 'https://www.marinetraffic.com/', searchPattern: 'https://www.marinetraffic.com/en/ais/home/searchbox_term:{q}' },
    { title: '🏢 Corporate Registry', description: 'OpenCorporates, Global Companies', url: 'https://opencorporates.com/', searchPattern: 'https://opencorporates.com/companies?q={q}' },
  ];

  const toolUrl = (tool: FunctionalToolItem) => {
    if (searchQuery.trim() && tool.searchPattern) {
        return tool.searchPattern.replace('{q}', encodeURIComponent(searchQuery.trim()));
    }
    return tool.url;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-calibrex-gold mb-4 sm:mb-6 flex items-center gap-2">
          🛠 OSINT Toolkit
        </h2>

        {/* Universal Search Bar */}
        <div className="mb-6 sm:mb-8 max-w-2xl mx-auto">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="text-calibrex-muted" size={18} />
                </div>
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter IP, Domain, Email, or Name to search across tools..."
                    className="w-full bg-calibrex-surface-light border border-calibrex-teal/30 rounded pl-10 pr-4 py-2.5 sm:py-3 text-sm text-calibrex-text focus:outline-none focus:border-calibrex-teal focus:ring-1 focus:ring-calibrex-teal transition-all"
                />
            </div>
            {searchQuery && (
                <p className="text-xs text-calibrex-teal mt-2 text-center animate-in fade-in">
                    Click a tool below to instantly search for: <strong>{searchQuery}</strong>
                </p>
            )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, idx) => (
            <a key={idx} href={toolUrl(tool)} target="_blank" rel="noopener noreferrer" className="block bg-calibrex-surface-light p-4 sm:p-5 rounded-lg border-l-4 border-calibrex-teal shadow-sm hover:shadow-lg hover:bg-calibrex-surface-light/80 transition-all group cursor-pointer relative overflow-hidden">
              <h4 className="font-bold text-calibrex-gold mb-2 group-hover:text-white transition-colors flex justify-between items-start text-sm">
                  {tool.title}
                  <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-calibrex-teal" />
              </h4>
              <p className="text-calibrex-muted text-xs mb-3 sm:mb-4 min-h-[32px]">{tool.description}</p>
              <span className="block text-center w-full bg-transparent border border-calibrex-teal text-calibrex-teal group-hover:bg-calibrex-teal group-hover:text-calibrex-navy font-bold py-2 rounded text-xs uppercase tracking-wide transition-colors">
                {searchQuery && tool.searchPattern ? `Search "${searchQuery}"` : 'Launch Tool'}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Tools;