import { useState } from "react";
import { api } from "../api.js";
import useReveal from "../hooks/useReveal.js";

export default function Login() {
  const ref = useReveal();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const r = await api("/api/login", { method: "POST", body: { email, password } });
    if (r.ok) location.href = r.data.redirect || "/dashboard.html";
    else setErr(r.status === 429 ? "محاولات كثيرة، انتظر قليلاً." : "بيانات الدخول غير صحيحة.");
  }

  return (
    <main className="wrap narrow" ref={ref}>
      <h1>تسجيل الدخول</h1>
      <form className="card" onSubmit={submit}>
        <label>البريد<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>كلمة المرور<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn">دخول</button>
        {err && <p className="err">{err}</p>}
      </form>
    </main>
  );
}
