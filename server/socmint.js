// SOCMINT (social-media intelligence): cross-platform username presence and a
// public Reddit search. Uses public profile URLs and Reddit's public JSON — no
// login, no private data. A gated tool (see sensitive.js): presence is inferred
// from HTTP status, which can be wrong when a site blocks datacenter IPs, so
// every result is labelled yes / no / unknown — never treat it as proof.
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 9000;

// Each site: profile URL template and the status that means "no such user".
// Sites that soft-404 (return 200 for missing users) or hard-block bots are
// marked ambiguous and always reported as "unknown".
const SITES = [
  { name: 'GitHub', url: u => `https://github.com/${u}` },
  { name: 'GitLab', url: u => `https://gitlab.com/${u}` },
  { name: 'Reddit', url: u => `https://www.reddit.com/user/${u}/about.json` },
  { name: 'Telegram', url: u => `https://t.me/${u}`, ambiguous: true },
  { name: 'Keybase', url: u => `https://keybase.io/${u}` },
  { name: 'Dev.to', url: u => `https://dev.to/${u}` },
  { name: 'Medium', url: u => `https://medium.com/@${u}` },
  { name: 'HackerNews', url: u => `https://news.ycombinator.com/user?id=${u}`, ambiguous: true },
  { name: 'Pinterest', url: u => `https://www.pinterest.com/${u}/`, ambiguous: true },
  { name: 'Steam', url: u => `https://steamcommunity.com/id/${u}` },
  { name: 'TikTok', url: u => `https://www.tiktok.com/@${u}`, ambiguous: true },
  { name: 'YouTube', url: u => `https://www.youtube.com/@${u}`, ambiguous: true },
  { name: 'Instagram', url: u => `https://www.instagram.com/${u}/`, ambiguous: true },
];

const VALID_U = /^[A-Za-z0-9._-]{1,40}$/;

async function probe(site, u) {
  const url = site.url(u);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/json' } });
    const human = url.replace('/about.json', '');
    if (site.ambiguous) return { site: site.name, url: human, exists: 'unknown' };
    if (res.status === 200) return { site: site.name, url: human, exists: 'yes' };
    if (res.status === 404) return { site: site.name, url: human, exists: 'no' };
    return { site: site.name, url: human, exists: 'unknown' };
  } catch {
    return { site: site.name, url: url.replace('/about.json', ''), exists: 'unknown' };
  } finally { clearTimeout(t); }
}

export async function checkUsername(username) {
  const u = String(username || '').trim();
  if (!VALID_U.test(u)) return { username: u, valid: false, results: [] };
  const results = await Promise.all(SITES.map(s => probe(s, u)));
  return { username: u, valid: true, results, found: results.filter(r => r.exists === 'yes').length };
}

export async function redditSearch(query) {
  const q = String(query || '').trim().slice(0, 120);
  if (!q) return { query: q, posts: [] };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=25&sort=new`, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const posts = (json?.data?.children || []).map(c => c.data).filter(Boolean).map(d => ({
      title: String(d.title || '').slice(0, 300), subreddit: d.subreddit_name_prefixed || `r/${d.subreddit}`,
      author: `u/${d.author}`, url: d.permalink ? `https://www.reddit.com${d.permalink}` : d.url,
      created: (d.created_utc || 0) * 1000, score: d.score || 0, comments: d.num_comments || 0,
    }));
    return { query: q, posts };
  } finally { clearTimeout(t); }
}
