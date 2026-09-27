const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// sessionStorage (not localStorage) is deliberate: localStorage is shared
// across every tab of the same origin, which meant logging in as a
// different role in one tab silently switched the token used by every
// other open tab too. sessionStorage is scoped per-tab, so each tab can
// hold its own independent login — needed for testing passenger/driver
// flows side by side in the same browser.
function getToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("teslapool_token");
}

export function setToken(token) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("teslapool_token", token);
  }
}

export function clearToken() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("teslapool_token");
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export const ZONES = [
  "Banani",
  "Gulshan 1",
  "Gulshan 2",
  "Mohakhali",
  "Dhanmondi",
  "Mirpur",
  "Uttara",
  "Farmgate",
  "Bashundhara",
];