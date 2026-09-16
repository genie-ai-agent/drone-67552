import { useEffect, useState } from "react";
import { db } from "@/lib/db";

type Row = {
  id: number;
  phone: string;
  prompt: string;
  dispatch_phone: string;
  created_at: string;
};

type Dispatcher = { id: number; name: string; phone: string; region: string | null };

export default function DispatchLog() {
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pilots, setPilots] = useState<Dispatcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data } = await db.auth.getSession();
    const u = data?.user ?? null;
    setUser(u);

    const pilotRes = await db
      .from("dispatchers")
      .select("id, name, phone, region")
      .order("id", { ascending: true });
    setPilots((pilotRes.data as Dispatcher[]) ?? []);

    if (u) {
      const res = await db
        .from("submissions")
        .select("id, phone, prompt, dispatch_phone, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setRows((res.data as Row[]) ?? []);
    } else {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data === "signed-in") refresh();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  async function google() {
    setError("");
    const popup = window.open("about:blank", "signin", "width=480,height=640");
    const { data, error: err } = await db.auth.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/auth-callback.html`,
      errorCallbackURL: `${window.location.origin}/auth-callback.html`,
      disableRedirect: true,
    });
    if (err || !data?.url) {
      popup?.close();
      setError("Google sign-in unavailable.");
      return;
    }
    if (popup) popup.location.href = data.url;
    else window.location.href = data.url;
  }

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res =
      mode === "up"
        ? await db.auth.signUp.email({ email, password, name: email.split("@")[0] })
        : await db.auth.signIn.email({ email, password });
    if ((res as any)?.error) {
      setError((res as any).error.message ?? "That didn't work.");
      setBusy(false);
      return;
    }
    setBusy(false);
    setPassword("");
    await refresh();
  }

  async function out() {
    await db.auth.signOut();
    await refresh();
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse bg-[#131312]"></div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-[420px] pt-8">
        <p className="text-[0.9rem] leading-relaxed text-smoke">
          Dispatch log is private. Sign in to read pickups.
        </p>
        <button onClick={google} className="btn-book mt-6">
          <span>Continue with Google</span>
          <span className="arrow">&#8594;</span>
        </button>
        <form onSubmit={withEmail} className="mt-8">
          <label className="label block" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="field mt-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="label mt-6 block" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            className="field mt-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy} className="btn-book mt-8">
            <span>{busy ? "…" : mode === "up" ? "Create account" : "Sign in"}</span>
            <span className="arrow">&#8594;</span>
          </button>
        </form>
        <button
          className="label mt-6 underline underline-offset-4"
          onClick={() => setMode(mode === "up" ? "in" : "up")}
        >
          {mode === "up" ? "Have an account? Sign in" : "New here? Create an account"}
        </button>
        {error && <p className="mt-4 border-l border-paper pl-3 text-[0.85rem]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="label">Signed in / {user.email ?? user.id}</p>
        <button onClick={out} className="label underline underline-offset-4">
          Sign out
        </button>
      </div>

      <h2 className="display mt-8 text-[2rem]">Pilots</h2>
      <div className="mt-4 border-t border-hairline">
        {pilots.map((p) => (
          <div key={p.id} className="flex justify-between gap-4 border-b border-hairline py-3">
            <span>{p.name}</span>
            <span className="text-smoke">
              {p.phone}
              {p.region ? ` / ${p.region}` : ""}
            </span>
          </div>
        ))}
      </div>

      <h2 className="display mt-12 text-[2rem]">Pickups</h2>
      {rows.length === 0 ? (
        <div className="mt-4 border border-hairline p-5">
          <p className="text-[0.9rem] leading-relaxed text-smoke">
            Nothing readable on this account yet. If pickups have come in, this page needs
            your id unlocked. Send this to Genie:
          </p>
          <code className="mt-4 block break-all border border-hairline p-3 text-[0.8rem]">
            {user.id}
          </code>
        </div>
      ) : (
        <div className="mt-4 border-t border-hairline">
          {rows.map((r) => (
            <div key={r.id} className="border-b border-hairline py-4">
              <div className="flex justify-between gap-4">
                <span className="label">
                  {new Date(r.created_at).toLocaleString("en-US")}
                </span>
                <span className="text-[0.85rem] text-smoke">{r.phone}</span>
              </div>
              <p className="mt-2 text-[0.95rem]">{r.prompt}</p>
              <p className="label mt-2">to {r.dispatch_phone}</p>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-4 border-l border-paper pl-3 text-[0.85rem]">{error}</p>}
    </div>
  );
}
