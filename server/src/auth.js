import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db.js";
/* مفاتيح الصلاحيات المسموحة، والقيمة الافتراضية [فريق العمل، المدير]. نفس القائمة في لوحة التحكم (PERMS). */
const DEFAULTS = {
    view: [true, true], update: [true, true], export: [false, true], users: [false, true],
    clients: [false, true], fin_view: [false, true], fin_edit: [false, true], marketing: [false, true], contracts: [false, true],
};
export const PERM_KEYS = Object.keys(DEFAULTS);
export const can = (u, k) => {
    if (u.role === "client")
        return false;
    const o = u.perms?.[k];
    if (typeof o === "boolean")
        return o;
    const d = DEFAULTS[k];
    return d ? (u.role === "admin" ? d[1] : d[0]) : false;
};
const COOKIE = "ent_sid";
const TTL_MS = 7 * 24 * 3600_000; // أسبوع، ويتجدد مع الاستخدام
const RENEW_AFTER_MS = 3600_000;
const secure = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
const attrs = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
const sha = (s) => createHash("sha256").update(s).digest("hex");
export function readCookie(req, name) {
    for (const part of (req.headers.cookie || "").split(";")) {
        const i = part.indexOf("=");
        if (i > 0 && part.slice(0, i).trim() === name) {
            try {
                return decodeURIComponent(part.slice(i + 1).trim());
            }
            catch {
                return "";
            }
        }
    }
    return "";
}
const setCookie = (res, token, maxAgeS) => res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; ${attrs}; Max-Age=${maxAgeS}`);
export async function createSession(res, userId) {
    const db = await getDb();
    const token = randomBytes(32).toString("base64url");
    await db.query("INSERT INTO entilaaqa.sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + $3::int * interval '1 second')", [sha(token), userId, TTL_MS / 1000]);
    await db.query("UPDATE entilaaqa.users SET last_login_at = now() WHERE id = $1", [userId]);
    setCookie(res, token, TTL_MS / 1000);
}
export async function destroySession(req, res) {
    const token = readCookie(req, COOKIE);
    if (token) {
        try {
            await (await getDb()).query("DELETE FROM entilaaqa.sessions WHERE token_hash = $1", [sha(token)]);
        }
        catch { /* نمسح الكوكي على أي حال */ }
    }
    setCookie(res, "", 0);
}
/** المستخدم الحالي من الكوكي، أو null. يجدّد الجلسة تلقائياً (sliding). */
export async function currentUser(req, res) {
    const token = readCookie(req, COOKIE);
    if (!token)
        return null;
    const db = await getDb();
    const { rows } = await db.query(`SELECT u.id, u.email, u.role, u.perms, u.booking_id, s.renewed_at
       FROM entilaaqa.sessions s JOIN entilaaqa.users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`, [sha(token)]);
    const r = rows[0];
    if (!r)
        return null;
    if (Date.now() - new Date(r.renewed_at).getTime() > RENEW_AFTER_MS) {
        await db.query("UPDATE entilaaqa.sessions SET expires_at = now() + $2::int * interval '1 second', renewed_at = now() WHERE token_hash = $1", [sha(token), TTL_MS / 1000]);
        setCookie(res, token, TTL_MS / 1000);
    }
    return { id: r.id, email: r.email, role: r.role, isAdmin: r.role === "admin", perms: r.perms ?? {}, bookingId: r.booking_id ?? null };
}
export function limiter(max, windowMs) {
    const m = new Map();
    setInterval(() => { const t = Date.now(); for (const [k, b] of m)
        if (b.until < t)
            m.delete(k); }, 60_000).unref();
    return {
        blocked: (key) => { const b = m.get(key); return !!b && b.until > Date.now() && b.n >= max; },
        hit: (key) => {
            const t = Date.now(), b = m.get(key);
            if (!b || b.until < t)
                m.set(key, { n: 1, until: t + windowMs });
            else
                b.n++;
        },
        reset: (key) => void m.delete(key),
    };
}
export const clientIp = (req) => String(req.headers["cf-connecting-ip"] || req.ip || "unknown");
