import { can, currentUser } from "../auth.js";
import { getDb } from "../db.js";
const ST = ["open", "won", "lost"];
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
/* GET قائمة · POST إنشاء/تحديث فورم (id اختياري) · PATCH {id,status} · DELETE {id} — صلاحية contracts */
export default async function contracts(req, res) {
    res.setHeader("Cache-Control", "no-store");
    const me = await currentUser(req, res);
    if (!me)
        return res.status(401).json({ ok: false });
    if (!can(me, "contracts"))
        return res.status(403).json({ ok: false, error: "forbidden" });
    const db = await getDb();
    const b = req.body ?? {};
    const bad = () => res.status(400).json({ ok: false, error: "invalid_input" });
    if (req.method === "GET") {
        const { rows } = await db.query("SELECT id, client_name, whatsapp, email, booking_id, status, price::float8 AS price, data, created_at, updated_at FROM entilaaqa.contracts ORDER BY updated_at DESC LIMIT 2000");
        return res.json({ ok: true, items: rows });
    }
    if (req.method === "POST") {
        const name = str(b.client_name, 120);
        const status = ST.includes(b.status) ? b.status : "open";
        const price = Number.isFinite(Number(b.price)) && Number(b.price) >= 0 ? Number(b.price) : 0;
        const data = b.data && typeof b.data === "object" && !Array.isArray(b.data) ? b.data : {};
        const booking = Number.isInteger(Number(b.booking_id)) && b.booking_id !== null && b.booking_id !== "" ? Number(b.booking_id) : null;
        if (!name)
            return bad();
        const vals = [name, str(b.whatsapp, 40), str(b.email, 254), booking, status, price, JSON.stringify(data)];
        if (b.id !== undefined && b.id !== null) {
            const id = Number(b.id);
            if (!Number.isInteger(id))
                return bad();
            const r = await db.query("UPDATE entilaaqa.contracts SET client_name=$1, whatsapp=$2, email=$3, booking_id=$4, status=$5, price=$6, data=$7::jsonb, updated_at=now() WHERE id=$8", [...vals, id]);
            if (!r.rowCount)
                return res.status(404).json({ ok: false, error: "not_found" });
            return res.json({ ok: true, id });
        }
        const r = await db.query("INSERT INTO entilaaqa.contracts (client_name, whatsapp, email, booking_id, status, price, data) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id", vals);
        return res.status(201).json({ ok: true, id: r.rows[0].id });
    }
    const id = Number(b.id ?? req.query.id);
    if (!Number.isInteger(id))
        return bad();
    if (req.method === "PATCH") {
        if (!ST.includes(b.status))
            return bad();
        const r = await db.query("UPDATE entilaaqa.contracts SET status=$1, updated_at=now() WHERE id=$2", [b.status, id]);
        return r.rowCount ? res.json({ ok: true }) : res.status(404).json({ ok: false, error: "not_found" });
    }
    if (req.method === "DELETE") {
        await db.query("DELETE FROM entilaaqa.contracts WHERE id=$1", [id]);
        return res.json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
}
