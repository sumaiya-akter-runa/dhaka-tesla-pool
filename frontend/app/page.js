import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>🛺 Dhaka Tesla Pool</h1>
      <p className="muted">Share a seat. Split the fare. Survive Dhaka traffic.</p>
      <div className="card">
        <p>Sign in as a passenger to request a ride, or as a driver to manage Bullet.</p>
        <Link href="/login" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
          Log in
        </Link>
      </div>
    </main>
  );
}
