import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { can, currentUser } from "../auth.js";
import { getDb } from "../db.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/* GET /api/finance → {entries, rate} (صلاحية fin_view أو fin_edit) · POST {entries, rate} → حفظ كامل (صلاحية fin_edit) */
export default async function finance(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const me = await currentUser(req, res);
  if (!me) return res.status(401).json({ ok: false });
  const db = await getDb();

  if (req.method === "GET") {
    if (!can(me, "fin_view") && !can(me, "fin_edit")) return res.status(403).json({ ok: false, error: "forbidden" });
    const r = (await db.query("SELECT entries, rate::float8 AS rate FROM entilaaqa.finance WHERE id = 1")).rows[0];
    return res.json({ ok: true, entries: r?.entries ?? [], rate: r?.rate ?? 1500 });
  }

  if (req.method === "POST") {
    if (!can(me, "fin_edit")) return res.status(403).json({ ok: false, error: "forbidden" });
    const b = req.body ?? {};
    const rate = Number(b.rate);
    const bad = () => res.status(400).json({ ok: false, error: "invalid_input" });
    if (!Array.isArray(b.entries) || !(rate > 0) || rate > 1e7) return bad();
    const entries = [];
    for (const e of b.entries.slice(0, 20000)) {
      const amount = Number(e?.amount);
      if (!e || !DATE.test(String(e.date)) || (e.type !== "income" && e.type !== "expense") || !(amount > 0) || !Number.isFinite(amount)) continue;
      entries.push({
        id: String(e.id || "").slice(0, 40) || randomUUID(),
        date: String(e.date), type: e.type, category: String(e.category || "أخرى").slice(0, 60), amount,
        currency: e.currency === "IQD" ? "IQD" : "USD", project: e.project ? String(e.project).slice(0, 40) : "", note: String(e.note || "").slice(0, 300),
      });
    }
    await db.query(
      "INSERT INTO entilaaqa.finance (id, entries, rate, updated_at) VALUES (1, $1::jsonb, $2, now()) ON CONFLICT (id) DO UPDATE SET entries = EXCLUDED.entries, rate = EXCLUDED.rate, updated_at = now()",
      [JSON.stringify(entries), rate],
    );
    return res.json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "method_not_allowed" });
}
