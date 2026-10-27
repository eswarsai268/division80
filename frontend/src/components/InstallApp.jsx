import { useEffect, useState } from "react";

export default function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [open, setOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const android = /Android/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem("installDismissed") === "1"; } catch {}
    if (!android || standalone || dismissed) return undefined;

    const onPrompt = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const onInstalled = () => setOpen(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = () => {
    try { sessionStorage.setItem("installDismissed", "1"); } catch {}
    setOpen(false);
  };

  const install = async () => {
    if (!installPrompt) {
      if (showInstructions) close();
      else setShowInstructions(true);
      return;
    }
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === "accepted") close();
  };

  if (!open) return null;

  const text = showInstructions
    ? "In your browser menu, choose Install app or Add to Home screen. Open it once while online to save the roster for offline search and printing."
    : "Install for faster access. Your roster can be saved for offline search and printing after you sign in online.";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-12 w-12 rounded-xl" />
          <div>
            <p className="font-bold text-black">Booth Verification</p>
            <p className="text-sm text-gray-600">{text}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={install} className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white">
            {installPrompt ? "Install" : showInstructions ? "Got it" : "How to install"}
          </button>
          <button onClick={close} className="rounded-xl px-4 py-3 text-gray-600">Not now</button>
        </div>
      </div>
    </div>
  );
}
