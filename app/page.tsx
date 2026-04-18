import { supabase } from "@/lib/supabase";
import BracketClient from "./BracketClient";
import { unstable_noStore as noStore } from "next/cache";

type Team = {
  id: number;
  conference: "East" | "West";
  seed: number | null;
  name: string;
  abbreviation: string;
  logo_url: string;
};

export default async function Home() {
  noStore();

  const LOCK_TIME = new Date("2026-04-18T10:45:00-06:00");
  const isLocked = new Date() > LOCK_TIME;
  const { data, error } = await supabase.from("teams").select("*");

  if (error) {
    return <main className="p-8">Error loading teams: {error.message}</main>;
  }

  const teams = (data ?? []) as Team[];

  const east = teams
    .filter((t) => t.conference === "East" && t.seed !== null)
    .sort((a, b) => a.seed! - b.seed!);

  const west = teams
    .filter((t) => t.conference === "West" && t.seed !== null)
    .sort((a, b) => a.seed! - b.seed!);

return <BracketClient east={east} west={west} isLocked={isLocked} />;
}