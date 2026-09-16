import { useEffect, useRef, useState } from "react";
import { Mic, Square, ArrowRight, Loader2 } from "lucide-react";
import { SUBMIT_URL, getDispatcher, type Dispatcher } from "@/lib/db";

type Status = "idle" | "sending" | "booked" | "error";

const FALLBACK: Dispatcher = {
  id: 0,
  name: "Iqram",
  phone: "215-847-5657",
  region: null,
};

function digits(s: string) {
  return s.replace(/\D/g, "");
}

function prettyPhone(raw: string) {
  const d = digits(raw).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function smsHref(to: string, phone: string, prompt: string) {
  const body = `DRONE PICKUP\nFrom: ${phone}\nStuff: ${prompt}`;
  // `?&body=` is the form both iOS and Android accept.
  return `sms:${digits(to).length === 10 ? "+1" + digits(to) : to}?&body=${encodeURIComponent(body)}`;
}

export default function BookingForm() {
  const [phone, setPhone] = useState("");
  const [prompt, setPrompt] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speechOk, setSpeechOk] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [dispatcher, setDispatcher] = useState<Dispatcher | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(true);
  const [lastLink, setLastLink] = useState("");

  const recRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    setSpeechOk(Boolean(SR));

    getDispatcher()
      .then((d) => setDispatcher(d ?? FALLBACK))
      .catch(() => setDispatcher(FALLBACK))
      .finally(() => setDispatchLoading(false));

    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  function stopListening() {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    recRef.current = null;
    setListening(false);
    setInterim("");
  }

  function startListening() {
    const SR =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSpeechOk(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = prompt ? prompt.trim() + " " : "";

    rec.onresult = (e: any) => {
      let final = "";
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += chunk;
        else live += chunk;
      }
      if (final) {
        baseRef.current = (baseRef.current + final).replace(/\s+/g, " ");
        setPrompt(baseRef.current.trim());
      }
      setInterim(live);
    };
    rec.onerror = (e: any) => {
      setListening(false);
      setInterim("");
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setError("Mic blocked. Allow microphone access, or just type it.");
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recRef.current = rec;
    setError("");
    setListening(true);
    rec.start();
  }

  const phoneReady = digits(phone).length >= 10;
  const promptReady = prompt.trim().length >= 2;
  const canBook = phoneReady && promptReady && status !== "sending";

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (listening) stopListening();
    if (!phoneReady) {
      setError("Need a full 10-digit number so the pilot can reach you.");
      return;
    }
    if (!promptReady) {
      setError("Say or type what you want gone.");
      return;
    }

    const to = (dispatcher ?? FALLBACK).phone;
    const cleanPhone = prettyPhone(phone);
    const cleanPrompt = prompt.trim().slice(0, 1000);
    const link = smsHref(to, cleanPhone, cleanPrompt);

    setStatus("sending");
    setError("");

    try {
      const res = await fetch(SUBMIT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          phone: cleanPhone,
          prompt: cleanPrompt,
          dispatch_phone: to,
        }),
      });
      const out = await res.json();
      if (!out?.ok) {
        setStatus("error");
        setError(out?.error ?? "That didn't save. Try again.");
        return;
      }
    } catch {
      setStatus("error");
      setError("Couldn't reach dispatch. Nothing was saved — try again.");
      return;
    }

    setLastLink(link);
    setStatus("booked");
    window.location.href = link;
  }

  if (status === "booked") {
    const d = dispatcher ?? FALLBACK;
    return (
      <section className="pt-8">
        <p className="label">Booked</p>
        <h2 className="display mt-3 text-[3rem] sm:text-[4.5rem]">On its way.</h2>
        <div className="hairline mt-6"></div>
        <dl className="mt-6 space-y-4 text-[0.95rem]">
          <div className="flex justify-between gap-6">
            <dt className="label">Your number</dt>
            <dd className="text-right">{prettyPhone(phone)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="label">Stuff</dt>
            <dd className="max-w-[60%] text-right text-paper">{prompt.trim()}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="label">Dispatch</dt>
            <dd className="text-right">
              {d.name} / {d.phone}
            </dd>
          </div>
        </dl>
        <div className="hairline mt-6"></div>
        <p className="mt-6 text-[0.85rem] leading-relaxed text-smoke">
          Logged with dispatch. A text to {d.name} should have opened — if it didn't,
          tap below.
        </p>
        <a href={lastLink} className="btn-book mt-5 no-underline">
          <span>Open the text</span>
          <ArrowRight className="arrow" size={22} strokeWidth={2.5} />
        </a>
        <button
          type="button"
          className="label mt-6 underline underline-offset-4"
          onClick={() => {
            setStatus("idle");
            setPrompt("");
            setLastLink("");
          }}
        >
          Book another
        </button>
      </section>
    );
  }

  const d = dispatcher ?? FALLBACK;

  return (
    <form onSubmit={book} className="pt-8" noValidate>
      <label className="label block" htmlFor="phone">
        01 / Your number
      </label>
      <input
        id="phone"
        name="phone"
        className="field mt-2"
        inputMode="tel"
        autoComplete="tel"
        placeholder="215 000 0000"
        value={phone}
        onChange={(e) => setPhone(prettyPhone(e.target.value))}
      />

      <div className="mt-10 flex items-end justify-between gap-4">
        <label className="label block" htmlFor="prompt">
          02 / What's gone
        </label>
        <span className="label">{prompt.trim().length}/1000</span>
      </div>

      <div className="mt-2 flex items-start gap-4">
        <textarea
          id="prompt"
          name="prompt"
          className="field min-h-[92px] resize-none"
          rows={3}
          maxLength={1000}
          placeholder={
            speechOk ? "Hit the mic and say it. Or type." : "Type what you want gone."
          }
          value={listening && interim ? `${prompt} ${interim}`.trim() : prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        {speechOk && (
          <button
            type="button"
            aria-label={listening ? "Stop recording" : "Record what you want gone"}
            aria-pressed={listening}
            onClick={listening ? stopListening : startListening}
            className={`relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border transition-colors ${
              listening
                ? "border-paper bg-paper text-ink"
                : "border-hairline bg-transparent text-paper hover:border-paper"
            }`}
          >
            {listening && <span className="mic-ring"></span>}
            {listening ? (
              <Square size={18} strokeWidth={2.5} />
            ) : (
              <Mic size={20} strokeWidth={2} />
            )}
          </button>
        )}
      </div>

      <p className="mt-3 h-5 text-[0.72rem] tracking-[0.14em] uppercase text-smoke">
        {listening
          ? "Listening… speak now"
          : speechOk
            ? "Voice or keyboard, your call"
            : "No mic support in this browser — type it instead"}
      </p>

      {error && (
        <p className="mt-3 border-l border-paper pl-3 text-[0.85rem] text-paper">
          {error}
        </p>
      )}

      <div className="mt-8">
        <button type="submit" className="btn-book" disabled={!canBook}>
          <span>{status === "sending" ? "Dispatching…" : "Book"}</span>
          {status === "sending" ? (
            <Loader2 className="animate-spin" size={22} strokeWidth={2.5} />
          ) : (
            <ArrowRight className="arrow" size={22} strokeWidth={2.5} />
          )}
        </button>
      </div>

      <p className="mt-4 text-[0.72rem] leading-relaxed tracking-[0.1em] uppercase text-smoke">
        {dispatchLoading
          ? "Finding a pilot…"
          : `Routes to ${d.name} / ${d.phone}${d.region ? ` / ${d.region}` : ""}`}
      </p>
    </form>
  );
}
