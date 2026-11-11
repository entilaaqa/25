import type { Request, Response } from "express";
import { can, currentUser, destroySession } from "../auth.js";
import { getDb } from "../db.js";

const STATUSES = ["new", "contacted", "scheduled", "won", "lost"];
const COLS = "id,created_at,language,name,whatsapp,email,current_status,current_status_code,main_goal,biggest_challenge,monthly_income,monthly_income_code,ready_to_invest,ready_to_invest_code,session_start,session_tz,page_url,referrer,utm,country,lead_status,notes";

/*
  GET  /api/me             → المستخدم الحالي
  GET  /api/me?bookings=1  → الحجوزات
  POST /api/me?update=1    → تحديث حالة/ملاحظات عميل
  POST /api/me             → تسجيل الخروج
  DELETE /api/me {id}      → حذف عميل نهائياً (للمدير فقط)
*/
export default async function me(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (req.method === "POST" && req.query.update === undefined) {
    await destroySession(req, res);
    return res.status(200).json({ ok: true });
  }

  let user;
  try { user = await currentUser(req, res); } catch (e) {
    console.error("me: database unavailable", (e as Error).message);
    return res.status(503).json({ ok: false, error: "db" });
  }
  if (!user) return res.status(401).json({ ok: false });

  // الدور admin: كل الصلاحيات. الدور team: عرض + متابعة العملاء بدون تصدير وبدون إدارة المستخدمين.
  if (req.method === "GET" && req.query.bookings === undefined) {
    return res.status(200).json({ ok: true, email: user.email, role: user.role, isAdmin: user.isAdmin, isClient: user.role === "client", booking_id: user.bookingId, perms: user.perms, canView: true });
  }
  const db = await getDb();

  if (req.method === "DELETE") {
    // الحذف نهائي، لذلك هو للمدير فقط (فريق العمل يتابع العملاء ولا يحذفهم).
    if (!user.isAdmin) return res.status(403).json({ ok: false, error: "forbidden" });
    const id = Number((req.body ?? {}).id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "invalid_input" });
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      // حساب العميل (دوره client) مرتبط بهذا الحجز فقط ولا قيمة له بعد حذفه؛ جلساته تُحذف تلقائياً (ON DELETE CASCADE).
      await c.query("DELETE FROM entilaaqa.users WHERE role = 'client' AND booking_id = $1", [id]);
      // العقود تبقى محفوظة (فيها اسم العميل وبياناته) ونفكّ ارتباطها بالحجز المحذوف فقط.
      await c.query("UPDATE entilaaqa.contracts SET booking_id = NULL WHERE booking_id = $1", [id]);
      const r = await c.query("DELETE FROM entilaaqa.bookings WHERE id = $1", [id]);
      if (!r.rowCount) {
        await c.query("ROLLBACK");
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
    return res.status(200).json({ ok: true, deleted: id });
  }

  if (req.method === "POST") {
    if (user.role === "client" || !can(user, "update")) return res.status(403).json({ ok: false, error: "forbidden" });
    const b = req.body ?? {};
    const id = Number(b.id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (b.lead_status !== undefined) {
      if (!STATUSES.includes(b.lead_status)) return res.status(400).json({ ok: false, error: "invalid_input" });
      vals.push(b.lead_status); sets.push(`lead_status = $${vals.length}`);
    }
    if (b.notes !== undefined) { vals.push(String(b.notes).slice(0, 2000)); sets.push(`notes = $${vals.length}`); }
    if (!Number.isInteger(id) || !sets.length) return res.status(400).json({ ok: false, error: "invalid_input" });
    vals.push(id);
    const r = await db.query(`UPDATE entilaaqa.bookings SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length}`, vals);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.status(200).json({ ok: true });
  }

  if (user.role === "client") {
    // العميل يرى حجزه فقط وبدون الملاحظات الداخلية.
    const own = await db.query(`SELECT ${COLS.replace(",notes", "")} FROM entilaaqa.bookings WHERE id = $1`, [user.bookingId]);
    return res.status(200).json({ ok: true, bookings: own.rows });
  }
  if (!can(user, "view")) return res.status(403).json({ ok: false, error: "forbidden" });
  const { rows } = await db.query(`SELECT ${COLS} FROM entilaaqa.bookings ORDER BY created_at DESC LIMIT 2000`);
  return res.status(200).json({ ok: true, bookings: rows, migrated: true });
}
