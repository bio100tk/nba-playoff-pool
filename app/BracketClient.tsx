"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import SiteNav from "./components/SiteNav";

type Team = {
  id: number;
  conference: "East" | "West";
  seed: number | null;
  name: string;
  abbreviation: string;
  logo_url: string;
};

type BracketTeam = {
  name: string;
  abbreviation: string;
  logo_url: string;
  seed: number | null;
};

type Pick = {
  wins1: number;
  wins2: number;
};

type SeriesDef = {
  key: string;
  label: string;
  team1: BracketTeam;
  team2: BracketTeam;
};

type BracketSide = {
  round1: SeriesDef[];
  round2: SeriesDef[];
  conferenceFinal: SeriesDef;
  champion: BracketTeam;
  seriesDefs: SeriesDef[];
};

const TBD: BracketTeam = {
  name: "TBD",
  abbreviation: "",
  logo_url: "",
  seed: null,
};

const DEPENDENCIES: Record<string, string[]> = {
  "E-R1-1": ["E-R2-1", "E-CF", "FINALS"],
  "E-R1-2": ["E-R2-1", "E-CF", "FINALS"],
  "E-R1-3": ["E-R2-2", "E-CF", "FINALS"],
  "E-R1-4": ["E-R2-2", "E-CF", "FINALS"],
  "E-R2-1": ["E-CF", "FINALS"],
  "E-R2-2": ["E-CF", "FINALS"],
  "E-CF": ["FINALS"],

  "W-R1-1": ["W-R2-1", "W-CF", "FINALS"],
  "W-R1-2": ["W-R2-1", "W-CF", "FINALS"],
  "W-R1-3": ["W-R2-2", "W-CF", "FINALS"],
  "W-R1-4": ["W-R2-2", "W-CF", "FINALS"],
  "W-R2-1": ["W-CF", "FINALS"],
  "W-R2-2": ["W-CF", "FINALS"],
  "W-CF": ["FINALS"],
};

function toBracketTeam(team?: Team | null): BracketTeam {
  if (!team) return TBD;

  return {
    name: team.name,
    abbreviation: team.abbreviation,
    logo_url: team.logo_url,
    seed: team.seed,
  };
}

function pairMatchups(teams: Team[]) {
  return [
    [teams[0], teams[7]],
    [teams[3], teams[4]],
    [teams[2], teams[5]],
    [teams[1], teams[6]],
  ].filter(([a, b]) => a && b) as [Team, Team][];
}

function winnerOf(
  team1: BracketTeam,
  team2: BracketTeam,
  pick?: Pick
): BracketTeam | null {
  if (!pick) return null;

  if (pick.wins1 === 4 && pick.wins2 <= 3) return team1;
  if (pick.wins2 === 4 && pick.wins1 <= 3) return team2;

  return null;
}

function buildConferenceBracket(
  prefix: "E" | "W",
  conferenceName: string,
  teams: Team[],
  picks: Record<string, Pick>
): BracketSide {
  const ordered = [...teams];
  const getTeam = (index: number) => toBracketTeam(ordered[index]);

  const round1: SeriesDef[] = [
    {
      key: `${prefix}-R1-1`,
      label: `${conferenceName} Round 1 • Game 1`,
      team1: getTeam(0),
      team2: getTeam(7),
    },
    {
      key: `${prefix}-R1-2`,
      label: `${conferenceName} Round 1 • Game 2`,
      team1: getTeam(3),
      team2: getTeam(4),
    },
    {
      key: `${prefix}-R1-3`,
      label: `${conferenceName} Round 1 • Game 3`,
      team1: getTeam(2),
      team2: getTeam(5),
    },
    {
      key: `${prefix}-R1-4`,
      label: `${conferenceName} Round 1 • Game 4`,
      team1: getTeam(1),
      team2: getTeam(6),
    },
  ];

  const round1Winners = round1.map((series) => {
    return winnerOf(series.team1, series.team2, picks[series.key]) ?? TBD;
  });

  const round2: SeriesDef[] = [
    {
      key: `${prefix}-R2-1`,
      label: `${conferenceName} Semifinals • Game 1`,
      team1: round1Winners[0],
      team2: round1Winners[1],
    },
    {
      key: `${prefix}-R2-2`,
      label: `${conferenceName} Semifinals • Game 2`,
      team1: round1Winners[2],
      team2: round1Winners[3],
    },
  ];

  const round2Winners = round2.map((series) => {
    return winnerOf(series.team1, series.team2, picks[series.key]) ?? TBD;
  });

  const conferenceFinal: SeriesDef = {
    key: `${prefix}-CF`,
    label: `${conferenceName} Conference Finals`,
    team1: round2Winners[0],
    team2: round2Winners[1],
  };

  const champion = winnerOf(
    conferenceFinal.team1,
    conferenceFinal.team2,
    picks[conferenceFinal.key]
  ) ?? TBD;

  return {
    round1,
    round2,
    conferenceFinal,
    champion,
    seriesDefs: [...round1, ...round2, conferenceFinal],
  };
}

