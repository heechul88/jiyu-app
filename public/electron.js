const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // YouTube 동영상 재생을 위해 필요할 수 있음
    },
    icon: path.join(__dirname, 'icons/icon-512.png'),
    titleBarStyle: 'default',
    show: false
  });

  // 창이 준비되면 보여주기
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 개발 모드에서는 로컬 서버, 프로덕션에서는 빌드된 파일
  const startUrl = isDev 
    ? 'http://localhost:5178' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // 개발 모드에서만 개발자 도구 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});