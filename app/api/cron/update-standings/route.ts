import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const STANDINGS_URL =
  process.env.STANDINGS_TEXT_URL ??
  "https://cdn.nba.com/static/json/staticData/EliasGameStats/00/stand.txt";

const TEAM_LABELS: Record<string, string> = {
  ATL: "Atlanta",
  BKN: "Brooklyn",
  BOS: "Boston",
  CHA: "Charlotte",
  CHI: "Chicago",
  CLE: "Cleveland",
  DET: "Detroit",
  IND: "Indiana",
  MIA: "Miami",
  MIL: "Milwaukee",
  NYK: "New York",
  ORL: "Orlando",
  PHI: "Philadelphia",
  TOR: "Toronto",
  WAS: "Washington",

  DAL: "Dallas",
  DEN: "Denver",
  GSW: "Golden State",
  HOU: "Houston",
  LAC: "L.A. Clippers",
  LAL: "L.A. Lakers",
  MEM: "Memphis",
  MIN: "Minnesota",
  NOP: "New Orleans",
  OKC: "Oklahoma City",
  PHX: "Phoenix",
  POR: "Portland",
  SAC: "Sacramento",
  SAS: "San Antonio",
  UTA: "Utah",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRecord(text: string, label: string) {
  const pattern = new RegExp(
    `${escapeRegExp(label)}\\s+(\\d+)\\s+(\\d+)`,
    "i"
  );

  const match = text.match(pattern);
  if (!match) return null;

  return {
    wins: Number(match[1]),
    losses: Number(match[2]),
  };
}

export async function GET() {
  const standingsResponse = await fetch(STANDINGS_URL, {
    cache: "no-store",
  });

  if (!standingsResponse.ok) {
    return NextResponse.json(
      { ok: false, error: `Standings fetch failed: ${standingsResponse.status}` },
      { status: 500 }
    );
  }

  const standingsText = await standingsResponse.text();

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, abbreviation, conference, name");

  if (teamsError) {
    return NextResponse.json(
      { ok: false, error: teamsError.message },
      { status: 500 }
    );
  }

  const rows =
    teams?.map((team) => {
      const label = TEAM_LABELS[team.abbreviation];
      const record = label ? parseRecord(standingsText, label) : null;

      return {
        ...team,
        record,
      };
    }) ?? [];

  const east = rows
    .filter((team) => team.conference === "East" && team.record)
    .sort((a, b) => {
      if (b.record!.wins !== a.record!.wins) return b.record!.wins - a.record!.wins;
      if (a.record!.losses !== b.record!.losses) return a.record!.losses - b.record!.losses;
      return a.name.localeCompare(b.name);
    });

  const west = rows
    .filter((team) => team.conference === "West" && team.record)
    .sort((a, b) => {
      if (b.record!.wins !== a.record!.wins) return b.record!.wins - a.record!.wins;
      if (a.record!.losses !== b.record!.losses) return a.record!.losses - b.record!.losses;
      return a.name.localeCompare(b.name);
    });

  const allRows = [...east, ...west];

  const { error: clearError } = await supabaseAdmin
    .from("teams")
    .update({ seed: null })
    .neq("id", 0);

  if (clearError) {
    return NextResponse.json(
      { ok: false, error: clearError.message },
      { status: 500 }
    );
  }

  const updates = [
    ...east.slice(0, 8).map((team, index) =>
      supabaseAdmin
        .from("teams")
        .update({ seed: index + 1 })
        .eq("id", team.id)
    ),
    ...west.slice(0, 8).map((team, index) =>
      supabaseAdmin
        .from("teams")
        .update({ seed: index + 1 })
        .eq("id", team.id)
    ),
  ];

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    return NextResponse.json(
      { ok: false, error: failed.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    updated: allRows.length,
    eastSeeds: east.slice(0, 8).map((team) => team.abbreviation),
    westSeeds: west.slice(0, 8).map((team) => team.abbreviation),
  });
}