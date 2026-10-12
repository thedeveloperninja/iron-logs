export const THEME_KEY = "ironlog:theme";

export function applyTheme(t: string) {
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
}
