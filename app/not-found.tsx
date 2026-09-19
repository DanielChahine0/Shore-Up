import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-abyss/80 p-6">
      <div className="glass max-w-sm rounded-3xl p-6 text-center">
        <h1 className="text-lg font-semibold text-shell">This page isn&apos;t on the map</h1>
        <p className="mt-2 text-sm text-mist">The beach or page you followed doesn&apos;t exist here yet.</p>
        <Link href="/" className="mt-5 inline-flex rounded-full bg-foam px-5 py-2 text-sm font-semibold text-foam-deep">
          Back to globe
        </Link>
      </div>
    </div>
  );
}
