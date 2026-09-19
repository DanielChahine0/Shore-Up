/** Shown instead of the globe until a Mapbox token is configured. */
export function MissingToken() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="glass max-w-md rounded-3xl p-6">
        <h1 className="text-lg font-semibold text-ink">The globe needs a Mapbox token</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Add your public token to <code className="text-ink">.env.local</code> in the project root, then restart the dev server.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-wash p-3 text-xs text-ink">NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here</pre>
        <p className="mt-4 text-sm text-ink-soft">Find it at account.mapbox.com under Tokens. See the README for the full setup.</p>
      </div>
    </div>
  );
}
