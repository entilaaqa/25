import type { Request, Response } from "express";
import { can, currentUser } from "../auth.js";
import { getDb } from "../db.js";

const PLATFORMS = ["facebook", "instagram", "x", "linkedin", "tiktok", "youtube"];

async function guard(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const me = await currentUser(req, res);
  if (!me) { res.status(401).json({ ok: false }); return null; }
  if (!can(me, "marketing")) { res.status(403).json({ ok: false, error: "forbidden" }); return null; }
  return me;
}

/* GET /api/social → {accounts} · DELETE {platform} → فصل الحساب */
export async function social(req: Request, res: Response) {
  if (!(await guard(req, res))) return;
  const db = await getDb();
  if (req.method === "GET") {
    const { rows } = await db.query("SELECT platform, name, connected_at FROM entilaaqa.social_accounts ORDER BY platform");
    return res.json({ ok: true, accounts: rows, available: [] }); // أضف هنا المنصات التي رُبط لها مزوّد OAuth ونشر فعلي
  }
  if (req.method === "DELETE") {
    const p = String(req.body?.platform ?? "");
    if (!PLATFORMS.includes(p)) return res.status(400).json({ ok: false, error: "invalid_input" });
    await db.query("DELETE FROM entilaaqa.social_accounts WHERE platform = $1", [p]);
    return res.json({ ok: true });
  }
  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ ok: false, error: "method_not_allowed" });
}

/* GET /api/social/connect?platform=x → {url} رابط OAuth. يحتاج تطبيق مطوّر ومفاتيحه لكل منصة، وهي غير مضبوطة بعد. */
export async function socialConnect(req: Request, res: Response) {
  if (!(await guard(req, res))) return;
  const p = String(req.query.platform ?? "");
  if (!PLATFORMS.includes(p)) return res.status(400).json({ ok: false, error: "invalid_input" });
  return res.status(501).json({ ok: false, error: "not_configured" });
}

/* POST /api/social/publish (multipart) → نشر على منصة واحدة. يتطلب حساباً مربوطاً ومزوّد نشر للمنصة. */
export async function socialPublish(req: Request, res: Response) {
  if (!(await guard(req, res))) return;
  req.resume(); // نستهلك الجسم حتى لا ينقطع الاتصال عند رفع ملف كبير
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  const p = String(req.query.platform ?? "");
  const db = await getDb();
  const connected = p ? (await db.query("SELECT 1 FROM entilaaqa.social_accounts WHERE platform = $1", [p])).rowCount : 0;
  if (!connected) return res.status(409).json({ ok: false, error: "not_connected" });
  return res.status(501).json({ ok: false, error: "not_configured" });
}
