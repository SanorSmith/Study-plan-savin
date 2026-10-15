"use client";

import { useEffect, useState } from "react";
import { btn, Card, CardHeader } from "@/components/ui";

type InstallPrompt = Event & { prompt: () => Promise<void> };

/** "Install as an app" card for parents: one tap on Android/Chrome, a short how-to on iPhone. Hidden once installed. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [mode, setMode] = useState<"hidden" | "ios" | "other">("hidden");

  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only facts after load
    setMode(ios ? "ios" : "other");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;
  if (mode === "other" && !prompt) return null; // browsers without a one-tap install: nothing useful to show

  return (
    <Card className="mt-6 max-w-xl">
      <CardHeader
        title="Use it as an app"
        description={
          mode === "ios"
            ? "On iPhone: tap the Share button in Safari, then Add to Home Screen. It opens full screen like an app."
            : "Add Study Plan to your home screen. It opens full screen like an app, without the browser bar."
        }
      />
      {prompt && (
        <button
          className={btn.primary}
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          Install the app
        </button>
      )}
    </Card>
  );
}
