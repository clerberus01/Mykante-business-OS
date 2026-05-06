import React from 'react';
import { Download, Smartphone, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISSED_STORAGE_KEY = 'mykante-pwa-install-dismissed';

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function getMobilePlatform() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isiOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);

  if (isiOS) return 'ios';
  if (isAndroid) return 'android';
  return null;
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = React.useState<'android' | 'ios' | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const currentPlatform = getMobilePlatform();

    if (!currentPlatform || isStandaloneMode() || localStorage.getItem(DISMISSED_STORAGE_KEY) === 'true') {
      return;
    }

    setPlatform(currentPlatform);
    setVisible(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setPlatform('android');
      setVisible(true);
    };

    const handleInstalled = () => {
      setVisible(false);
      localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!visible || !platform) {
    return null;
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === 'accepted') {
      localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
      setVisible(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] md:hidden">
      <div className="rounded-lg border border-gray-100 bg-white shadow-2xl shadow-os-dark/20 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded bg-os-dark text-white flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-os-text">
              Instalar Mykante OS
            </p>
            <p className="text-[11px] leading-relaxed text-gray-500 mt-1">
              {platform === 'ios'
                ? 'No iPhone, toque em compartilhar e escolha Adicionar a Tela de Inicio.'
                : 'Use o sistema como app instalado neste aparelho.'}
            </p>
            {platform === 'android' && installEvent ? (
              <button
                type="button"
                onClick={() => void install()}
                className="mt-3 px-3 py-2 rounded bg-os-dark text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar app
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1 rounded text-gray-300 hover:text-os-text hover:bg-gray-50 transition-all"
            aria-label="Fechar aviso de instalacao"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
