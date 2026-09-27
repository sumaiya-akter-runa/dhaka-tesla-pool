"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "PASSENGER" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : form;
      const data = await api(path, { method: "POST", body });
      setToken(data.token);
      router.push(data.user.role === "DRIVER" ? "/driver" : "/passenger");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>🛺 Dhaka Tesla Pool</h1>
      <div className="card">
        <h2>{mode === "login" ? "Log in" : "Create an account"}</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <label>I am a</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="PASSENGER">Passenger</option>
                <option value="DRIVER">Driver</option>
              </select>
            </>
          )}
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <label>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Register"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1rem" }}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); setError(""); setMode(mode === "login" ? "register" : "login"); }}>
            {mode === "login" ? "Create an account" : "Log in"}
          </a>
        </p>
        <p className="muted">
          Demo: jashim@teslapool.dhaka (driver) or nusrat@teslapool.dhaka (passenger), password123
        </p>
      </div>
    </main>
  );
}