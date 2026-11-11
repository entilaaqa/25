import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { can, currentUser } from "../auth.js";
import { getDb } from "../db.js";
/* قالب العقد وأسئلة المكالمة الاستراتيجية (قابلة للتحرير). الافتراضي في public/session-defaults.json.
   GET → الحالي (أو الافتراضي) · PUT {key,data} → حفظ · DELETE {key} → استعادة الافتراضي. صلاحية contracts. */
const here = path.dirname(fileURLToPath(import.meta.url));
let defaults = null;
const getDefaults = () => (defaults ??= JSON.parse(readFileSync(path.join(here, "..", "..", "public", "session-defaults.json"), "utf8")));
const KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
const VAL = /^[a-zA-Z0-9_-]{1,32}$/;
const TYPES = ["t", "a", "n", "s", "c"];
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const text = (v, n) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").slice(0, n) : "");
function cleanQuestions(raw) {
    if (!raw || !Array.isArray(raw.sections) || raw.sections.length < 1 || raw.sections.length > 20)
        return null;
    const keys = new Set(), ids = new Set(), sys = new Set(), out = [];
    let total = 0;
    for (const s of raw.sections) {
        if (!s || typeof s !== "object" || !KEY.test(s.id) || ids.has(s.id))
            return null;
        ids.add(s.id);
        const sec = { id: s.id, title: str(s.title, 120), hint: str(s.hint, 240), fields: [] };
        if (!sec.title)
            return null;
        if (s.internal === true)
            sec.internal = true;
        if (s.sys === "scope" || s.sys === "pricing") {
            if (sys.has(s.sys))
                return null;
            sys.add(s.sys);
            sec.sys = s.sys;
            out.push(sec);
            continue;
        }
        if (!Array.isArray(s.fields) || s.fields.length > 40)
            return null;
        for (const f of s.fields) {
            if (!f || typeof f !== "object" || !KEY.test(f.k) || keys.has(f.k) || !TYPES.includes(f.t))
                return null;
            keys.add(f.k);
            const fld = { k: f.k, l: str(f.l, 200), t: f.t };
            if (!fld.l)
                return null;
            const h = str(f.h, 200);
            if (h)
                fld.h = h;
            if (f.t === "s" || f.t === "c") {
                if (!Array.isArray(f.o) || f.o.length < 1 || f.o.length > 12)
                    return null;
                const vs = new Set();
                fld.o = [];
                for (const o of f.o) {
                    if (!Array.isArray(o) || typeof o[0] !== "string" || !VAL.test(o[0]) || vs.has(o[0]))
                        return null;
                    const l = str(o[1], 120);
                    if (!l)
                        return null;
                    vs.add(o[0]);
                    fld.o.push([o[0], l]);
                }
            }
            sec.fields.push(fld);
            if (++total > 80)
                return null;
        }
        out.push(sec);
    }
    // الأقسام الثابتة (النطاق والتسعير) لا تُحذف: نعيدها إن غابت.
    for (const d of getDefaults().questions.sections)
        if (d.sys && !sys.has(d.sys) && !ids.has(d.id))
            out.push(d);
    return { v: 1, sections: out };
}
function cleanContract(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.clauses) || raw.clauses.length > 40)
        return null;
    const ids = new Set(), clauses = [];
    for (const c of raw.clauses) {
        if (!c || typeof c !== "object" || !KEY.test(c.id) || ids.has(c.id))
            return null;
        ids.add(c.id);
        const o = { id: c.id, title: str(c.title, 150), body: text(c.body, 4000), on: c.on !== false };
        if (c.pay === true)
            o.pay = true;
        clauses.push(o);
    }
    const pays = Array.isArray(raw.payments) ? raw.payments : [];
    if (pays.length > 10)
        return null;
    const payments = pays.map((p) => ({ label: str(p?.label, 120), pct: Number.isFinite(Number(p?.pct)) ? Math.min(100, Math.max(0, Number(p.pct))) : 0 }));
    return {
        v: 1,
        title: str(raw.title, 150),
        provider: { name: str(raw.provider?.name, 150), details: text(raw.provider?.details, 600) },
        intro: text(raw.intro, 1000),
        partyClient: text(raw.partyClient, 600),
        clauses,
        payments,
        signProvider: str(raw.signProvider, 80),
        signClient: str(raw.signClient, 80),
        footer: text(raw.footer, 1500),
    };
}
export default async function contractSettings(req, res) {
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
        const { rows } = await db.query("SELECT key, data FROM entilaaqa.contract_settings");
        const m = Object.fromEntries(rows.map((r) => [r.key, r.data]));
        const d = getDefaults();
        return res.json({ ok: true, questions: m.questions ?? d.questions, contract: m.contract ?? d.contract, custom: { questions: !!m.questions, contract: !!m.contract } });
    }
    if (req.method === "PUT") {
        const key = b.key;
        if (key !== "questions" && key !== "contract")
            return bad();
        const data = key === "questions" ? cleanQuestions(b.data) : cleanContract(b.data);
        if (!data)
            return bad();
        await db.query("INSERT INTO entilaaqa.contract_settings (key, data) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()", [key, JSON.stringify(data)]);
        return res.json({ ok: true, data });
    }
    if (req.method === "DELETE") {
        const key = b.key ?? req.query.key;
        if (key !== "questions" && key !== "contract")
            return bad();
        await db.query("DELETE FROM entilaaqa.contract_settings WHERE key = $1", [key]);
        return res.json({ ok: true, data: getDefaults()[key] });
    }
    res.setHeader("Allow", "GET, PUT, DELETE");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
}
