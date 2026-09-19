import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check, Loader2 } from "lucide-react";
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
  const d = dispatcher ?? FALLBACK;

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (listening) stopListening();
    if (!phoneReady) {
      setError("Need a full 10-digit number so dispatch can reach you.");
      return;
    }
    if (!promptReady) {
      setError("Say or type what you want gone.");
      return;
    }

    const to = d.phone;
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
    return (
      <div className="card rise p-6 sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper">
          <Check size={20} strokeWidth={1.75} />
        </div>
        <h2 className="display mt-5 text-[2rem] sm:text-[2.4rem]">On its way.</h2>
        <p className="lede mt-2 text-[0.9rem] text-smoke">
          A text to {d.name} should have opened. If it didn't, tap below.
        </p>

        <dl className="mt-7 divide-y divide-line border-y border-line text-[0.9rem]">
          <div className="flex justify-between gap-6 py-3">
            <dt className="text-smoke">Your number</dt>
            <dd className="text-right">{prettyPhone(phone)}</dd>
          </div>
          <div className="flex justify-between gap-6 py-3">
            <dt className="text-smoke">Stuff</dt>
            <dd className="max-w-[62%] text-right">{prompt.trim()}</dd>
          </div>
          <div className="flex justify-between gap-6 py-3">
            <dt className="text-smoke">Dispatch</dt>
            <dd className="text-right">
              {d.name} / {d.phone}
            </dd>
          </div>
        </dl>

        <a href={lastLink} className="pill pill-block mt-7">
          Open the text
        </a>
        <button
          type="button"
          className="quiet-link mt-5 block"
          onClick={() => {
            setStatus("idle");
            setPrompt("");
            setLastLink("");
          }}
        >
          Book another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={book} className="card p-6 sm:p-8" noValidate>
      <h2 className="display text-[1.5rem] sm:text-[1.75rem]">
        What should<br />we take?
      </h2>
      <p className="lede mt-2 text-[0.875rem] text-smoke">
Two fields. Say the trash, it leaves.
      </p>

      <div className="mt-7">
        <label className="text-[0.8125rem] text-smoke" htmlFor="phone">
          Your number
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
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-4">
          <label className="text-[0.8125rem] text-smoke" htmlFor="prompt">
            What's gone
          </label>
          <span className="text-[0.75rem] text-quiet">{prompt.trim().length}/1000</span>
        </div>
        <div className="mt-2 flex items-start gap-3">
          <textarea
            id="prompt"
            name="prompt"
            className="field min-h-[96px] resize-none leading-relaxed"
            rows={3}
            maxLength={1000}
            placeholder={
              speechOk ? "Tap the mic and say it. Or type." : "Type what you want gone."
            }
            value={listening && interim ? `${prompt} ${interim}`.trim() : prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          {speechOk && (
            <button
              type="button"
              className="mic"
              data-on={listening ? "true" : "false"}
              aria-label={listening ? "Stop recording" : "Record what you want gone"}
              aria-pressed={listening}
              onClick={listening ? stopListening : startListening}
            >
              {listening && <span className="mic-ring"></span>}
              {listening ? (
                <Square size={16} strokeWidth={2} />
              ) : (
                <Mic size={19} strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
        <p className="mt-2 h-4 text-[0.75rem] text-quiet">
          {listening
            ? "Listening… speak now"
            : speechOk
              ? "Voice or keyboard, your call."
              : "No mic in this browser — type it instead."}
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-mist px-4 py-3 text-[0.85rem] text-ink">{error}</p>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-mist px-4 py-4">
        <p className="text-[0.8125rem] font-normal">Cheaper, because you're in the mission.</p>
        <p className="lede mt-1.5 text-[0.8125rem] text-smoke">
          Using Drone costs less than a hauler. Every pickup is captured on video, and
          that footage feeds our data layer, teaching machines the work. Our mission is
          to clean all trash without human labor, and you're funding it, so you pay less
          for it.
        </p>
      </div>

      <button type="submit" className="pill pill-block mt-4" disabled={!canBook}>
        {status === "sending" ? (
          <>
            <Loader2 className="animate-spin" size={17} strokeWidth={2} />
            Dispatching…
          </>
        ) : (
          "Book"
        )}
      </button>

      <p className="mt-3 text-center text-[0.75rem] text-quiet">
        {dispatchLoading
          ? "Finding dispatch…"
          : `Routes to ${d.name} · ${d.phone}${d.region ? ` · ${d.region}` : ""}`}
      </p>
    </form>
  );
}
