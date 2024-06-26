import {app, BrowserWindow, shell, ipcMain} from 'electron'
import {release} from 'node:os'
import {join} from 'node:path'

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(process.env.DIST_ELECTRON, '../public')
    : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')
import {Menu} from 'electron'

const appUrl = import.meta.env.VITE_APP_URL


async function createWindow() {
    Menu.setApplicationMenu(null)
    const {width, height} = require('electron').screen.getPrimaryDisplay().workAreaSize;
    win = new BrowserWindow({
        title: '中车数字平台',
        icon: join(process.env.VITE_PUBLIC, 'favicon.ico'),
        // width: 1024,
        // height: 768,
        // minWidth: '100%',
        // minHeight: '100%',
        // fullscreen: true, // 全屏
        simpleFullscreen: true,
        webPreferences: {
            preload,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            nodeIntegration: true,
            contextIsolation: false,
        },
        // titleBarStyle: 'hidden',
        // // titleBarOverlay: true,
        titleBarOverlay: {
            color: '#2f3241',
            symbolColor: '#74b1be'
        },
        // transparent: true, // 会隐藏放大按钮功能

        // frame: false, //取消window自带的关闭最小化等
        // resizable: false //禁止改变主窗口尺寸
    })
    win.maximize();


    // win.webContents.openDevTools()
    // win.loadURL('http://localhost:12000')
    await  win.loadURL(appUrl).catch(async e => {
        console.log("加载错误={}", e.message)
        if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
            await win.loadURL(url)
            // Open devTool if the app is not packaged
            win.webContents.openDevTools()
        } else {
            await win.loadFile(indexHtml)
        }
    })
    // Test actively push message to the Electron-Renderer
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
        // 存储数据到localStorage，类型未pc端
        win.webContents.executeJavaScript(`localStorage.setItem('loginType', 'pc')`);
    })

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return {action: 'deny'}
    })

    // win.webContents.on('will-navigate', (event, url) => { }) #344
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    win = null
    if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
    if (win) {
        // Focus on the main window if the user tried to open another
        if (win.isMinimized()) win.restore()
        win.focus()
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) {
        allWindows[0].focus()
    } else {
        createWindow()
    }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
    const childWindow = new BrowserWindow({
        webPreferences: {
            preload,
            nodeIntegration: true,
            contextIsolation: false,
        },
    })

    if (process.env.VITE_DEV_SERVER_URL) {
        childWindow.loadURL(`${url}#${arg}`)
    } else {
        childWindow.loadFile(indexHtml, {hash: arg})
    }
})

ipcMain.on("window-all-closed", (event, arg) => {
    console.log("ipcMain收到消息 Received command:", arg);
    win = null;
    if (process.platform !== "darwin") app.quit();
});
