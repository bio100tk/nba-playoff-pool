import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LeaderboardRow = {
  competitor_name: string;
  total_score: number;
};

export default async function LeaderboardPage() {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total_score", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-3xl font-bold">Leaderboard</h1>
          <p className="text-red-600">Error loading leaderboard: {error.message}</p>
          <div className="mt-6">
            <Link href="/" className="text-blue-600 underline">
              Back to bracket
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const rows = (data ?? []) as LeaderboardRow[];

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Lower score is better. The score is based on squared error.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Back to bracket
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-sm text-slate-600">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Competitor</th>
                <th className="px-4 py-3">Total Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={3}>
                    No scores yet. The leaderboard fills in after you add actual results to
                    <code className="mx-1 rounded bg-slate-100 px-1 py-0.5">series_results</code>.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.competitor_name} className="border-t">
                    <td className="px-4 py-3 font-medium">{index + 1}</td>
                    <td className="px-4 py-3">{row.competitor_name}</td>
                    <td className="px-4 py-3 font-mono">{Number(row.total_score).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}