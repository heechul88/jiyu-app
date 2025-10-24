import React from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const InstallButton = () => {
  const { isInstallable, installApp } = useInstallPrompt();

  if (!isInstallable) return null;

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      console.log('앱이 설치되었습니다!');
    }
  };

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-600 transition-colors z-50 flex items-center gap-2"
    >
      📱 앱 설치
    </button>
  );
};

export default InstallButton;
