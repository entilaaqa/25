import { useEffect, useState } from "react";
import { api } from "../api.js";
import useReveal from "../hooks/useReveal.js";
import useCountUp from "../hooks/useCountUp.js";

const STATUSES = { new: "جديد", contacted: "تم التواصل", scheduled: "مجدول", won: "تم الإغلاق", lost: "خسارة" };

function Stat({ label, value }) {
  const n = useCountUp(value);
  return <div className="card stat"><b>{n.toLocaleString("en-US")}</b><span>{label}</span></div>;
}

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const ref = useReveal([rows === null]);

  useEffect(() => {
    (async () => {
      const u = await api("/api/me");
      if (u.status === 401) { location.href = "/login"; return; }
      setMe(u.data);
      const b = await api("/api/me?bookings=1");
      setRows(b.data.bookings || []);
    })();
  }, []);

  async function update(id, patch) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await api("/api/me?update=1", { method: "POST", body: { id, ...patch } });
  }
  async function logout() { await api("/api/me", { method: "POST" }); location.href = "/login"; }

  if (!rows) return <main className="wrap"><p className="muted">جارٍ التحميل…</p></main>;
  const count = (s) => rows.filter((r) => r.lead_status === s).length;

  return (
    <main className="wrap wide" ref={ref}>
      <header className="bar"><h1>لوحة التحكم</h1><span className="muted">{me?.email}</span><button className="btn ghost" onClick={logout}>خروج</button></header>
      <section className="grid">
        <Stat label="كل العملاء" value={rows.length} />
        <Stat label="جدد" value={count("new")} />
        <Stat label="مجدولة" value={count("scheduled")} />
        <Stat label="مغلقة" value={count("won")} />
      </section>
      <section className="card scroll">
        <table>
          <thead><tr><th>الاسم</th><th>واتساب</th><th>البريد</th><th>الهدف</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td><td dir="ltr">{r.whatsapp}</td><td dir="ltr">{r.email}</td><td>{r.main_goal}</td>
                <td>
                  <select value={r.lead_status} onChange={(e) => update(r.id, { lead_status: e.target.value })}>
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td><input defaultValue={r.notes || ""} onBlur={(e) => e.target.value !== (r.notes || "") && update(r.id, { notes: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
