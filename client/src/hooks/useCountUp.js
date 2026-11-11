import { useEffect, useState } from "react";
import gsap from "gsap";

// عدّاد تصاعدي للأرقام باستخدام GSAP.
export default function useCountUp(to, duration = 1.1) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const o = { n: 0 };
    const t = gsap.to(o, { n: to, duration, ease: "expo.out", onUpdate: () => setV(Math.round(o.n)) });
    return () => t.kill();
  }, [to, duration]);
  return v;
}
