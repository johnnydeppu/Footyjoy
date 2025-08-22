// /api/grab.js — 与えたURLのHTMLから {title, desc, text} を返す
export default async function handler(req, res) {
  try {
    const url = (req.query.url || "").toString();
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "invalid url" });
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      },
    });
    const html = await r.text();

    const pick = (re) => (html.match(re)?.[1] || html.match(re)?.[2] || "").trim();
    const title =
      pick(/<title[^>]*>([\s\S]*?)<\/title>/i) ||
      pick(/<meta[^>]+property=['"]og:title['"][^>]+content=['"]([^'"]+)['"]/i) ||
      pick(/<meta[^>]+name=['"]title['"][^>]+content=['"]([^'"]+)['"]/i);
    const desc =
      pick(/<meta[^>]+name=['"]description['"][^>]+content=['"]([^'"]+)['"]/i) ||
      pick(/<meta[^>]+property=['"]og:description['"][^>]+content=['"]([^'"]+)['"]/i);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120000);

    res.setHeader("content-type", "application/json; charset=utf-8");
    res.status(200).json({ title, desc, text });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
