// طبقة الاتصال بالـ API (نفس السيرفر الذي يقدّم الواجهة).
export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* ردّ بلا JSON */ }
  return { status: res.status, ok: res.ok && data.ok !== false, data };
}
