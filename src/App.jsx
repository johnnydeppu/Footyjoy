import React, { useEffect, useMemo, useState } from "react";
import { matchHighlights } from "./lib/extract.js";

// FootyJoy — EPL Intel P1
// ・上部に「Intel / Matches」タブ
// ・Intel: 選手ウォッチ + URLをFetch → 選手名×辞書（怪我/復帰/好調）でハイライト抽出
// ・辞書は /public/config/*.json から fetch します

const LS_KEY = "footyjoy.v2"; // v2: Intel対応

const cn = (...c) => c.filter(Boolean).join(" ");
const uid = () => Math.random().toString(36).slice(2)+Date.now().toString(36);
function todayISO(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }

export default function App(){
  const [tab, setTab] = useState("intel"); // "intel" | "matches"

  // ==== Matches（最小のまま） ====
  const [{matches, tags}, setState] = useState(()=>{ try{ const raw=localStorage.getItem(LS_KEY); return raw? JSON.parse(raw): {matches:[], tags:["Premier League"]}; }catch{return {matches:[], tags:["Premier League"]}; });
  const [selectedId, setSelectedId] = useState(null);
  useEffect(()=> localStorage.setItem(LS_KEY, JSON.stringify({matches, tags})), [matches, tags]);

  const selected = useMemo(()=> matches.find(m=>m.id===selectedId)||null, [matches,selectedId]);
  function handleNewMatch(){ const m={ id:uid(), date:todayISO(), competition:"Premier League", homeTeam:"", awayTeam:"", rating:0, tags:[], thoughts:"", moments:[] }; setState(s=>({...s, matches:[m,...s.matches]})); setSelectedId(m.id); }
  function updateMatch(p){ setState(s=> ({...s, matches:s.matches.map(m=> m.id===selectedId? {...m, ...p}: m)})); }

  // ==== Intel（EPL） ====
  const [players, setPlayers] = useState([]);      // /public/config/players.json
  const [keywords, setKeywords] = useState({injury:[],returning:[],form:[]}); // /public/config/keywords.json
  const [roster, setRoster] = useState([]);        // ウォッチする表示名（自由入力）
  const [sources, setSources] = useState([]);      // 取得結果

  async function loadDictionaries(){
    const [kw, pl] = await Promise.all([
      fetch('/config/keywords.json').then(r=>r.json()),
      fetch('/config/players.json').then(r=>r.json())
    ]);
    setKeywords(kw); setPlayers(pl);
  }

  function addWatch(name){ const n=String(name||'').trim(); if(!n) return; if(!roster.includes(n)) setRoster(r=>[...r,n]); }
  function removeWatch(name){ setRoster(r=> r.filter(x=>x!==name)); }

  async function addSource(url){
    const u = normalizeUrl(url);
    try{
      const r = await fetch(`/api/grab?url=${encodeURIComponent(u)}`);
      if(!r.ok) throw new Error('fetch failed');
      const data = await r.json();
      const highlights = matchHighlights(data.text || `${data.title} ${data.desc}`, players, keywords);
      setSources(s=> [{ id:uid(), url:u, title:data.title||u, desc:data.desc||'', fetchedAt:Date.now(), highlights }, ...s]);
    }catch(e){ alert('取得に失敗: '+e.message); }
  }

  const insights = useMemo(()=>{
    const arr=[]; for(const s of sources){ for(const h of (s.highlights||[])){ if(!roster.length || roster.some(n=> eqName(n,h.player))){ arr.push({...h, url:s.url, title:s.title, ts:s.fetchedAt}); } } }
    return arr.sort((a,b)=> b.ts-a.ts);
  }, [sources, roster]);

  const watchPlayers = useMemo(()=> roster.map(n=> ({ name:n, facts: insights.filter(i=> eqName(i.player,n)).slice(0,3) })), [roster, insights]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-bold tracking-tight">⚽ FootyJoy <span className="text-slate-500 text-sm">EPL P1</span></div>
          <nav className="ml-2 rounded-full bg-slate-100 p-1 text-sm">
            <button onClick={()=>setTab('intel')} className={cn('px-3 py-1 rounded-full', tab==='intel'?'bg-white shadow':'hover:bg-white/60')}>Intel</button>
            <button onClick={()=>setTab('matches')} className={cn('px-3 py-1 rounded-full', tab==='matches'?'bg-white shadow':'hover:bg-white/60')}>Matches</button>
          </nav>
          {tab==='matches' && (<button onClick={handleNewMatch} className="ml-2 rounded-2xl bg-slate-900 text-white px-3 py-1.5 text-sm shadow">+ New match</button>)}
          {tab==='intel' && (
            <div className="ml-3 flex items-center gap-2 text-sm">
              <button onClick={loadDictionaries} className="rounded-xl border px-3 py-1.5 hover:bg-slate-100">Load EPL base</button>
              <span className="text-slate-500">players: {players.length||0}</span>
            </div>
          )}
        </div>
      </header>

      {tab==='intel' ? (
        <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Watch list */}
          <section className="lg:col-span-1">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Watch players</h2>
              <div className="mt-3 flex gap-2">
                <input id="watchName" placeholder="Saka / Haaland / 佐藤 など" className="flex-1 rounded-xl border px-3 py-1.5" onKeyDown={e=>{ if(e.key==='Enter'){ const n=e.currentTarget.value; addWatch(n); e.currentTarget.value=''; } }} />
                <button onClick={()=>{ const el=document.getElementById('watchName'); if(el?.value){ addWatch(el.value); el.value=''; } }} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-100">Add</button>
              </div>
              <div className="mt-4 space-y-2">
                {watchPlayers.map(p => (
                  <div key={p.name} className="rounded-2xl border p-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{p.name}</div>
                      <button onClick={()=>removeWatch(p.name)} className="text-xs text-slate-500 hover:text-red-600">Remove</button>
                    </div>
                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                      {p.facts.length? p.facts.map((f,idx)=>(
                        <div key={idx} className="line-clamp-2">• {f.sentence} <a href={f.url} target="_blank" className="text-slate-500 underline ml-1">src</a></div>
                      )): (<div className="text-slate-400">No facts yet</div>)}
                    </div>
                  </div>
                ))}
                {!watchPlayers.length && <div className="p-6 text-center text-slate-500 text-sm">まずは選手名を追加し、下のSourcesにURLを貼ってFetchしてください。</div>}
              </div>
            </div>
          </section>

          {/* Sources + Insights */}
          <section className="lg:col-span-2">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Sources</h2>
              <div className="mt-2 flex gap-2">
                <input id="srcUrl" placeholder="URL（BBC / Sky / クラブ公式 など）" className="flex-1 rounded-xl border px-3 py-1.5" onKeyDown={e=>{ if(e.key==='Enter'){ const u=e.currentTarget.value.trim(); if(u) addSource(u); e.currentTarget.value=''; }}} />
                <button onClick={()=>{ const el=document.getElementById('srcUrl'); const u=el?.value?.trim(); if(u){ addSource(u); el.value=''; } }} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-100">Fetch</button>
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
          {/* Matches — 既存MVPを簡略で残す */}
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
function normalize(s){ return (s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,''); }
function normalizeUrl(u){ try{ const url=new URL(u); return url.href; } catch{ if(/^https?:\/\//.test(u)) return u; return 'https://'+u; } }
