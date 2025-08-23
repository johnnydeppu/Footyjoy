// /api/cron/ingest-epl.js — 10分おきにRSSを走査して新着をKVに保存
import { kv } from "@vercel/kv";

const FEEDS = [
  "https://feeds.bbci.co.uk/sport/football/rss.xml",
  "https://www.skysports.com/rss/12040",
  "https://www.arsenal.com/rss",
  "https://www.mancity.com/news.rss"
];

export default async function handler(req, res) {
  try {
    const limit = clampInt(req.query.limit, 40, 10, 200);
    const [players, keywords] = await Promise.all([
      fetchJson("/public/config/players.json"),
      fetchJson("/public/config/keywords.json"),
    ]);

    // 1) RSS→URL一覧
    const urls = await collectFeedUrls(FEEDS);
    const uniq = Array.from(new Set(urls)).slice(0, limit);

    // 2) 各記事を取得→抽出→新規だけ保存
    const now = Date.now();
    let saved = 0;
    for (const url of uniq) {
      const key = "src:" + b64(url);
      const exists = await kv.get(key);
      if (exists) continue;

      const html = await fetch(url, { headers: UA }).then(r => r.text());
      const title = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || "";
      const desc  = pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                    pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || "";
      const text  = strip(html).slice(0, 120000);

      const highlights = matchHighlights(text || `${title} ${desc}`, players, keywords);
      if (!highlights.length) continue;

      const source = { id: key, url, title, desc, fetchedAt: now, highlights };
      await kv.set(key, source);
      await kv.zadd("inbox:sources", { score: now, member: key });
      saved++;
    }

    res.status(200).json({ ok: true, saved });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}

// ---- helpers ----
const UA = { "user-agent": "Mozilla/5.0 Chrome/120 Safari/537.36" };
const clampInt = (v, d, min, max) => Math.max(min, Math.min(max, parseInt(String(v||d),10)||d));
const b64 = s => Buffer.from(s).toString("base64").replace(/=+$/,"");

async function fetchJson(relPath) {
  // Vercelの関数実行環境ではリポジトリのpublicに相対アクセスできないため、HTTPで取得
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const r = await fetch(base + relPath);
  return r.json();
}

async function collectFeedUrls(feeds) {
  const urls = [];
  for (const rss of feeds) {
    try {
      const xml = await fetch(rss, { headers: UA }).then(r => r.text());
      for (const m of xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/gi)) urls.push(m[1]);
      for (const m of xml.matchAll(/<entry>[\s\S]*?<link[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<\/entry>/gi)) urls.push(m[1]);
    } catch {}
  }
  return urls;
}

const strip = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/gi," ")
      .replace(/<style[\s\S]*?<\/style>/gi," ")
      .replace(/<[^>]+>/g," ")
      .replace(/\s+/g," ")
      .trim();
const pick = (html, re) => { const m = html.match(re); return m ? (m[1] || m[2] || "").trim() : ""; };

// ---- 抽出ロジック（クライアントと同等）
function splitSentences(text){ if(!text) return []; return String(text).replace(/\s+/g," ").split(/(?<=[\.!?。！？])\s+/).map(s=>s.trim()).filter(Boolean); }
function normalizeStr(s){ return (s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf\s-]/g,""); }
function buildPlayerIndex(players){ const idx=new Map(); for(const p of players||[]){ const names=[p.name_en,p.name_local,...(p.alt||[])].filter(Boolean); for(const n of names){ idx.set(normalizeStr(n), p); } } return idx; }
function matchHighlights(text, players, keywords){
  const sentences = splitSentences(text).slice(0,400);
  const idx = buildPlayerIndex(players);
  const K = {
    injury:    new Set((keywords?.injury    || []).map(normalizeStr)),
    returning: new Set((keywords?.returning || []).map(normalizeStr)),
    form:      new Set((keywords?.form      || []).map(normalizeStr)),
  };
  const out=[];
  for(const raw of sentences){
    const s = normalizeStr(raw);
    const inj=[...K.injury].some(k=>s.includes(k));
    const ret=[...K.returning].some(k=>s.includes(k));
    const frm=[...K.form].some(k=>s.includes(k));
    if(!inj && !ret && !frm) continue;
    for(const [key,p] of idx.entries()){
      if(key && s.includes(key)){
        out.push({ player: p.name_en || key, kind: inj? "injury" : ret? "returning" : "form", sentence: raw.trim() });
      }
    }
  }
  // dedup
  const ded=[]; for(const h of out){ if(!ded.some(x=>x.player===h.player && x.kind===h.kind && x.sentence===h.sentence)) ded.push(h); }
  return ded.slice(0,50);
}
