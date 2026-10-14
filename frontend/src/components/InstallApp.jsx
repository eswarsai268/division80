import { useEffect, useState } from 'react';

export default function InstallApp() {
  const [evt, setEvt] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const android = /Android/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('installDismissed') === '1'; } catch {}
    if (!android || standalone || dismissed) return;

    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const t = setTimeout(() => setOpen(true), 1500);   // popup after 1.5 sec
    const onInstalled = () => setOpen(false);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const close = () => {
    try { sessionStorage.setItem('installDismissed', '1'); } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div>
            <p className="font-bold text-black">Samasya Medhi App</p>
            <p className="text-sm text-gray-600">Install for faster access, like a normal app.</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {evt ? (
            <button onClick={() => { evt.prompt(); close(); }}
              className="flex-1 rounded-xl bg-yellow-400 py-3 font-semibold text-black">
              Install
            </button>
          ) : (
            <a href="/samasya-medhi.apk" download onClick={close}
              className="flex-1 rounded-xl bg-yellow-400 py-3 text-center font-semibold text-black">
              Download App
            </a>
          )}
          <button onClick={close} className="rounded-xl px-4 py-3 text-gray-600">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}