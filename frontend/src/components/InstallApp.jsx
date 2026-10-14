import { useEffect, useState } from 'react';

// Must match the "Package ID" you typed in PWABuilder
const PACKAGE_ID = 'com.samasya.medhi';
const SITE_HOST = 'samysa-medhi-project.vercel.app';
const APK_URL = '/samasya-medhi.apk';

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// Opens the installed APK straight from the browser
function openInstalledApp() {
  const back = encodeURIComponent(window.location.href);
  window.location.href =
    `intent://${SITE_HOST}/#Intent;scheme=https;package=${PACKAGE_ID};S.browser_fallback_url=${back};end`;
}

export default function InstallApp() {
  const [evt, setEvt] = useState(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('idle'); // idle | downloaded
  const apkDownloaded = safeGet('samasyaApk') === '1';

  useEffect(() => {
    const android = /Android/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('installDismissed') === '1'; } catch {}
    if (!android || standalone || dismissed) return;

    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => setOpen(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const t = setTimeout(() => setOpen(true), 1200);
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

  const onInstall = async () => {
    evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === 'accepted') close(); // Chrome shows its own "Open" button
  };

  const onDownload = () => {
    const a = document.createElement('a');
    a.href = APK_URL;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    safeSet('samasyaApk', '1');
    setStep('downloaded');
  };

  if (!open) return null;

  let title = 'Samasya Medhi App';
  let text = 'Install for faster access, like a normal app.';
  let primary;

  if (step === 'downloaded') {
    text = 'Open the downloaded file, tap Install, then come back and tap Open App.';
    primary = { label: 'Open App', run: openInstalledApp };
  } else if (apkDownloaded) {
    text = 'Already installed? Open it directly.';
    primary = { label: 'Open App', run: openInstalledApp };
  } else if (evt) {
    primary = { label: 'Install', run: onInstall };
  } else {
    primary = { label: 'Download App', run: onDownload };
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div>
            <p className="font-bold text-black">{title}</p>
            <p className="text-sm text-gray-600">{text}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={primary.run}
            className="flex-1 rounded-xl bg-yellow-400 py-3 font-semibold text-black">
            {primary.label}
          </button>
          {step === 'downloaded' && !evt ? null : null}
          <button onClick={close} className="rounded-xl px-4 py-3 text-gray-600">
            {step === 'downloaded' ? 'Close' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  );
}