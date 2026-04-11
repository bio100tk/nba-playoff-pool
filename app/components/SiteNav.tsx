import Link from "next/link";

export default function SiteNav() {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <Link
        href="/"
        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
      >
        Submit Bracket
      </Link>

      <Link
        href="/leaderboard"
        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
      >
        Leaderboard
      </Link>

      <Link
        href="/brackets"
        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
      >
        View Brackets
      </Link>
    </div>
  );
}