import { useState } from "react";
import { api } from "../api.js";
import useReveal from "../hooks/useReveal.js";

const STATUS = ["موظف", "صاحب مشروع", "طالب", "باحث عن عمل"];
const INCOME = ["أقل من 3,000", "3,000 – 10,000", "10,000 – 30,000", "أكثر من 30,000"];
const READY = ["نعم", "ربما", "لا"];
const opt = (list, i) => ({ code: i + 1, label: list[i] });

export default function Landing() {
  const ref = useReveal();
  const [f, setF] = useState({ name: "", whatsapp: "", email: "", goal: "", challenge: "", status: 0, income: 0, ready: 0, website: "" });
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setState("sending");
    const r = await api("/api/bookings", {
      method: "POST",
      body: {
        language: "ar", website: f.website, name: f.name, whatsapp: f.whatsapp, email: f.email,
        main_goal_12_months: f.goal, biggest_challenge: f.challenge,
        current_status: opt(STATUS, +f.status), monthly_income: opt(INCOME, +f.income),
        ready_to_invest_over_10000: opt(READY, +f.ready),
        session: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
        source: { page_url: location.href, referrer: document.referrer },
      },
    });
    setState(r.ok ? "done" : "error");
  }

  return (
    <main className="wrap" ref={ref}>
      <header className="hero">
        <h1>انطلاقة</h1>
        <p>احجز جلستك الاستشارية وابدأ رحلتك.</p>
      </header>
      {state === "done" ? (
        <div className="card ok">تم تثبيت حجزك. سنتواصل معك قريباً.</div>
      ) : (
        <form className="card" onSubmit={submit}>
          <input className="hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} aria-hidden="true" />
          <label>الاسم<input required minLength={2} value={f.name} onChange={set("name")} /></label>
          <label>واتساب<input required inputMode="tel" value={f.whatsapp} onChange={set("whatsapp")} /></label>
          <label>البريد الإلكتروني<input required type="email" value={f.email} onChange={set("email")} /></label>
          <label>وضعك الحالي<select value={f.status} onChange={set("status")}>{STATUS.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></label>
          <label>الدخل الشهري<select value={f.income} onChange={set("income")}>{INCOME.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></label>
          <label>جاهز للاستثمار بأكثر من 10,000؟<select value={f.ready} onChange={set("ready")}>{READY.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></label>
          <label>هدفك خلال 12 شهراً<textarea required value={f.goal} onChange={set("goal")} /></label>
          <label>أكبر تحدٍّ تواجهه<textarea required value={f.challenge} onChange={set("challenge")} /></label>
          <button className="btn" disabled={state === "sending"}>{state === "sending" ? "جارٍ الإرسال…" : "احجز الآن"}</button>
          {state === "error" && <p className="err">تعذّر تثبيت الحجز، حاول مجدداً.</p>}
        </form>
      )}
      <footer><a href="/login">دخول الفريق</a></footer>
    </main>
  );
}
