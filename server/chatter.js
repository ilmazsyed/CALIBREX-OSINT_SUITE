// Chatter tracker: analyse the social/community items already flowing through
// the feed (Reddit, Bluesky, Telegram, Mastodon — kind 'social') to surface
// trending terms, rising topics, the most active communities and a set of
// representative posts, and to compile a plain-language chatter report.
// Pure over a supplied item list; no extra network calls.

const STOP = new Set(('a an the of in on at to for from by with and or but is are was were be been being as that this these those it its into over under after before about amid amp says said say report reports reported new latest breaking how why what who whom will would could should may might can has have had not no nor than then them they their our your you we he she his her out up down off just now today live video watch via more most least very much many some any all one two three per vs re s t m'.split(' ')));
const SOCIAL = new Set(['social']);

function tokens(text) {
  return (String(text).toLowerCase().match(/[a-z0-9][a-z0-9'#-]{2,}/g) || [])
    .filter(w => !STOP.has(w) && !/^\d+$/.test(w));
}

/**
 * @param {Array} items feed snapshot items
 * @param {number} now  clock (injectable for tests)
 */
export function analyzeChatter(items, now = Date.now()) {
  const social = (items || []).filter(i => SOCIAL.has(i.kind)).sort((a, b) => b.published - a.published);
  const windowMs = 48 * 3600000;
  const recentMs = 12 * 3600000;
  const inWindow = social.filter(i => now - i.published <= windowMs);

  // Term frequencies, split into recent (<=12h) vs older, to flag momentum.
  const total = new Map(), recent = new Map();
  const bump = (m, w) => m.set(w, (m.get(w) || 0) + 1);
  for (const it of inWindow) {
    const isRecent = now - it.published <= recentMs;
    const seen = new Set(tokens(`${it.title} ${it.summary || ''}`)); // count each term once per post
    for (const w of seen) { bump(total, w); if (isRecent) bump(recent, w); }
  }
  const terms = [...total.entries()]
    .filter(([, c]) => c >= 3)
    .map(([term, count]) => {
      const r = recent.get(term) || 0;
      const recentShare = count ? r / count : 0;
      return { term, count, recent: r, rising: count >= 4 && recentShare >= 0.6 };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Most active communities / accounts.
  const bySource = new Map();
  for (const it of inWindow) bySource.set(it.source, (bySource.get(it.source) || 0) + 1);
  const sources = [...bySource.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15);

  // Hourly volume for the last 24h (oldest→newest) for a sparkline.
  const byHour = Array.from({ length: 24 }, (_, i) => {
    const hiEnd = now - (23 - i) * 3600000;
    return { t: hiEnd, count: inWindow.filter(x => x.published > hiEnd - 3600000 && x.published <= hiEnd).length };
  });

  const posts = inWindow.slice(0, 40).map(i => ({ id: i.id, title: i.title, url: i.url, source: i.source, wire: i.wire, published: i.published, severity: i.severity }));

  return { updatedAt: now, total: inWindow.length, recentCount: inWindow.filter(i => now - i.published <= recentMs).length, terms, sources, byHour, posts };
}

const fmt = ms => new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Compile a plain-language chatter report (no AI required). */
export function chatterReport(a, { title = 'Social Chatter Report' } = {}) {
  const rising = a.terms.filter(t => t.rising).slice(0, 8);
  const top = a.terms.slice(0, 12);
  const lines = [
    title.toUpperCase(),
    `Compiled ${fmt(a.updatedAt)} · ${a.total} social posts in the last 48h (${a.recentCount} in the last 12h) across ${a.sources.length} communities.`,
    '',
    'WHAT IS BEING TALKED ABOUT',
    top.length ? top.map(t => `- ${t.term} (${t.count} posts${t.rising ? ', rising' : ''})`).join('\n') : '- Not enough chatter in the window.',
    '',
    'RISING NOW (concentrated in the last 12 hours)',
    rising.length ? rising.map(t => `- ${t.term} (${t.recent} of ${t.count} posts are recent)`).join('\n') : '- No clearly rising topics.',
    '',
    'MOST ACTIVE COMMUNITIES',
    ...a.sources.slice(0, 8).map(s => `- ${s.name}: ${s.count} posts`),
    '',
    'REPRESENTATIVE POSTS',
    ...a.posts.slice(0, 15).map((p, i) => `${i + 1}. ${p.title} (${p.source}, ${fmt(p.published)})\n   ${p.url}`),
    '',
    'NOTE: Social chatter is unverified. Corroborate with independent reporting before publishing.',
  ];
  return lines.join('\n');
}