function TeamPill({ team }: { team: BracketTeam }) {
  const isTbd = team.name === "TBD";

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-200">
        {team.logo_url ? (
          <img src={team.logo_url} alt={team.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] font-semibold text-slate-500">
            {isTbd ? "TBD" : "?"}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate font-medium">
          {team.seed !== null ? `${team.seed}. ${team.name}` : team.name}
        </div>
      </div>
    </div>
  );
}

function SeriesCard({
  label,
  seriesKey,
  team1,
  team2,
  pick,
  onChange,
  isLocked,
}: {
  label: string;
  seriesKey: string;
  team1: BracketTeam;
  team2: BracketTeam;
  pick?: Pick;
  onChange: (seriesKey: string, wins1: number, wins2: number) => void;
  isLocked: boolean;
}) {
  const wins1 = pick?.wins1 ?? 0;
  const wins2 = pick?.wins2 ?? 0;
  const complete = wins1 === 4 || wins2 === 4;
const isTeam1Winner = wins1 === 4;
const isTeam2Winner = wins2 === 4;
  const winnerName = wins1 === 4 ? team1.name : wins2 === 4 ? team2.name : "";
  const disabled = team1.name === "TBD" || team2.name === "TBD";

  return (
    <div
      className={[
        "rounded-2xl border bg-white p-4 shadow-sm",
        complete ? "border-emerald-400" : "border-slate-200",
        disabled ? "opacity-70" : "",
      ].join(" ")}
    >
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <TeamPill team={team1} />
          <input
            type="number"
            min={0}
            max={4}
            value={wins1}
            disabled={disabled || isLocked}
            onChange={(e) => onChange(seriesKey, Number(e.target.value || 0), wins2)}
            className="w-16 rounded-lg border px-2 py-1 text-right disabled:bg-slate-100"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <TeamPill team={team2} />
          <input
            type="number"
            min={0}
            max={4}
            value={wins2}
            disabled={disabled || isLocked}
            onChange={(e) => onChange(seriesKey, wins1, Number(e.target.value || 0))}
            className="w-16 rounded-lg border px-2 py-1 text-right disabled:bg-slate-100"
          />
        </div>
      </div>

      {complete ? (
        <div className="mt-3 text-sm font-medium text-emerald-700">
          Winner advances: {winnerName}
        </div>
      ) : disabled ? (
        <div className="mt-3 text-sm text-slate-500">
          Fill the previous round to reveal this matchup.
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-500">
          Enter a 4-win result to advance the winner.
        </div>
      )}
    </div>
  );
}

function ConferenceBracket({
  title,
  bracket,
  picks,
  onChange,
  isLocked,
}: {
  title: string;
  bracket: BracketSide;
  picks: Record<string, Pick>;
  onChange: (seriesKey: string, wins1: number, wins2: number) => void;
  isLocked: boolean;
}) {
  return (
    <section className="rounded-3xl border bg-slate-50 p-4">
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>

      <div className="grid gap-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Round 1
          </h3>
          <div className="grid gap-4">
            {bracket.round1.map((series) => (
              <SeriesCard
                key={series.key}
                label={series.label}
                seriesKey={series.key}
                team1={series.team1}
                team2={series.team2}
                pick={picks[series.key]}
                onChange={onChange}
                isLocked={isLocked}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Round 2
          </h3>
          <div className="grid gap-4">
            {bracket.round2.map((series) => (
              <SeriesCard
                key={series.key}
                label={series.label}
                seriesKey={series.key}
                team1={series.team1}
                team2={series.team2}
                pick={picks[series.key]}
                onChange={onChange}
                isLocked={isLocked}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Conference Finals
          </h3>
          <SeriesCard
            label={bracket.conferenceFinal.label}
            seriesKey={bracket.conferenceFinal.key}
            team1={bracket.conferenceFinal.team1}
            team2={bracket.conferenceFinal.team2}
            pick={picks[bracket.conferenceFinal.key]}
            onChange={onChange}
            isLocked={isLocked}
          />
        </div>
      </div>
    </section>
  );
}

export default function BracketClient({
  east,
  west,
}: {
  east: Team[];
  west: Team[];
}) {
  const LOCK_TIME = new Date("2026-04-18T00:00:00"); // change this later
  const isLocked = new Date() > LOCK_TIME;

  const [competitorName, setCompetitorName] = useState("");
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  const eastBracket = buildConferenceBracket("E", "East", east, picks);
  const westBracket = buildConferenceBracket("W", "West", west, picks);

  const finals: SeriesDef = {
    key: "FINALS",
    label: "NBA Finals",
    team1: eastBracket.champion,
    team2: westBracket.champion,
  };

  const allSeries = [...eastBracket.seriesDefs, ...westBracket.seriesDefs, finals];

function handleChange(seriesKey: string, wins1: number, wins2: number) {
  // prevent impossible states
  if (wins1 > 4 || wins2 > 4) return;
  if (wins1 === 4 && wins2 === 4) return;
  if (wins1 > 3 && wins2 > 3) return;

  setPicks((prev) => {
    const next: Record<string, Pick> = {
      ...prev,
      [seriesKey]: { wins1, wins2 },
    };

    const dependents = DEPENDENCIES[seriesKey] ?? [];
    for (const key of dependents) {
      delete next[key];
    }

    return next;
  });
}

  async function handleSubmit() {
    const trimmedName = competitorName.trim();

    if (!trimmedName) {
      alert("Please enter your name first.");
      return;
    }

    const incomplete = allSeries.filter((series) => {
      const pick = picks[series.key];
      return !pick || !(pick.wins1 === 4 || pick.wins2 === 4);
    });

    if (incomplete.length > 0) {
      alert(
        `Please finish all rounds before submitting. The first incomplete series is: ${incomplete[0].label}`
      );
      return;
    }

    const rows = allSeries.map((series) => {
      const pick = picks[series.key]!;

      return {
        competitor_name: trimmedName,
        series_key: series.key,
        team1_name: series.team1.name,
        team2_name: series.team2.name,
        predicted_team1_wins: pick.wins1,
        predicted_team2_wins: pick.wins2,
      };
    });

    const { error: deleteError } = await supabase
      .from("predictions")
      .delete()
      .eq("competitor_name", trimmedName);

    if (deleteError) {
      alert("Could not clear old predictions: " + deleteError.message);
      return;
    }

    const { error: insertError } = await supabase.from("predictions").insert(rows);

    if (insertError) {
      alert("Error saving: " + insertError.message);
      return;
    }

    alert("Bracket saved!");
  }

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-2 text-3xl font-bold">NBA Playoff Bracket</h1>
        <p className="mb-6 text-sm text-slate-600">
          Enter a 4-win result in Round 1 to reveal the next round automatically.
        </p>
        <SiteNav />
        <input
          placeholder="Your name"
          value={competitorName}
          onChange={(e) => setCompetitorName(e.target.value)}
          className="mb-6 w-full max-w-sm rounded-lg border px-3 py-2"
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <ConferenceBracket
            title="East"
            bracket={eastBracket}
            picks={picks}
            onChange={handleChange}
            isLocked={isLocked}
          />
          <ConferenceBracket
            title="West"
            bracket={westBracket}
            picks={picks}
            onChange={handleChange}
            isLocked={isLocked}
          />
        </div>

        <section className="mt-6 rounded-3xl border bg-slate-50 p-4">
          <h2 className="mb-4 text-2xl font-bold">NBA Finals</h2>
          <SeriesCard
            label={finals.label}
            seriesKey={finals.key}
            team1={finals.team1}
            team2={finals.team2}
            pick={picks[finals.key]}
            onChange={handleChange}
            isLocked={isLocked}
          />
        </section>

        <button
          onClick={handleSubmit}
          disabled={isLocked}
          className={`mt-6 rounded-lg px-4 py-2 font-medium text-white ${
    isLocked ? "cursor-not-allowed bg-gray-400" : "bg-blue-600"
  }`}
>
  {isLocked ? "Bracket Locked" : "Submit Bracket"}
</button>
      </div>
    </main>
  );
}