"use client";

import { useEffect, useState } from "react";
import { btn, Card, CardHeader } from "@/components/ui";

type Status = "checking" | "unsupported" | "blocked" | "off" | "on";

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Turns notifications on for this device (Web Push): a sound and a banner when a kid sends a paper, even with the website closed. */
export function AlertsCard() {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub && Notification.permission === "granted" ? "on" : "off");
    })();
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setStatus(permission === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = (await (await fetch("/api/push/key")).json()) as { publicKey: string };
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("The server did not accept this device");
      setStatus("on");
      setMessage("Notifications are on for this device.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not turn notifications on");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setStatus("off");
    setMessage(null);
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    const res = await fetch("/api/push/test", { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as { sent?: number };
    setMessage(res.ok && (json.sent ?? 0) > 0 ? "Test sent. You should hear it now." : "The test did not arrive. Try turning notifications off and on.");
    setBusy(false);
  }

  return (
    <Card className="mt-6 max-w-xl">
      <CardHeader
        title="Sound alerts"
        description="Hear a sound and see a notification when a kid sends a paper, even when this website is closed. Open pages also ring by themselves."
      />
      {status === "unsupported" && (
        <p className="text-sm text-slate-600">
          This browser cannot show notifications. On iPhone, add the website to the Home Screen first (Share, Add to Home Screen), then open it from there.
        </p>
      )}
      {status === "blocked" && <p className="text-sm text-amber-800">Notifications are blocked for this site. Allow them in the browser&apos;s site settings, then reload.</p>}
      {(status === "off" || status === "on") && (
        <div className="flex flex-wrap items-center gap-3">
          {status === "off" ? (
            <button className={btn.primary} disabled={busy} onClick={turnOn}>
              Turn on notifications
            </button>
          ) : (
            <>
              <button className={btn.secondary} disabled={busy} onClick={sendTest}>
                Send a test
              </button>
              <button className={btn.link} disabled={busy} onClick={turnOff}>
                Turn off on this device
              </button>
            </>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-slate-700">
          {message}
        </p>
      )}
    </Card>
  );
}
