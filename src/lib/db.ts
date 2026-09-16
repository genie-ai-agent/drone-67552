import { createClient } from "@neondatabase/neon-js";

export const db = createClient({
  auth: {
    url: "https://ep-rapid-queen-awjstrrs.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth",
    allowAnonymous: true,
  },
  dataApi: {
    url: "https://ep-rapid-queen-awjstrrs.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1",
  },
});

export const SUBMIT_URL =
  "https://api.genie.jellyjelly.com/forms/z6-Rr0Wkcl5awYqqIbkFG8ft-jcwlNl6";

export type Dispatcher = {
  id: number;
  name: string;
  phone: string;
  region: string | null;
};

export async function getDispatcher(): Promise<Dispatcher | null> {
  const { data, error } = await db
    .from("dispatchers")
    .select("id, name, phone, region")
    .eq("active", true)
    .order("id", { ascending: true })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as Dispatcher;
}
