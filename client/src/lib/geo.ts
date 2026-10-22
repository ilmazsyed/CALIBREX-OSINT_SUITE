// Optional, privacy-light device location. We store only a COARSE position
// (rounded to ~1km) in the browser, never on the server, and use it purely to
// centre the maps on the user's area and surface nearby signals first. The
// whole-world data never changes — this is sorting and centring only.
import { useEffect, useState } from 'react';

export interface UserGeo { lat: number; lng: number; ts: number }
const KEY = 'cx_geo';
const ASKED = 'cx_geo_asked';

export function getUserGeo(): UserGeo | null {
  try { const r = localStorage.getItem(KEY); if (!r) return null; const g = JSON.parse(r); if (typeof g?.lat === 'number' && typeof g?.lng === 'number') return g; } catch { /* */ }
  return null;
}
export function hasAskedGeo(): boolean { try { return localStorage.getItem(ASKED) === '1'; } catch { return false; } }
export function markAskedGeo(): void { try { localStorage.setItem(ASKED, '1'); } catch { /* */ } }
export function clearGeo(): void { try { localStorage.removeItem(KEY); } catch { /* */ } window.dispatchEvent(new CustomEvent('cx:geo', { detail: null })); }

/** Ask the browser for location (shows the OS permission prompt). Resolves to
    the coarse position, or null if denied/unavailable. */
export function requestGeo(): Promise<UserGeo | null> {
  markAskedGeo();
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const g: UserGeo = { lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100, ts: Date.now() };
        try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* */ }
        window.dispatchEvent(new CustomEvent('cx:geo', { detail: g }));
        resolve(g);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60000 },
    );
  });
}

/** Live hook — re-renders when the stored location changes. */
export function useUserGeo(): UserGeo | null {
  const [g, setG] = useState<UserGeo | null>(getUserGeo);
  useEffect(() => { const h = () => setG(getUserGeo()); window.addEventListener('cx:geo', h); return () => window.removeEventListener('cx:geo', h); }, []);
  return g;
}
