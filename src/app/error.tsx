"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main id="main" className="empty">
      <h1>Your workspace could not be loaded</h1>
      <p>
        Please try again. If this is a new installation, check that PostgreSQL
        is running and migrations have been applied.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
