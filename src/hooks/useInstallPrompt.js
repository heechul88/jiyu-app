import { useState, useEffect } from 'react';

export const useInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return false;

    const result = await installPrompt.prompt();
    setInstallPrompt(null);
    setIsInstallable(false);
    
    return result.outcome === 'accepted';
  };

  return { isInstallable, installApp };
};
