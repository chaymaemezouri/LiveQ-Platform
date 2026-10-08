import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from '@/components/theme-context';

const storageKey = 'liveq-theme';

function readTheme(): Theme {
  const stored = localStorage.getItem(storageKey);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  if (typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(storageKey, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
