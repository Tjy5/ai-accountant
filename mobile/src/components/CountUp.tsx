import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';

interface CountUpProps extends TextProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export const CountUp: React.FC<CountUpProps> = ({
  end,
  duration = 2,
  prefix = '',
  suffix = '',
  decimals = 0,
  style,
  ...props
}) => {
  const [value, setValue] = useState(0);
  const fromValueRef = useRef(0);

  useEffect(() => {
    const from = fromValueRef.current;
    const to = end;
    const durationMs = Math.max(0, duration * 1000);

    if (durationMs === 0) {
      setValue(to);
      fromValueRef.current = to;
      return;
    }

    const startTime = Date.now();
    let rafId: number | null = null;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = from + (to - from) * eased;
      setValue(next);

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        fromValueRef.current = to;
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [end, duration]);

  const formatted = useMemo(() => {
    const fixed = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
    return `${prefix}${fixed}${suffix}`;
  }, [decimals, prefix, suffix, value]);

  return (
    <Text style={style} {...props}>
      {formatted}
    </Text>
  );
};
