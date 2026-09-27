import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2, BookOpen, AlertTriangle, Copy } from 'lucide-react';
import { readArticle, Article, ReadTarget, timeAgo } from '../lib/live';
import { copyText } from '../lib/api';
import AiAssist from './AiAssist';

/** In-app reader: fetches the full story through the server and shows its text. */
const ArticleReader: React.FC = () => {
  const [target, setTarget] = useState<ReadTarget | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const open = (e: Event) => setTarget((e as CustomEvent).detail);
    window.addEventListener('cx:read', open);
    return () => window.removeEventListener('cx:read', open);
  }, []);

  useEffect(() => {
    if (!target) return;
    let alive = true;
    setArticle(null); setError(null); setLoading(true);
    readArticle(target.url)
      .then(a => alive && setArticle(a))
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTarget(null); };
    document.addEventListener('keydown', esc);
    return () => { alive = false; document.removeEventListener('keydown', esc); };
  }, [target]);

  if (!target) return null;
  const social = target.kind === 'social';
  const link = article?.url || target.url;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 flex justify-end" onClick={() => setTarget(null)}>
      <aside role="dialog" aria-modal="true" aria-label="Article reader" onClick={e => e.stopPropagation()} className="w-full max-w-2xl h-full bg-[#0a1420] border-l border-white/10 flex flex-col shadow-2xl">
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10">
          <span className="text-sm font-bold text-calibrex-teal flex items-center gap-2"><BookOpen size={16} /> Reader</span>
          <div className="flex items-center gap-1">
            {article && <button onClick={() => copyText(`${article.title}\n${link}\n\n${article.text}`).then(ok => { setCopied(ok); setTimeout(() => setCopied(false), 1500); })} className="p-2 text-calibrex-muted hover:text-white" title="Copy article text">{copied ? <span className="text-xs">Copied</span> : <Copy size={16} />}</button>}
            <a href={link} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 hover:border-calibrex-teal" title="Open on the publisher's site">Open original <ExternalLink size={13} /></a>
            <button id="reader-close" onClick={() => setTarget(null)} className="p-2 text-calibrex-muted hover:text-white" aria-label="Close reader"><X size={18} /></button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-8 py-6">
          <div className="text-xs text-calibrex-muted mb-2 flex flex-wrap gap-x-2">
            <span className="text-calibrex-teal font-bold">{article?.siteName || target.source}</span>
            {(article?.published || target.published) && <span>{new Date((article?.published || target.published)!).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {timeAgo((article?.published || target.published)!)}</span>}
            {article?.byline && <span>· {article.byline}</span>}
            {article && <span>· {article.words.toLocaleString()} words</span>}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-4">{article?.title || target.title}</h1>
          {social && <div className="mb-4 p-3 rounded border border-calibrex-medium/40 bg-calibrex-medium/10 text-sm text-calibrex-medium">Social media post. Treat it as an unverified claim until news outlets or official sources confirm it.</div>}

          {loading && <div className="py-16 flex items-center justify-center gap-2 text-calibrex-teal text-sm"><Loader2 size={16} className="animate-spin" /> Fetching the full article…</div>}
          {error && (
            <div className="p-4 rounded border border-calibrex-high/40 bg-calibrex-high/10 text-sm text-calibrex-high flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {article && (
            <>
              <AiAssist key={article.url} task="article" label="Summarise article with AI" className="mb-5" getInput={() => ({ title: article.title, source: article.siteName, url: article.url, text: article.text })} />
              <div className="space-y-4 text-[15px] leading-relaxed text-calibrex-text">
                {article.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <p className="mt-8 pt-4 border-t border-white/10 text-xs text-calibrex-muted">Text extracted automatically from {article.siteName}. Layout, images and some passages may be missing; the original is the reference.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default ArticleReader;
