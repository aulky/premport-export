import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const mql = () => window.matchMedia("(prefers-color-scheme: dark)");

function apply(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function readPref(): ThemePref {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

export interface ThemeState {
  pref: ThemePref;
  resolved: "light" | "dark";
  setPref: (p: ThemePref) => void;
}

export const ThemeContext = createContext<ThemeState>({ pref: "system", resolved: "light", setPref: () => {} });
export const useTheme = () => useContext(ThemeContext);

/** Index.html sudah menerapkan tema awal (mencegah kedipan); hook ini hanya menyambung state React ke itu. */
export function useThemeState(): ThemeState {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref());
  const [resolved, setResolved] = useState<"light" | "dark">(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));

  useEffect(() => {
    const next = pref === "system" ? (mql().matches ? "dark" : "light") : pref;
    setResolved(next);
    apply(next);
  }, [pref]);

  // Ikuti perubahan preferensi OS kalau mode "system" yang dipilih.
  useEffect(() => {
    if (pref !== "system") return;
    const m = mql();
    const onChange = () => {
      const next = m.matches ? "dark" : "light";
      setResolved(next);
      apply(next);
    };
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    if (p === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, p);
    setPrefState(p);
  }, []);

  return useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
}
