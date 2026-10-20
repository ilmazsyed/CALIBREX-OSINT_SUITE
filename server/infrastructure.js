// Strategic infrastructure — a curated, keyless dataset of the ports, airports,
// maritime chokepoints and energy terminals that matter for supply-chain and
// geographic-risk analysis. Locations are public facts; coordinates are
// approximate (strategic overview, not navigation). India-facing emphasis.
// type: 'chokepoint' | 'port' | 'airport' | 'energy'

export const INFRASTRUCTURE = [
  // ---- Maritime chokepoints (the supply-chain pressure points)
  { id: 'cp-hormuz', name: 'Strait of Hormuz', type: 'chokepoint', lat: 26.57, lng: 56.25, country: 'Oman/Iran', note: '~20% of global oil; Gulf exports' },
  { id: 'cp-malacca', name: 'Strait of Malacca', type: 'chokepoint', lat: 2.5, lng: 101.3, country: 'Malaysia/Indonesia', note: 'Asia–Europe main artery' },
  { id: 'cp-suez', name: 'Suez Canal', type: 'chokepoint', lat: 30.42, lng: 32.35, country: 'Egypt', note: 'Europe–Asia shortcut' },
  { id: 'cp-babmandeb', name: 'Bab-el-Mandeb', type: 'chokepoint', lat: 12.58, lng: 43.33, country: 'Yemen/Djibouti', note: 'Red Sea gateway' },
  { id: 'cp-panama', name: 'Panama Canal', type: 'chokepoint', lat: 9.08, lng: -79.68, country: 'Panama', note: 'Atlantic–Pacific' },
  { id: 'cp-bosphorus', name: 'Bosphorus Strait', type: 'chokepoint', lat: 41.12, lng: 29.07, country: 'Turkey', note: 'Black Sea grain & oil' },
  { id: 'cp-gibraltar', name: 'Strait of Gibraltar', type: 'chokepoint', lat: 35.95, lng: -5.6, country: 'Spain/Morocco', note: 'Mediterranean gateway' },
  { id: 'cp-taiwan', name: 'Taiwan Strait', type: 'chokepoint', lat: 24.5, lng: 119.5, country: 'Taiwan/China', note: 'East Asia shipping & tension' },
  { id: 'cp-sunda', name: 'Sunda Strait', type: 'chokepoint', lat: -6.0, lng: 105.9, country: 'Indonesia', note: 'Malacca alternative' },
  { id: 'cp-lombok', name: 'Lombok Strait', type: 'chokepoint', lat: -8.7, lng: 115.8, country: 'Indonesia', note: 'Deep-draft alternative' },
  { id: 'cp-dover', name: 'Dover Strait', type: 'chokepoint', lat: 51.0, lng: 1.5, country: 'UK/France', note: 'Busiest shipping lane' },
  { id: 'cp-goodhope', name: 'Cape of Good Hope', type: 'chokepoint', lat: -34.35, lng: 18.47, country: 'South Africa', note: 'Suez diversion route' },

  // ---- Major container ports (global)
  { id: 'pt-shanghai', name: 'Port of Shanghai', type: 'port', lat: 30.63, lng: 122.07, country: 'China', note: "World's busiest container port" },
  { id: 'pt-singapore', name: 'Port of Singapore', type: 'port', lat: 1.26, lng: 103.84, country: 'Singapore', note: 'Top transshipment hub' },
  { id: 'pt-ningbo', name: 'Ningbo-Zhoushan', type: 'port', lat: 29.87, lng: 121.85, country: 'China', note: 'Top by cargo tonnage' },
  { id: 'pt-shenzhen', name: 'Port of Shenzhen', type: 'port', lat: 22.5, lng: 113.9, country: 'China', note: 'Pearl River Delta' },
  { id: 'pt-busan', name: 'Port of Busan', type: 'port', lat: 35.1, lng: 129.05, country: 'South Korea', note: 'NE Asia hub' },
  { id: 'pt-rotterdam', name: 'Port of Rotterdam', type: 'port', lat: 51.95, lng: 4.14, country: 'Netherlands', note: 'Largest European port' },
  { id: 'pt-antwerp', name: 'Port of Antwerp', type: 'port', lat: 51.26, lng: 4.4, country: 'Belgium', note: 'Chemicals & containers' },
  { id: 'pt-hamburg', name: 'Port of Hamburg', type: 'port', lat: 53.54, lng: 9.95, country: 'Germany', note: 'Central European gateway' },
  { id: 'pt-jebelali', name: 'Jebel Ali (Dubai)', type: 'port', lat: 25.01, lng: 55.06, country: 'UAE', note: 'Largest ME port' },
  { id: 'pt-la', name: 'Port of Los Angeles', type: 'port', lat: 33.73, lng: -118.26, country: 'USA', note: 'US west-coast gateway' },
  { id: 'pt-nynj', name: 'Port of New York/NJ', type: 'port', lat: 40.66, lng: -74.08, country: 'USA', note: 'US east-coast gateway' },
  { id: 'pt-portklang', name: 'Port Klang', type: 'port', lat: 3.0, lng: 101.39, country: 'Malaysia', note: 'Malacca transshipment' },
  { id: 'pt-colombo', name: 'Port of Colombo', type: 'port', lat: 6.95, lng: 79.84, country: 'Sri Lanka', note: 'South Asia transshipment' },
  { id: 'pt-tangermed', name: 'Tanger Med', type: 'port', lat: 35.88, lng: -5.5, country: 'Morocco', note: 'Gibraltar hub' },
  { id: 'pt-piraeus', name: 'Port of Piraeus', type: 'port', lat: 37.94, lng: 23.63, country: 'Greece', note: 'Med gateway' },
  { id: 'pt-santos', name: 'Port of Santos', type: 'port', lat: -23.96, lng: -46.3, country: 'Brazil', note: 'Largest Latin American port' },
  { id: 'pt-durban', name: 'Port of Durban', type: 'port', lat: -29.87, lng: 31.03, country: 'South Africa', note: 'Busiest African port' },

  // ---- India ports (supply-chain focus)
  { id: 'pt-nhavasheva', name: 'Jawaharlal Nehru (Nhava Sheva)', type: 'port', lat: 18.95, lng: 72.95, country: 'India', note: "India's largest container port" },
  { id: 'pt-mundra', name: 'Mundra Port', type: 'port', lat: 22.74, lng: 69.7, country: 'India', note: 'Largest private port (Adani)' },
  { id: 'pt-chennai', name: 'Chennai Port', type: 'port', lat: 13.1, lng: 80.3, country: 'India', note: 'East-coast gateway' },
  { id: 'pt-vizag', name: 'Visakhapatnam Port', type: 'port', lat: 17.68, lng: 83.28, country: 'India', note: 'Deep-water east coast' },
  { id: 'pt-kandla', name: 'Deendayal (Kandla)', type: 'port', lat: 23.0, lng: 70.22, country: 'India', note: 'Gujarat cargo hub' },
  { id: 'pt-cochin', name: 'Cochin Port', type: 'port', lat: 9.97, lng: 76.26, country: 'India', note: 'Kerala transshipment' },
  { id: 'pt-tuticorin', name: 'V.O. Chidambaranar (Tuticorin)', type: 'port', lat: 8.75, lng: 78.2, country: 'India', note: 'Southern gateway' },
  { id: 'pt-paradip', name: 'Paradip Port', type: 'port', lat: 20.26, lng: 86.67, country: 'India', note: 'Bulk & energy' },

  // ---- Major cargo / hub airports
  { id: 'ap-hkg', name: 'Hong Kong (HKG)', type: 'airport', lat: 22.31, lng: 113.91, country: 'China', note: 'Top air-cargo hub' },
  { id: 'ap-mem', name: 'Memphis (MEM)', type: 'airport', lat: 35.04, lng: -89.98, country: 'USA', note: 'FedEx superhub' },
  { id: 'ap-pvg', name: 'Shanghai Pudong (PVG)', type: 'airport', lat: 31.14, lng: 121.8, country: 'China', note: 'China air freight' },
  { id: 'ap-icn', name: 'Incheon (ICN)', type: 'airport', lat: 37.46, lng: 126.44, country: 'South Korea', note: 'NE Asia hub' },
  { id: 'ap-dxb', name: 'Dubai (DXB)', type: 'airport', lat: 25.25, lng: 55.36, country: 'UAE', note: 'Global connecting hub' },
  { id: 'ap-sin', name: 'Singapore (SIN)', type: 'airport', lat: 1.36, lng: 103.99, country: 'Singapore', note: 'SE Asia hub' },
  { id: 'ap-fra', name: 'Frankfurt (FRA)', type: 'airport', lat: 50.04, lng: 8.56, country: 'Germany', note: 'European freight hub' },
  { id: 'ap-cdg', name: 'Paris CDG', type: 'airport', lat: 49.01, lng: 2.55, country: 'France', note: 'European hub' },
  { id: 'ap-lhr', name: 'London Heathrow (LHR)', type: 'airport', lat: 51.47, lng: -0.46, country: 'UK', note: 'UK gateway' },
  { id: 'ap-ams', name: 'Amsterdam (AMS)', type: 'airport', lat: 52.31, lng: 4.76, country: 'Netherlands', note: 'European hub' },
  { id: 'ap-ist', name: 'Istanbul (IST)', type: 'airport', lat: 41.26, lng: 28.74, country: 'Turkey', note: 'Europe–Asia bridge' },
  { id: 'ap-del', name: 'Delhi (DEL)', type: 'airport', lat: 28.56, lng: 77.1, country: 'India', note: "India's busiest airport" },
  { id: 'ap-bom', name: 'Mumbai (BOM)', type: 'airport', lat: 19.09, lng: 72.87, country: 'India', note: 'Commercial capital hub' },
  { id: 'ap-blr', name: 'Bengaluru (BLR)', type: 'airport', lat: 13.2, lng: 77.71, country: 'India', note: 'Tech corridor' },
  { id: 'ap-maa', name: 'Chennai (MAA)', type: 'airport', lat: 12.99, lng: 80.17, country: 'India', note: 'South India hub' },
  { id: 'ap-hyd', name: 'Hyderabad (HYD)', type: 'airport', lat: 17.24, lng: 78.43, country: 'India', note: 'Pharma & cargo' },

  // ---- Energy terminals & nodes
  { id: 'en-rastanura', name: 'Ras Tanura Terminal', type: 'energy', lat: 26.64, lng: 50.16, country: 'Saudi Arabia', note: 'Largest oil export terminal' },
  { id: 'en-fujairah', name: 'Fujairah', type: 'energy', lat: 25.17, lng: 56.35, country: 'UAE', note: 'Bunkering & storage, outside Hormuz' },
  { id: 'en-kharg', name: 'Kharg Island', type: 'energy', lat: 29.23, lng: 50.32, country: 'Iran', note: 'Main Iranian oil terminal' },
  { id: 'en-raslaffan', name: 'Ras Laffan LNG', type: 'energy', lat: 25.9, lng: 51.55, country: 'Qatar', note: 'Major LNG export' },
  { id: 'en-ruwais', name: 'Ruwais', type: 'energy', lat: 24.11, lng: 52.73, country: 'UAE', note: 'Refining & petrochem' },
  { id: 'en-houston', name: 'Houston Ship Channel', type: 'energy', lat: 29.72, lng: -95.08, country: 'USA', note: 'US energy export hub' },
  { id: 'en-rotterdam', name: 'Rotterdam Energy Hub', type: 'energy', lat: 51.95, lng: 4.08, country: 'Netherlands', note: 'European oil/LNG import' },
  { id: 'en-primorsk', name: 'Primorsk', type: 'energy', lat: 60.34, lng: 28.61, country: 'Russia', note: 'Baltic oil export' },
  { id: 'en-novorossiysk', name: 'Novorossiysk', type: 'energy', lat: 44.72, lng: 37.78, country: 'Russia', note: 'Black Sea oil export' },
  { id: 'en-ceyhan', name: 'Ceyhan Terminal', type: 'energy', lat: 36.87, lng: 35.93, country: 'Turkey', note: 'BTC pipeline terminal' },
  { id: 'en-sabetta', name: 'Sabetta (Yamal LNG)', type: 'energy', lat: 71.26, lng: 72.06, country: 'Russia', note: 'Arctic LNG export' },
  { id: 'en-jamnagar', name: 'Jamnagar Refinery', type: 'energy', lat: 22.34, lng: 69.85, country: 'India', note: "World's largest refinery (Reliance)" },
  { id: 'en-sikka', name: 'Sikka Terminal', type: 'energy', lat: 22.43, lng: 69.84, country: 'India', note: 'India crude import/export' },
];

export const infrastructure = () => INFRASTRUCTURE;
