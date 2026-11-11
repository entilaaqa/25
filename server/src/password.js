import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
/* تشفير كلمات المرور بـ scrypt (مدمج في Node، بلا مكتبات إضافية). الصيغة: scrypt$N$r$p$salt$hash */
const scrypt = (pw, salt, len, o) => new Promise((res, rej) => _scrypt(pw, salt, len, o, (e, k) => (e ? rej(e) : res(k))));
const N = 16384, R = 8, P = 1, LEN = 64;
export async function hashPassword(password) {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, LEN, { N, r: R, p: P });
    return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifyPassword(password, stored) {
    const [alg, n, r, p, salt, hash] = stored.split("$");
    if (alg !== "scrypt" || !salt || !hash)
        return false;
    const expected = Buffer.from(hash, "base64");
    const key = await scrypt(password, Buffer.from(salt, "base64"), expected.length, { N: +n, r: +r, p: +p });
    return key.length === expected.length && timingSafeEqual(key, expected);
}
// تجزئة وهمية لمعادلة زمن الاستجابة عندما يكون البريد غير موجود (تقليل تعداد الحسابات).
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");
