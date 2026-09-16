import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Loader2, Trash2 } from "lucide-react";
import { db, DELETE_URL } from "@/lib/db";

type Props = { tone?: "light" | "dark" };
type Status = "form" | "sending" | "done";

function digits(s: string) {
  return s.replace(/\D/g, "");
}

function prettyPhone(raw: string) {
  const d = digits(raw).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export default function DeleteAccount({ tone = "light" }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("form");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    firstField.current?.focus();
    db.auth
      .getSession()
      .then(({ data }) => {
        const mail = data?.user?.email;
        if (mail) setEmail(mail);
      })
      .catch(() => {
        /* signed out, nothing to prefill */
      });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function close() {
    setOpen(false);
    setError("");
    if (status === "done") {
      setStatus("form");
      setPhone("");
      setReason("");
      setConfirm("");
    }
  }

  const phoneReady = digits(phone).length >= 10;
  const confirmed = confirm.trim().toUpperCase() === "DELETE";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneReady) {
      setError("Need the full 10-digit number your pickups were booked from.");
      return;
    }
    if (!confirmed) {
      setError('Type DELETE in the box to confirm.');
      return;
    }

    setStatus("sending");
    setError("");

    const body: Record<string, string> = { phone: prettyPhone(phone) };
    if (email.trim()) body.email = email.trim();
    if (reason.trim()) body.reason = reason.trim().slice(0, 500);

    try {
      const res = await fetch(DELETE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(body),
      });
      const out = await res.json();
      if (!out?.ok) {
        setStatus("form");
        setError(out?.error ?? "That didn't go through. Try again.");
        return;
      }
    } catch {
      setStatus("form");
      setError("Couldn't reach dispatch. Nothing was deleted \u2014 try again.");
      return;
    }

    try {
      await db.auth.signOut();
    } catch {
      /* no session to end */
    }

    setStatus("done");
  }

  const btn =
    tone === "light" ? "pill pill-sm pill-ghost-light" : "pill pill-sm pill-outline";

  return (
    <>
      <button type="button" className={btn} onClick={() => setOpen(true)}>
        Delete Account
      </button>

      {open &&
        createPortal(
          <div
            className="scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Delete your Drone account"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="sheet">
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-line text-smoke transition-colors hover:border-ink hover:text-ink"
            >
              <X size={16} strokeWidth={1.5} />
            </button>

            {status === "done" ? (
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper">
                  <Check size={20} strokeWidth={1.75} />
                </div>
                <h2 className="display mt-5 text-[1.9rem]">Account closed.</h2>
                <p className="lede mt-2 text-[0.9rem] text-smoke">
                  Deletion is filed for {prettyPhone(phone)} and you're signed out on
                  this device. Dispatch erases every pickup logged from that number and
                  any sign-in tied to it.
                </p>
                <button type="button" className="pill pill-block mt-7" onClick={close}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink">
                  <Trash2 size={19} strokeWidth={1.5} />
                </div>
                <h2 className="display mt-5 text-[1.75rem] sm:text-[2rem]">
                  Delete your account.
                </h2>
                <p className="lede mt-2 text-[0.875rem] text-smoke">
                  This erases every pickup booked from your number, the prompts you
                  recorded, and any dispatch sign-in tied to it. It can't be undone.
                </p>

                <div className="mt-6">
                  <label className="text-[0.8125rem] text-smoke" htmlFor="del-phone">
                    Your number
                  </label>
                  <input
                    id="del-phone"
                    ref={firstField}
                    className="field mt-2"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="215 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(prettyPhone(e.target.value))}
                  />
                </div>

                <div className="mt-5">
                  <label className="text-[0.8125rem] text-smoke" htmlFor="del-reason">
                    Why, if you want to say <span className="text-quiet">(optional)</span>
                  </label>
                  <textarea
                    id="del-reason"
                    className="field mt-2 min-h-[74px] resize-none leading-relaxed"
                    rows={2}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="mt-5">
                  <label className="text-[0.8125rem] text-smoke" htmlFor="del-confirm">
                    Type <span className="text-ink">DELETE</span> to confirm
                  </label>
                  <input
                    id="del-confirm"
                    className="field mt-2 tracking-[0.14em] uppercase"
                    autoCapitalize="characters"
                    autoComplete="off"
                    placeholder="DELETE"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="mt-4 rounded-xl bg-mist px-4 py-3 text-[0.85rem] text-ink">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="pill pill-block mt-6"
                  disabled={!phoneReady || !confirmed || status === "sending"}
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 className="animate-spin" size={17} strokeWidth={2} />
                      Deleting…
                    </>
                  ) : (
                    "Delete my account"
                  )}
                </button>
                <button
                  type="button"
                  className="quiet-link mt-4 block w-full text-center"
                  onClick={close}
                >
                  Keep my account
                </button>
              </form>
            )}
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
