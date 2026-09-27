/** Visual intel: photos, video and satellite imagery for stories. */
import { api } from './api';
import type { Severity, WireKey } from './live';

export type Media =
  | { type: 'image'; src: string; alt?: string }
  | { type: 'video'; src: string; poster?: string | null }
  | { type: 'embed'; src: string; poster?: string | null; href?: string }
  | { type: 'external-video'; poster: string | null; href: string };
export interface MediaFrom { title: string; source: string; url: string; published?: number | null; kind?: string }
export type CollectedMedia = Media & { from: MediaFrom };

export interface SatellitePanel { id: string; label: string; date: string | null; src: string; note: string }
export interface SatelliteView { place: string; lat: number; lng: number; panels: SatellitePanel[]; links: { label: string; url: string }[]; precision: string }

export interface VisualStory { id: string; title: string; url: string; source: string; kind: string; published: number; severity: Severity; wire: WireKey; place: string | null; media: Media[] }

/** What a "Visual intel" button asks for. */
export interface VisualTarget {
  title: string;
  urls: string[];
  lat?: number;
  lng?: number;
  place?: string;
  severity?: string;
  preload?: CollectedMedia[];
}

/** All pictures go through the server's media proxy. */
export const proxied = (src?: string | null) => (src ? `/api/media?u=${encodeURIComponent(src)}` : '');
export const mediaThumb = (m: Media) => (m.type === 'image' ? m.src : m.poster || null);

export const visuals = {
  feed: () => api<{ updatedAt: number | null; stories: VisualStory[]; satellite: (SatelliteView & { threatId: string; title: string; severity: Severity })[] }>('/visuals'),
  collect: (t: VisualTarget) => api<{ title: string; media: CollectedMedia[]; satellite: SatelliteView | null; searched: number; collectedAt: number }>('/visuals/collect', {
    body: { title: t.title, urls: t.urls, lat: t.lat, lng: t.lng, place: t.place },
  }),
};

/** Open the visual collection for a story, alert or threat from anywhere. */
export const openVisuals = (t: VisualTarget) => window.dispatchEvent(new CustomEvent('cx:visuals', { detail: t }));
