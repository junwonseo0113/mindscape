// Where the AI endpoints live. On the web the app and /api share one
// origin, so a relative path works. Inside the iOS app the page is served
// from capacitor://localhost, which has no /api behind it, so the build
// sets VITE_API_BASE to the deployed site (see .env.ios and APP-STORE.md).
const BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
