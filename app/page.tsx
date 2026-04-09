import { supabase } from "@/lib/supabase";
import BracketClient from "./BracketClient";

type Team = {
  id: number;
  conference: "East" | "West";
  seed: number | null;
  name: string;
  abbreviation: string;
  logo_url: string;
};

type PlayInResult = {
  conference: "East" | "West";
  slot: 7 | 8;
  team_abbreviation: string;
};

function placeholderTeam(conference: "East" | "West", seed: number): Team {
  return {
    id: -seed,
    conference,
    seed,
    name: "TBD",
    abbreviation: `TBD-${conference}-${seed}`,
    logo_url: "https://via.placeholder.com/64?text=TBD",
  };
}

function buildConference(
  conference: "East" | "West",
  allTeams: Team[],
  playInResults: PlayInResult[]
) {
  const bySeed = new Map<number, Team>();
  const byAbbreviation = new Map<string, Team>();

  for (const team of allTeams) {
    byAbbreviation.set(team.abbreviation, team);
    if (team.conference === conference && team.seed !== null) {
      bySeed.set(team.seed, team);
    }
  }

  const resultMap = new Map<string, string>();
  for (const row of playInResults) {
    resultMap.set(`${row.conference}-${row.slot}`, row.team_abbreviation);
  }

  return [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
    const overrideAbbr = resultMap.get(`${conference}-${seed}`);
    if (overrideAbbr) {
      const overrideTeam = byAbbreviation.get(overrideAbbr);
      if (overrideTeam) {
        return { ...overrideTeam, seed };
      }
    }

    const seededTeam = bySeed.get(seed);
    if (seededTeam) {
      return { ...seededTeam, seed };
    }

    return placeholderTeam(conference, seed);
  });
}

export default async function Home() {
  const [{ data: teamsData, error: teamsError }, { data: playInData, error: playInError }] =
    await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("play_in_results").select("*"),
    ]);

  if (teamsError) {
    return <main className="p-8">Error loading teams: {teamsError.message}</main>;
  }

  if (playInError) {
    return <main className="p-8">Error loading play-in results: {playInError.message}</main>;
  }

  const teams = (teamsData ?? []) as Team[];
  const playInResults = (playInData ?? []) as PlayInResult[];

  const east = buildConference("East", teams, playInResults);
  const west = buildConference("West", teams, playInResults);

  return <BracketClient east={east} west={west} />;
}