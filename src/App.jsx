import React, { useEffect, useMemo, useRef, useState } from "react";
<button onClick={()=>{ const el=document.getElementById('srcUrl'); const u=el?.value?.trim(); if(u){ addSource(normalizeUrl(u)); el.value=''; } }} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-100">Fetch</button>
</div>
<div className="mt-2 text-xs text-slate-500">※ Xや一部サイトは本文を取得できない場合があります（その時はタイトル/メタのみ）。</div>


<div className="mt-4 grid grid-cols-1 gap-3">
{sources.map(s => (
<article key={s.id} className="rounded-2xl border p-3">
<div className="flex items-start justify-between gap-3">
<div>
<a href={s.url} target="_blank" className="font-medium underline">{s.title}</a>
<div className="text-xs text-slate-500 line-clamp-2">{s.desc}</div>
</div>
<div className="text-xs text-slate-400">{new Date(s.fetchedAt).toLocaleString()}</div>
</div>
{s.highlights?.length ? (
<div className="mt-2 flex flex-wrap gap-1.5">
{s.highlights.map((h,idx)=> (
<span key={idx} className={cn('rounded-full px-2 py-0.5 text-xs border', h.kind==='injury'?"bg-red-50 border-red-400 text-red-700": h.kind==='returning'?"bg-amber-50 border-amber-400 text-amber-700":"bg-green-50 border-green-400 text-green-700")}>{h.player}: {h.kind}</span>
))}
</div>
) : (<div className="mt-2 text-xs text-slate-500">自動ハイライトは見つかりませんでした。</div>)}
</article>
))}
{!sources.length && <div className="p-8 text-center text-slate-500 text-sm">気になる記事のURLを貼って <b>Fetch</b> を押すと、選手名＋怪我/復帰/好調ワードを含む文を抽出します。</div>}
</div>
</div>


<div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
<h2 className="text-lg font-semibold">Insights</h2>
<div className="mt-2 space-y-2">
{insights.map((i,idx)=> (
<div key={idx} className="rounded-xl border p-2 text-sm">
<div className="flex items-center justify-between">
<div><b>{i.player}</b> — <span className={cn('px-1.5 py-0.5 rounded text-xs', i.kind==='injury'?"bg-red-50 text-red-700": i.kind==='returning'?"bg-amber-50 text-amber-700":"bg-green-50 text-green-700")}>{i.kind}</span></div>
<a href={i.url} target="_blank" className="text-xs text-slate-500 underline">source</a>
</div>
<div className="mt-1">{i.sentence}</div>
</div>
))}
{!insights.length && <div className="p-6 text-center text-slate-500 text-sm">まだインサイトがありません。URLを貼って情報を集約しましょう。</div>}
</div>
</div>
</section>
</main>
) : (
<main className="mx-auto max-w-7xl px-4 py-6">
{/* Matches — 既存MVPを簡略で残す（必要最小限） */}
<div className="rounded-3xl bg-white p-4 shadow-sm">
<div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Matches</h2><button onClick={handleNewMatch} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-100">+ New</button></div>
<div className="mt-4 space-y-3">
{matches.map(m => (
<article key={m.id} className={cn('rounded-2xl border p-3', selectedId===m.id && 'bg-slate-50')}
onClick={()=>setSelectedId(m.id)}>
<div className="text-xs text-slate-500">{m.date} — {m.competition}</div>
<div className="font-semibold">{m.homeTeam||'(home)'} <span className="text-slate-400">vs</span> {m.awayTeam||'(away)'} <span className="ml-2 text-slate-500">{m.rating??0}</span></div>
{!!(selectedId===m.id) && (
<div className="mt-2 grid grid-cols-2 gap-2">
<input value={m.homeTeam} onChange={e=>updateMatch({homeTeam:e.target.value})} className="rounded-xl border px-2 py-1" placeholder="Home"/>
<input value={m.awayTeam} onChange={e=>updateMatch({awayTeam:e.target.value})} className="rounded-xl border px-2 py-1" placeholder="Away"/>
<textarea value={m.thoughts} onChange={e=>updateMatch({thoughts:e.target.value})} rows={3} className="col-span-2 rounded-xl border px-2 py-1" placeholder="One-line memo"/>
</div>
)}
</article>
))}
{!matches.length && <div className="p-6 text-center text-slate-500 text-sm">一言メモはここに残せます（詳細ログは後回し）。</div>}
</div>
</div>
</main>
)}


<footer className="py-8 text-center text-xs text-slate-400">EPL Intel P1 — Built with ❤️</footer>
</div>
);
}


function eqName(a,b){ return normalize(a)===normalize(b); }
function normalize(s){ return (s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,''); }
function normalizeUrl(u){ try{ const url=new URL(u); return url.href; } catch{ if(/^https?:\/\//.test(u)) return u; return 'https://'+u; } }
