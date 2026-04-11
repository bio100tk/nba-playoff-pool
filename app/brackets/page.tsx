import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

type PredictionRow = {
  competitor_name: string;
  series_key: string;
  team1_name: string;
  team2_name: string;
  predicted_team1_wins: number;
  predicted_team2_wins: number;
};

type CompetitorRow = {
  competitor_name: string;
};

function seriesOrder(key: string) {
  const order: Record<string, number> = {
    "E-R1-1": 1,
    "E-R1-2": 2,
    "E-R1-3": 3,
    "E-R1-4": 4,
    "W-R1-1": 5,
    "W-R1-2": 6,
    "W-R1-3": 7,
    "W-R1-4": 8,

    "E-R2-1": 9,
    "E-R2-2": 10,
    "W-R2-1": 11,
    "W-R2-2": 12,

    "E-CF": 13,
    "W-CF": 14,

    "FINALS": 15,
  };

  return order[key] ?? 999;
}

function sectionTitle(key: string) {
  if (key.startsWith("E-R1")) return "East Round 1";
  if (key.startsWith("W-R1")) return "West Round 1";
  if (key.startsWith("E-R2")) return "East Round 2";
  if (key.startsWith("W-R2")) return "West Round 2";
  if (key === "E-CF") return "East Conference Finals";
  if (key === "W-CF") return "West Conference Finals";
  if (key === "FINALS") return "NBA Finals";
  return "Bracket";
}

export default async function BracketsPage({
  searchParams,
}: {
  searchParams: Promise<{ competitor?: string }>;
}) {
  noStore();

  const params = await searchParams;
  const selectedCompetitor = params.competitor ?? "";

  const { data: competitorRows, error: competitorError } = await supabase
    .from("predictions")
    .select("competitor_name");

  if (competitorError) {
    return (
      <main className="min-h-screen p-6">
        <h1 className="text-3xl font-bold">View Brackets</h1>
        <p className="mt-4 text-red-600">
          Error loading competitor list: {competitorError.message}
        </p>
      </main>
    );
  }

  const uniqueCompetitors = Array.from(
    new Set(
      ((competitorRows ?? []) as CompetitorRow[])
        .map((row) => row.competitor_name)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  let predictions: PredictionRow[] = [];

  if (selectedCompetitor) {
    const { data: predictionRows, error: predictionsError } = await supabase
      .from("predictions")
      .select("*")
      .eq("competitor_name", selectedCompetitor);

    if (predictionsError) {
      return (
        <main className="min-h-screen p-6">
          <h1 className="text-3xl font-bold">View Brackets</h1>
          <p className="mt-4 text-red-600">
            Error loading bracket: {predictionsError.message}
          </p>
        </main>
      );
    }

    predictions = ((predictionRows ?? []) as PredictionRow[]).sort(
      (a, b) => seriesOrder(a.series_key) - seriesOrder(b.series_key)
    );
  }

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">View Brackets</h1>
            <p className="mt-1 text-sm text-slate-600">
              Select a competitor to view their saved bracket.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Back to bracket
          </Link>
        </div>

        <form method="GET" className="mb-8 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Competitor
            </label>
            <select
              name="competitor"
              defaultValue={selectedCompetitor}
              className="min-w-[240px] rounded-lg border px-3 py-2"
            >
              <option value="">Choose a competitor</option>
              {uniqueCompetitors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
          >
            View Bracket
          </button>
        </form>

        {!selectedCompetitor ? (
          <div className="rounded-2xl border p-6 text-slate-600">
            Pick a competitor above to view their bracket.
          </div>
        ) : predictions.length === 0 ? (
          <div className="rounded-2xl border p-6 text-slate-600">
            No saved bracket found for <span className="font-medium">{selectedCompetitor}</span>.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <h2 className="text-2xl font-bold">{selectedCompetitor}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Read-only bracket view
              </p>
            </div>

            {predictions.map((row) => (
              <div key={row.series_key} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {sectionTitle(row.series_key)} · {row.series_key}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium">{row.team1_name}</div>
                    <div className="rounded-lg border px-3 py-1 font-mono">
                      {row.predicted_team1_wins}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium">{row.team2_name}</div>
                    <div className="rounded-lg border px-3 py-1 font-mono">
                      {row.predicted_team2_wins}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}