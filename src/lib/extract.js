// /src/lib/extract.js — 文分割＆ハイライト抽出（UI/Cronで共用できる純粋関数）


export function splitSentences(text) {
if (!text) return [];
const parts = text.replace(/\s+/g, ' ').split(/(?<=[\.!?。！？])\s+/);
return parts.map(s => s.trim()).filter(Boolean);
}


export function normalizeStr(s) {
return (s || '')
.toLowerCase()
.normalize('NFKD')
.replace(/[\u0300-\u036f]/g, '') // ダイアクリティカル除去（Ø→O 等）
.replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf\s-]/g, '');
}


export function buildPlayerIndex(players) {
// name->player のルックアップ用マップを作る（alt含む）
const index = new Map();
for (const p of players || []) {
const names = [p.name_en, p.name_local, ...(p.alt || [])].filter(Boolean);
for (const n of names) {
index.set(normalizeStr(n), p);
}
}
return index;
}


export function matchHighlights(text, players, keywords) {
const sentences = splitSentences(text).slice(0, 400);
const idx = buildPlayerIndex(players);
const K = {
injury: new Set((keywords?.injury || []).map(normalizeStr)),
returning: new Set((keywords?.returning || []).map(normalizeStr)),
form: new Set((keywords?.form || []).map(normalizeStr)),
};


const out = [];
for (const raw of sentences) {
const sNorm = normalizeStr(raw);


// 文章に含まれる可能性のある“単語”を列挙（速度優先の簡易）
const tokens = new Set(sNorm.split(/\s+/).filter(Boolean));


// まずキーワードが含まれるかを先に見る（高速化）
const hasInjury = [...K.injury].some(k => sNorm.includes(k));
const hasReturning = [...K.returning].some(k => sNorm.includes(k));
const hasForm = [...K.form].some(k => sNorm.includes(k));
if (!hasInjury && !hasReturning && !hasForm) continue;


// プレイヤー照合（indexのキーと部分一致: 単語境界に近い簡易一致）
for (const [key, player] of idx.entries()) {
if (!key) continue;
if (sNorm.includes(key)) {
const kind = hasInjury ? 'injury' : hasReturning ? 'returning' : 'form';
out.push({ player: player.name_en || key, kind, sentence: raw.trim() });
}
}
}


// 重複排除
const dedup = [];
for (const h of out) {
if (!dedup.some(x => x.player === h.player && x.kind === h.kind && x.sentence === h.sentence)) dedup.push(h);
}
return dedup.slice(0, 50);
}
