import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, resolve } from 'path'
import { createRequire } from 'node:module'
import { mkdir, stat } from 'node:fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
let stopBackend

async function ensureWritableDirectory(candidate, fallback, label) {
  const candidatePath = resolve(candidate)
  const fallbackPath = resolve(fallback)
  let candidateInfo
  let candidateError

  try {
    await mkdir(candidatePath, { recursive: true })
    candidateInfo = await stat(candidatePath)
  } catch (error) {
    candidateError = error
  }

  if (candidateInfo?.isDirectory()) return candidatePath
  if (candidatePath === fallbackPath) {
    if (candidateError) throw candidateError
    throw new Error(`${label} path exists but is not a directory: ${candidatePath}`)
  }

  console.warn(
    `Invalid ${label} path (${candidatePath}); using ${fallbackPath}:`,
    candidateError?.message || 'not a directory'
  )
  let fallbackInfo
  try {
    await mkdir(fallbackPath, { recursive: true })
    fallbackInfo = await stat(fallbackPath)
  } catch (error) {
    console.error(
      `Cannot prepare ${label} directory. Configured path: ${candidatePath}; fallback path: ${fallbackPath}`,
      error
    )
    throw error
  }

  if (!fallbackInfo.isDirectory()) {
    throw new Error(`${label} fallback path exists but is not a directory: ${fallbackPath}`)
  }
  return fallbackPath
}

async function startBackend() {
  process.env.NODE_ENV ||= app.isPackaged ? 'production' : 'development'

  const backendDir = app.isPackaged
    ? join(process.resourcesPath, 'nefapi-cfdis')
    : join(app.getAppPath(), 'src', 'main', 'nefapi-cfdis')
  const userDataDir = join(app.getPath('userData'), 'nefapi-cfdis')
  const uploadsDir = await ensureWritableDirectory(
    process.env.PRODUCT_UPLOADS_DIR || join(userDataDir, 'uploads'),
    join(userDataDir, 'uploads'),
    'product uploads'
  )
  await ensureWritableDirectory(
    join(uploadsDir, 'products'),
    join(userDataDir, 'uploads', 'products'),
    'product images'
  )
  process.env.PRODUCT_UPLOADS_DIR = uploadsDir
  process.env.PDF_STORAGE_PATH = await ensureWritableDirectory(
    process.env.PDF_STORAGE_PATH || join(userDataDir, 'pdfs'),
    join(userDataDir, 'pdfs'),
    'invoice PDFs'
  )
  process.env.COTIZACION_PDF_STORAGE_PATH = await ensureWritableDirectory(
    process.env.COTIZACION_PDF_STORAGE_PATH || join(userDataDir, 'cotizaciones'),
    join(userDataDir, 'cotizaciones'),
    'quotation PDFs'
  )

  const backendInfo = await stat(backendDir).catch((error) => {
    throw new Error(`Backend directory not found at ${backendDir}`, { cause: error })
  })
  if (!backendInfo.isDirectory()) {
    throw new Error(`Backend path is not a directory: ${backendDir}`)
  }

  const backendRequire = createRequire(join(backendDir, 'package.json'))
  const { startServer, stopServer: closeBackend } = backendRequire('./server.js')
  stopBackend = closeBackend
  await startServer()
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    // Habilita el almacenamiento de contraseñas de Chromium.
    passwordStore: 'basic'
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app
  .whenReady()
  .then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // IPC test
    ipcMain.on('ping', () => console.log('pong'))

    await startBackend()
    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error) => {
    console.error('Unable to initialize the desktop app:', error)
    dialog.showErrorBox('No se pudo iniciar la aplicación', error.message)
    app.quit()
  })

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let isShuttingDown = false
app.on('before-quit', (event) => {
  if (!stopBackend || isShuttingDown) return
  event.preventDefault()
  isShuttingDown = true
  stopBackend()
    .catch((error) => console.error('Error while stopping local API:', error))
    .finally(() => app.exit(0))
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
