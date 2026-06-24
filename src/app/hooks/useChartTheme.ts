import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

function readDarkMode() {
  if (typeof document === 'undefined') return false;
  return document.querySelector('.dark') !== null;
}

export function useIsDarkMode() {
  const [isDark, setIsDark] = useState(readDarkMode);

  useEffect(() => {
    const update = () => setIsDark(readDarkMode());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
    window.addEventListener('storage', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', update);
    };
  }, []);

  return isDark;
}

export function useChartTheme() {
  const isDark = useIsDarkMode();

  return useMemo(() => {
    const tooltipContent: CSSProperties = {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
      borderRadius: 6,
      boxShadow: isDark ? '0 18px 36px rgba(0,0,0,0.34)' : '0 12px 24px rgba(15,23,42,0.12)',
      color: isDark ? '#e2e8f0' : '#0f172a',
      fontSize: 12,
    };

    return {
      isDark,
      axis: isDark ? '#94a3b8' : '#64748b',
      axisLine: isDark ? '#334155' : '#cbd5e1',
      grid: isDark ? '#243247' : '#dbe4ef',
      muted: isDark ? '#64748b' : '#94a3b8',
      tooltipContent,
      tooltipLabel: { color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 700 } as CSSProperties,
      tooltipItem: { color: isDark ? '#cbd5e1' : '#334155' } as CSSProperties,
      legend: { color: isDark ? '#cbd5e1' : '#475569', fontSize: 11 } as CSSProperties,
    };
  }, [isDark]);
}
