import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

// دخول متدرّج لأبناء العنصر عبر GSAP (يحترم «تقليل الحركة»).
export default function useReveal(deps = []) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const ctx = gsap.context(() => {
      gsap.from(ref.current.children, {
        opacity: 0, y: 18, filter: "blur(8px)", duration: 0.7, ease: "expo.out", stagger: 0.08, clearProps: "all",
      });
    }, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
