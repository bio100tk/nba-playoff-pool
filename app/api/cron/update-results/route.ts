import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const RESULTS_URL =
  "https://cdn.nba.com/static/json/staticData/EliasGameStats/00/results_pos.txt";

type TeamRow = {
  id: number;
  name: string;
  abbreviation: string;
  conference: "East" | "West";
  seed: number | null;
};

type ParsedSeries = {
  conference: "East" | "West" | "NBA";
  round: "First Round" | "Conference Semifinals" | "Conference Finals" | "NBA Finals";
  team1Name: string;
  team2Name: string;
  wins1: number;
  wins2: number;
};

function normalizeName(name: string) {
  return name
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStatus(status: string, team1: string, team2: string) {
  const tied = status.match(/^Series tied (\d+)-(\d+)$/i);
  if (tied) {
    return { wins1: Number(tied[1]), wins2: Number(tied[2]) };
  }

  const leads = status.match(/^(.+?) leads (\d+)-(\d+)$/i);
  if (leads) {
    const leader = normalizeName(leads[1]);
    const a = Number(leads[2]);
    const b = Number(leads[3]);

    if (normalizeName(team1).includes(leader) || leader.includes(normalizeName(team1))) {
      return { wins1: a, wins2: b };
    }

    if (normalizeName(team2).includes(leader) || leader.includes(normalizeName(team2))) {
      return { wins1: b, wins2: a };
    }
  }

  return null;
}

function getSeriesKey(
  conference: "East" | "West" | "NBA",
  round: ParsedSeries["round"],
  team1Seed: number | null,
  team2Seed: number | null
) {
  const seeds = [team1Seed, team2Seed].sort((a, b) => (a ?? 99) - (b ?? 99));

  if (round === "First Round") {
    const seedPair = `${seeds[0]}-${seeds[1]}`;
    if (conference === "East") {
      if (seedPair === "1-8") return "E-R1-1";
      if (seedPair === "4-5") return "E-R1-2";
      if (seedPair === "3-6") return "E-R1-3";
      if (seedPair === "2-7") return "E-R1-4";
    }
    if (conference === "West") {
      if (seedPair === "1-8") return "W-R1-1";
      if (seedPair === "4-5") return "W-R1-2";
      if (seedPair === "3-6") return "W-R1-3";
      if (seedPair === "2-7") return "W-R1-4";
    }
  }

  if (round === "Conference Semifinals") {
    const topHalf = new Set([1, 4, 5, 8]);
    const bottomHalf = new Set([2, 3, 6, 7]);

    const s1 = team1Seed ?? 0;
    const s2 = team2Seed ?? 0;

    if (conference === "East") {
      if (topHalf.has(s1) && topHalf.has(s2)) return "E-R2-1";
      if (bottomHalf.has(s1) && bottomHalf.has(s2)) return "E-R2-2";
    }
    if (conference === "West") {
      if (topHalf.has(s1) && topHalf.has(s2)) return "W-R2-1";
      if (bottomHalf.has(s1) && bottomHalf.has(s2)) return "W-R2-2";
    }
  }

  if (round === "Conference Finals") {
    if (conference === "East") return "E-CF";
    if (conference === "West") return "W-CF";
  }

  if (round === "NBA Finals") {
    return "FINALS";
  }

  return null;
}

function parseResultsFeed(text: string): ParsedSeries[] {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let currentRound: ParsedSeries["round"] | null = null;
  let currentConference: "East" | "West" | "NBA" | null = null;

  const series: ParsedSeries[] = [];

  for (const line of lines) {
    if (line.includes("POSTSEASON FIRST ROUND")) {
      currentRound = "First Round";
      continue;
    }

    if (line.includes("POSTSEASON CONFERENCE SEMIFINALS")) {
      currentRound = "Conference Semifinals";
      continue;
    }

    if (line.includes("POSTSEASON CONFERENCE FINALS")) {
      currentRound = "Conference Finals";
      continue;
    }

    if (line.includes("NBA FINALS")) {
      currentRound = "NBA Finals";
      currentConference = "NBA";
      continue;
    }

    if (line === "EASTERN CONFERENCE") {
      currentConference = "East";
      continue;
    }

    if (line === "WESTERN CONFERENCE") {
      currentConference = "West";
      continue;
    }

    const match = line.match(/^(.+?) vs\. (.+?) \((.+)\)$/i);
    if (!match || !currentRound || !currentConference) continue;

    const team1Name = match[1].trim();
    const team2Name = match[2].trim();
    const status = match[3].trim();

    const parsedStatus = parseStatus(status, team1Name, team2Name);
    if (!parsedStatus) continue;

    series.push({
      conference: currentConference,
      round: currentRound,
      team1Name,
      team2Name,
      wins1: parsedStatus.wins1,
      wins2: parsedStatus.wins2,
    });
  }

  return series;
}

export async function GET() {
  const resultsResponse = await fetch(RESULTS_URL, { cache: "no-store" });

  if (!resultsResponse.ok) {
    return NextResponse.json(
      { ok: false, error: `Results fetch failed: ${resultsResponse.status}` },
      { status: 500 }
    );
  }

  const resultsText = await resultsResponse.text();
  const parsed = parseResultsFeed(resultsText);

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, name, abbreviation, conference, seed");

  if (teamsError) {
    return NextResponse.json({ ok: false, error: teamsError.message }, { status: 500 });
  }

  const teamRows = (teams ?? []) as TeamRow[];

  const byName = new Map<string, TeamRow>();
  for (const team of teamRows) {
    byName.set(normalizeName(team.name), team);
    byName.set(normalizeName(team.abbreviation), team);
  }

  function findTeam(name: string) {
    const normalized = normalizeName(name);

    for (const [key, team] of byName.entries()) {
      if (key === normalized || key.includes(normalized) || normalized.includes(key)) {
        return team;
      }
    }

    return null;
  }

  const upserts = [];

  for (const item of parsed) {
    const team1 = findTeam(item.team1Name);
    const team2 = findTeam(item.team2Name);

    if (!team1 || !team2) continue;

    const seriesKey = getSeriesKey(
      item.conference,
      item.round,
      team1.seed,
      team2.seed
    );

    if (!seriesKey) continue;

    upserts.push({
      series_key: seriesKey,
      actual_team1_name: team1.name,
      actual_team2_name: team2.name,
      team1_conference: team1.conference,
      team2_conference: team2.conference,
      team1_seed: team1.seed,
      team2_seed: team2.seed,
      actual_team1_wins: item.wins1,
      actual_team2_wins: item.wins2,
    });
  }

  const { error: upsertError } = await supabaseAdmin
    .from("series_results")
    .upsert(upserts, { onConflict: "series_key" });

  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updatedSeries: upserts.length,
    series: upserts,
  });
}