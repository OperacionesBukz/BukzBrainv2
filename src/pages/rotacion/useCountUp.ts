import { useState, useEffect, useRef } from "react";

export function useCountUp(end: number, duration = 1200, decimals = 0): string {
  const [value, setValue] = useState(end);
  const prevEnd = useRef(end);
  const rafRef = useRef<number>();

  useEffect(() => {
    const from = prevEnd.current;
    prevEnd.current = end;
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (end - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration]);

  return value.toFixed(decimals);
}
