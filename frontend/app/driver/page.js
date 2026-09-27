"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken } from "../../lib/api";

const NEXT_ACTION = {
  MATCHED: { label: "Mark arrived", path: "arrived" },
  DRIVER_ARRIVED: { label: "Start trip", path: "start" },
  STARTED: { label: "Complete trip", path: "complete" },
};

export default function DriverPage() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [requests, setRequests] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [error, setError] = useState("");

  async function loadAll() {
    try {
      const [reqs, mine] = await Promise.all([
        api("/api/driver/rides/requests"),
        api("/api/driver/rides/mine"),
      ]);
      setRequests(reqs);
      setAssigned(mine.filter((r) => !["COMPLETED", "CANCELLED"].includes(r.status)));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleOnline() {
    const next = online ? "OFFLINE" : "ONLINE";
    try {
      await api("/api/driver/vehicle/status", { method: "POST", body: { status: next } });
      setOnline(!online);
    } catch (err) {
      setError(err.message);
    }
  }

  async function accept(id) {
    setError("");
    try {
      await api(`/api/driver/rides/${id}/accept`, { method: "POST" });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function advance(id, path) {
    setError("");
    try {
      await api(`/api/driver/rides/${id}/${path}`, { method: "POST" });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <main>
      <nav>
        <h1>🛺 Driver</h1>
        <button className="button secondary" onClick={logout}>Log out</button>
      </nav>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Bullet</h2>
        <p className="muted">Vehicle status</p>
        <button className="button" onClick={toggleOnline}>
          {online ? "Go offline" : "Go online"}
        </button>
      </div>

      <h2>Your assigned rides</h2>
      {assigned.length === 0 && <p className="muted">Nothing assigned yet.</p>}
      {assigned.map((ride) => {
        const next = NEXT_ACTION[ride.status];
        return (
          <div className="card" key={ride.id}>
            <p>
              <strong>{ride.passenger?.name}</strong> · {ride.pickupZone} → {ride.destinationZone}{" "}
              <span className="badge">{ride.status}</span>
            </p>
            {ride.farePaisa != null && <p className="muted">Fare: ৳{(ride.farePaisa / 100).toFixed(2)}</p>}
            {ride.pool && (
              <p className="muted">Pool seats: {ride.pool.occupiedSeats} / {ride.pool.status === "FULL" ? "full" : "open"}</p>
            )}
            {next && (
              <button className="button" onClick={() => advance(ride.id, next.path)}>
                {next.label}
              </button>
            )}
          </div>
        );
      })}

      <h2>Incoming requests</h2>
      {requests.length === 0 && <p className="muted">No pending requests.</p>}
      {requests.map((r) => (
        <div className="card" key={r.id}>
          <p>
            <strong>{r.passenger?.name}</strong> · {r.pickupZone} → {r.destinationZone} · {r.seatsRequested} seat(s)
          </p>
          <button className="button" onClick={() => accept(r.id)}>Accept</button>
        </div>
      ))}
    </main>
  );
}