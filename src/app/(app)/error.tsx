"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="gp-display text-2xl font-bold text-[var(--gp-ink)]">Something went wrong</h2>
      <p className="text-sm text-muted">{error.message || "Unexpected error"}</p>
      <button type="button" className="gp-btn gp-btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
