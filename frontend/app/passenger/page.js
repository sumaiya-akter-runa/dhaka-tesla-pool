"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, ZONES } from "../../lib/api";

const STATUS_LABEL = {
  REQUESTED: "Waiting for a match",
  MATCHED: "Matched",
  DRIVER_ARRIVED: "Driver has arrived",
  STARTED: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function PassengerPage() {
  const router = useRouter();
  const [form, setForm] = useState({ pickupZone: "Banani", destinationZone: "Mohakhali", seatsRequested: 1 });
  const [rides, setRides] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadRides() {
    try {
      const data = await api("/api/rides/my");
      setRides(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadRides();
    const interval = setInterval(loadRides, 4000); // simple polling for status updates
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRequest(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/rides", { method: "POST", body: form });
      await loadRides();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id) {
    try {
      await api(`/api/rides/${id}/cancel`, { method: "POST" });
      await loadRides();
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
        <h1>🛺 Passenger</h1>
        <button className="button secondary" onClick={logout}>Log out</button>
      </nav>

      <div className="card">
        <h2>Request a ride</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleRequest}>
          <label>Pickup zone</label>
          <select
            value={form.pickupZone}
            onChange={(e) => setForm({ ...form, pickupZone: e.target.value })}
          >
            {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>

          <label>Destination zone</label>
          <select
            value={form.destinationZone}
            onChange={(e) => setForm({ ...form, destinationZone: e.target.value })}
          >
            {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>

          <label>Number of seats needed (not a seat number — how many people)</label>
          <select
            value={form.seatsRequested}
            onChange={(e) => setForm({ ...form, seatsRequested: Number(e.target.value) })}
          >
            <option value={1}>1 passenger</option>
            <option value={2}>2 passengers</option>
            <option value={3}>3 passengers</option>
          </select>

          <button className="button" type="submit" disabled={loading}>
            {loading ? "Requesting…" : "Request ride"}
          </button>
        </form>
      </div>

      <h2>Your rides</h2>
      {rides.length === 0 && <p className="muted">No rides yet.</p>}
      {rides.map((ride) => (
        <div className="card" key={ride.id}>
          <p>
            <strong>{ride.pickupZone} → {ride.destinationZone}</strong>{" "}
            <span className="badge">{STATUS_LABEL[ride.status] || ride.status}</span>
          </p>
          {ride.displayFarePaisa != null && (
            <p className="muted">
              {ride.farePaisa != null ? "Fare" : "Estimated fare"}: ৳{(ride.displayFarePaisa / 100).toFixed(2)}
            </p>
          )}
          {(ride.status === "REQUESTED" || ride.status === "MATCHED") && (
            <button className="button secondary" onClick={() => handleCancel(ride.id)}>
              Cancel
            </button>
          )}
        </div>
      ))}
    </main>
  );
}