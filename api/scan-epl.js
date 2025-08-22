// /api/scan-epl.js  — EPL向けのRSSをまとめて走査してハイライト抽出（DB不要のオンデマンド）
import fs from "node:fs/promises";
import path from "node:path";

export default async function handler(req, res) {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "24"), 10), 60);

    // 1) 辞書を public/config から読む（P1で置いたやつ）
    const players = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "config", "players.json"), "utf-8"));
    const keywords = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "config", "keywords.json"), "utf-8"));

    // 2) EPL向けRSS（必要なら増やせます）
    const feeds = [
      "https://feeds.bbci.co.uk/sport/football/rss.xml",
      "https://www.skysports.com/rss/12040",
      "https://www.arsenal.com/rss",
      "https://www.mancity.com/news.rss"
    ];

    // 3) RSS → 記事URL抽出
    const urls = [];
    for (const rss of feeds) {
      try {
        const xml = await fetch(rss, { headers: ua() }).then(r => r.text());
        // RSS
        for (const m of xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/gi)) urls.push(m[1]);
        // Atom
        for (const m of xml.matchAll(/<entry>[\s\S]*?<link[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<\/entry>/gi)) urls.push(m[1]);
      } catch {}
    }
    const uniq = Array.from(new Set(urls)).slice(0, limit);

    // 4) 各記事を取得 → ハイライト抽出
    const now = Date.now();
    const sources = [];
    for (const url of uniq) {
      try {
        const html = await fetch(url, { headers: ua() }).then(r => r.text());
        const title = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || "";
        const desc  = pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || "";
        const text  = strip(html).slice(0, 120000);

        const highlights = matchHighlights(text || `${title} ${desc}`, players, keywords);
        if (highlights.length) {
          sources.push({ id: b64(url), url, title, desc, fetchedAt: now, highlights });
        }
      } catch {}
    }

    res.setHeader("content-type", "application/json; charset=utf-8");
    res.status(200).json({ sources, count: sources.length });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}

// ------- utils
const ua = () => ({ "user-agent": "Mozilla/5.0 Chrome/120 Safari/537.36" });
const b64 = s => Buffer.from(s).toString("base64").replace(/=+$/,"");
const strip = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/gi," ")
      .replace(/<style[\s\S]*?<\/style>/gi," ")
      .replace(/<[^>]+>/g," ")
      .replace(/\s+/g," ")
      .trim();
const pick = (html, re) => { const m = html.match(re); return m ? (m[1] || m[2] || "").trim() : ""; };

// ---- 抽出ロジック（クライアント側と同等）
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
