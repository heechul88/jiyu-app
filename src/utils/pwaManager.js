// PWA 설치 및 업데이트 관리
export class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.installButton = null;
        
        this.init();
    }

    init() {
        // PWA 설치 가능 이벤트 리스너
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA 설치 가능');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // PWA 설치 완료 이벤트 리스너
        window.addEventListener('appinstalled', () => {
            console.log('PWA 설치 완료');
            this.isInstalled = true;
            this.hideInstallButton();
        });

        // 이미 설치되었는지 확인
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            console.log('PWA가 이미 설치되어 있음');
            this.isInstalled = true;
        }

        // Service Worker 등록
        this.registerServiceWorker();
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker 등록 성공:', registration);
                
                // 업데이트 확인
                registration.addEventListener('updatefound', () => {
                    console.log('새 버전 감지됨');
                    const newWorker = registration.installing;
                    newWorker?.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdatePrompt();
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker 등록 실패:', error);
            }
        }
    }

    showInstallButton() {
        if (this.isInstalled) return;
        
        // 설치 버튼이 이미 있으면 제거
        this.hideInstallButton();
        
        this.installButton = document.createElement('button');
        this.installButton.innerHTML = `
            <div class="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors">
                <span>📱</span>
                <span class="text-sm font-medium">앱 설치</span>
            </div>
        `;
        this.installButton.className = 'install-prompt';
        this.installButton.onclick = () => this.promptInstall();
        
        document.body.appendChild(this.installButton);
    }

    hideInstallButton() {
        if (this.installButton) {
            this.installButton.remove();
            this.installButton = null;
        }
    }

    async promptInstall() {
        if (!this.deferredPrompt) return;
        
        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log('설치 선택 결과:', outcome);
            
            if (outcome === 'accepted') {
                console.log('사용자가 설치를 수락함');
            } else {
                console.log('사용자가 설치를 거절함');
            }
            
            this.deferredPrompt = null;
            this.hideInstallButton();
        } catch (error) {
            console.error('설치 프롬프트 오류:', error);
        }
    }

    showUpdatePrompt() {
        const updateBanner = document.createElement('div');
        updateBanner.className = 'fixed top-0 left-0 right-0 bg-green-600 text-white p-3 text-center z-50';
        updateBanner.innerHTML = `
            <div class="flex items-center justify-center gap-3">
                <span>🔄 새 버전이 있습니다!</span>
                <button onclick="window.location.reload()" class="px-3 py-1 bg-white text-green-600 rounded text-sm font-medium">
                    업데이트
                </button>
                <button onclick="this.parentElement.parentElement.remove()" class="px-3 py-1 border border-white rounded text-sm">
                    나중에
                </button>
            </div>
        `;
        
        document.body.appendChild(updateBanner);
        
        // 10초 후 자동 제거
        setTimeout(() => {
            if (updateBanner.parentElement) {
                updateBanner.remove();
            }
        }, 10000);
    }

    // 앱 공유 기능
    async shareApp(title = '지유 영상 플레이어', text = '나만의 영상 플레이어 앱', url = window.location.href) {
        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
                console.log('공유 성공');
            } catch (error) {
                console.log('공유 취소 또는 실패:', error);
            }
        } else {
            // 공유 API가 없으면 클립보드에 복사
            try {
                await navigator.clipboard.writeText(url);
                alert('링크가 클립보드에 복사되었습니다!');
            } catch (error) {
                console.error('클립보드 복사 실패:', error);
            }
        }
    }
}

// 전역 PWA 매니저 인스턴스 생성
export const pwaManager = new PWAManager();