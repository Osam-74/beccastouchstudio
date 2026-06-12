import { useEffect, useState } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';

export default function PwaInstallCard() {
  const [prompt, setPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [alreadyInstalledMsg, setAlreadyInstalledMsg] = useState(false);

  useEffect(() => {
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
    const h = e => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  async function handleInstall() {
    if (installed) {
      setAlreadyInstalledMsg(true);
      setTimeout(() => setAlreadyInstalledMsg(false), 4000);
      return;
    }
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice.catch(() => null);
      setPrompt(null);
    }
  }

  return (
    <div className="rose-card p-7 md:p-9 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
      <div>
        <p className="section-label text-[#b8607a] mb-2">Install app</p>
        <h3 className="font-display text-2xl md:text-3xl text-[#1c1214] mb-2">Put Beccastouch app on your phone.</h3>
        <p className="text-[#6b4a52] text-sm max-w-md">Add us to your phone like a proper app. Book faster, track everything, and never dig through email for a confirmation link again.</p>
      </div>

      {alreadyInstalledMsg ? (
        <div className="flex items-center gap-2 text-[#3d7a53] bg-[#f0faf3] border border-[#b8e0c8] rounded-2xl px-5 py-3 text-sm font-semibold shrink-0">
          <CheckCircle2 size={16}/> Already installed on your device!
        </div>
      ) : prompt ? (
        <button type="button" onClick={handleInstall}
          className="btn-ink whitespace-nowrap shrink-0">
          <Download size={15} /> Install the app
        </button>
      ) : installed ? (
        <button type="button" onClick={handleInstall}
          className="btn-ink whitespace-nowrap shrink-0">
          <Download size={15} /> Install the app
        </button>
      ) : (
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-start gap-3 text-[#7a5460] text-sm max-w-xs">
            <Smartphone size={17} className="mt-0.5 shrink-0 text-[#c8788a]" />
            <p>{isIos ? 'On iPhone: tap Share → "Add to Home Screen".' : 'Open in Chrome and tap the install prompt when it appears.'}</p>
          </div>
          <button type="button" onClick={handleInstall}
            className="btn-ink whitespace-nowrap self-start">
            <Download size={15} /> Install the app
          </button>
        </div>
      )}
    </div>
  );
}
