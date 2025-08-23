// /api/inbox-list.js — KVの新着を読む
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const n = Math.max(1, Math.min(parseInt(String(req.query.n||"30"),10)||30, 100));
    const keys = await kv.zrange("inbox:sources", 0, n-1, { rev: true }); // 新しい順
    const items = [];
    for (const k of keys) {
      const v = await kv.get(k);
      const obj = typeof v === "string" ? JSON.parse(v) : v;
      if (obj) items.push(obj);
    }
    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
