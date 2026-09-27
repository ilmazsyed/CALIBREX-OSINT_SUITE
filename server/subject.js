// Phase 3 (subject lookups) — OFF BY DEFAULT, gated, audited.
// Deliberately built to stay on the safe side of the line:
//   - Phone numbers: offline validation only (country, type, carrier region).
//     No owner name, no private data — libphonenumber metadata only.
//   - Usernames: LINK GENERATION, not active scanning. Calibrex builds the
//     profile URLs; the analyst opens the ones they choose. Calibrex does not
//     fire hundreds of automated requests at platforms.
// There is intentionally no owner-identification, breach-password, or
// account-mapping capability here.
import { parsePhoneNumberFromString, getExampleNumber } from 'libphonenumber-js';

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{1,30})[A-Za-z0-9]$/;

/** Offline phone metadata. Never returns an owner or any private data. */
export function phoneLookup(raw, defaultCountry) {
  const input = String(raw || '').trim();
  const p = parsePhoneNumberFromString(input, defaultCountry || undefined);
  if (!p) return { ok: false, error: 'That does not look like a phone number. Include the country code, e.g. +91 98xxxxxxxx.' };
  const e164 = p.number;
  const national = p.formatNational();
  const type = p.getType() || 'unknown';
  const searchLinks = [
    { label: 'Google (exact number)', url: `https://www.google.com/search?q=${encodeURIComponent('"' + e164 + '" OR "' + national + '"')}` },
    { label: 'Truecaller', url: `https://www.truecaller.com/search/${(p.country || 'in').toLowerCase()}/${encodeURIComponent(p.nationalNumber)}` },
    { label: 'WhatsApp (is it registered)', url: `https://wa.me/${e164.replace('+', '')}` },
    { label: 'Sync.me', url: `https://sync.me/search/?number=${encodeURIComponent(e164)}` },
  ];
  return {
    ok: true,
    e164, national, international: p.formatInternational(),
    valid: p.isValid(),
    possible: p.isPossible(),
    country: p.country || null,
    countryCallingCode: '+' + p.countryCallingCode,
    type, // mobile / fixed_line / voip / toll_free / etc.
    carrierNote: 'Number ranges are assigned to operators, but numbers are portable in most countries, so the original operator is not shown. This tool gives country and line type only.',
    searchLinks,
  };
}

// Public profile-URL patterns. {u} is the username. Kept to sites with a
// stable public profile URL; the analyst opens and judges each one.
const PLATFORMS = [
  ['GitHub', 'https://github.com/{u}', 'dev'],
  ['GitLab', 'https://gitlab.com/{u}', 'dev'],
  ['X (Twitter)', 'https://x.com/{u}', 'social'],
  ['Instagram', 'https://www.instagram.com/{u}/', 'social'],
  ['Facebook', 'https://www.facebook.com/{u}', 'social'],
  ['TikTok', 'https://www.tiktok.com/@{u}', 'social'],
  ['YouTube', 'https://www.youtube.com/@{u}', 'social'],
  ['Reddit', 'https://www.reddit.com/user/{u}', 'social'],
  ['Telegram', 'https://t.me/{u}', 'messaging'],
  ['Bluesky', 'https://bsky.app/profile/{u}.bsky.social', 'social'],
  ['Mastodon (mastodon.social)', 'https://mastodon.social/@{u}', 'social'],
  ['Threads', 'https://www.threads.net/@{u}', 'social'],
  ['LinkedIn', 'https://www.linkedin.com/in/{u}', 'professional'],
  ['Pinterest', 'https://www.pinterest.com/{u}/', 'social'],
  ['Twitch', 'https://www.twitch.tv/{u}', 'streaming'],
  ['Steam', 'https://steamcommunity.com/id/{u}', 'gaming'],
  ['Medium', 'https://medium.com/@{u}', 'blog'],
  ['Substack', 'https://{u}.substack.com', 'blog'],
  ['Keybase', 'https://keybase.io/{u}', 'dev'],
  ['VK', 'https://vk.com/{u}', 'social'],
  ['SoundCloud', 'https://soundcloud.com/{u}', 'audio'],
  ['Patreon', 'https://www.patreon.com/{u}', 'social'],
  ['Vimeo', 'https://vimeo.com/{u}', 'video'],
  ['DeviantArt', 'https://www.deviantart.com/{u}', 'art'],
  ['Flickr', 'https://www.flickr.com/people/{u}', 'photo'],
];

/**
 * Build candidate profile links for a username. No network requests are made:
 * the analyst opens the links and confirms which are the same person. A shared
 * username is NOT evidence of a shared identity, and the result says so.
 */
export function usernameLinks(raw) {
  const u = String(raw || '').trim().replace(/^@/, '');
  if (!USERNAME_RE.test(u)) return { ok: false, error: 'Enter a username of 3–32 characters (letters, numbers, dot, dash, underscore).' };
  return {
    ok: true,
    username: u,
    profiles: PLATFORMS.map(([name, pattern, category]) => ({ name, category, url: pattern.replace('{u}', encodeURIComponent(u)) })),
    aggregators: [
      { label: 'WhatsMyName (checks many sites live)', url: `https://whatsmyname.app/?q=${encodeURIComponent(u)}` },
      { label: 'Google (exact username)', url: `https://www.google.com/search?q=${encodeURIComponent('"' + u + '"')}` },
    ],
    caution: 'These are candidate profiles, not confirmed matches. The same username is often used by different, unrelated people. Open each link and verify before drawing any conclusion.',
  };
}

export const PLATFORM_COUNT = PLATFORMS.length;
