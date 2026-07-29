const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { existsSync, mkdirSync } = require("node:fs");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const os = require("node:os");

const isDev = !app.isPackaged;

const TOOL_CONFIG = {
  downloader: {
    folders: ["LTW_Downloader"],
    commands: {
      darwin: [["bash", ["run.sh"]]],
      win32: [["cmd.exe", ["/c", "run.bat"]]],
      linux: [["bash", ["run.sh"]]],
    },
  },
  clipper: {
    folders: ["LTW_Splitter", "LTW_Clipper"],
    commands: {
      darwin: [["bash", ["LTW_Video_Splitter.command"]], ["python3", ["launch_gui.py"]]],
      win32: [["cmd.exe", ["/c", "LTW_Video_Splitter.bat"]], ["python", ["launch_gui.py"]]],
      linux: [["python3", ["launch_gui.py"]]],
    },
  },
  audio: {
    folders: ["LTW_Audio", "LTW_Audio_Spiltter"],
    commands: {
      darwin: [["bash", ["quick_start.sh"]], ["python3", ["-m", "streamlit", "run", "app.py"]]],
      win32: [["cmd.exe", ["/c", "quick_start.bat"]], ["python", ["-m", "streamlit", "run", "app.py"]]],
      linux: [["bash", ["quick_start.sh"]], ["python3", ["-m", "streamlit", "run", "app.py"]]],
    },
  },
  editor: {
    folders: ["LTW Photoshop", "LTW_EzEdit"],
    commands: {
      darwin: [["npm", ["run", "start", "--prefix", "photoshop-clone"]]],
      win32: [["npm.cmd", ["run", "start", "--prefix", "photoshop-clone"]]],
      linux: [["npm", ["run", "start", "--prefix", "photoshop-clone"]]],
    },
  },
  tts: {
    folders: [path.join("TTS-MAc", "TTS"), "TTS"],
    webUrl: "http://127.0.0.1:7861",
    needsNumbaCache: true,
    useCachedModelsOffline: true,
    commands: {
      darwin: [["bash", ["scripts/start_ui.sh"]], ["python3", ["-m", "streamlit", "run", "app.py"]]],
      win32: [["python", ["-m", "streamlit", "run", "app.py"]]],
      linux: [["bash", ["scripts/start_ui.sh"]], ["python3", ["-m", "streamlit", "run", "app.py"]]],
    },
  },
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#0b0d10",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    const allowed = isDev ? url.startsWith("http://127.0.0.1:5173") : url.startsWith("file:");
    if (!allowed) event.preventDefault();
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function defaultToolsRoot() {
  return path.join(os.homedir(), "Documents", "GitHub");
}

function candidateRoots(toolsRoot) {
  if (toolsRoot) return [path.resolve(toolsRoot)];
  return [
    path.join(os.homedir(), "Desktop", "Projects"),
    path.join(os.homedir(), "Desktop", "Python Scripts"),
    defaultToolsRoot(),
    path.join(os.homedir(), "GitHub"),
    path.join(os.homedir(), "Developer"),
    path.join(os.homedir(), "Projects"),
    path.join(os.homedir(), "Documents"),
  ];
}

function resolveToolPath(config, toolsRoot) {
  for (const root of candidateRoots(toolsRoot)) {
    for (const folder of config.folders) {
      const candidate = path.join(root, folder);
      if (existsSync(candidate)) return candidate;
    }
  }
  return path.join(candidateRoots(toolsRoot)[0], config.folders[0]);
}

function resolveCommand(config, cwd) {
  const candidates = config.commands[process.platform] ?? config.commands.linux;
  return candidates.find(([_command, args]) => {
    const launcher = args.find((argument) => /\.(sh|command|bat|py)$/i.test(argument));
    return !launcher || existsSync(path.join(cwd, launcher));
  });
}

function openWebUiWhenReady(url, attemptsRemaining = 150) {
  const request = http.get(url, (response) => {
    response.resume();
    if (response.statusCode && response.statusCode < 500) {
      shell.openExternal(url);
      return;
    }
    if (attemptsRemaining > 1) {
      setTimeout(() => openWebUiWhenReady(url, attemptsRemaining - 1), 1000);
    }
  });

  request.setTimeout(1500, () => request.destroy());
  request.on("error", () => {
    if (attemptsRemaining > 1) {
      setTimeout(() => openWebUiWhenReady(url, attemptsRemaining - 1), 1000);
    }
  });
}

ipcMain.handle("hub:detect-tools", (_event, toolsRoot) => {
  return Object.entries(TOOL_CONFIG).map(([id, config]) => {
    const toolPath = resolveToolPath(config, toolsRoot);
    return { id, installed: existsSync(toolPath), path: toolPath };
  });
});

ipcMain.handle("hub:choose-tools-root", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose the folder containing your LTW tools",
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("hub:choose-media", async () => {
  const result = await dialog.showOpenDialog({
    title: "Add source media",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Media", extensions: ["mp4", "mov", "mkv", "webm", "mp3", "wav", "m4a", "flac"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("hub:launch-tool", (_event, id, toolsRoot) => {
  const config = TOOL_CONFIG[id];
  if (!config) return { ok: false, message: "Unknown tool." };

  const cwd = resolveToolPath(config, toolsRoot);
  if (!existsSync(cwd)) {
    return { ok: false, message: `${config.folders[0]} was not found in your tool folders.` };
  }

  const resolvedCommand = resolveCommand(config, cwd);
  if (!resolvedCommand) {
    return { ok: false, message: `${path.basename(cwd)} is installed, but its launcher was not found.` };
  }

  const [command, args] = resolvedCommand;
  const environment = { ...process.env };

  if (config.needsNumbaCache) {
    const numbaCache = path.join(app.getPath("userData"), "numba-cache");
    mkdirSync(numbaCache, { recursive: true });
    environment.NUMBA_CACHE_DIR = numbaCache;
  }

  if (config.useCachedModelsOffline) {
    const chatterboxCache = path.join(
      os.homedir(),
      ".cache",
      "huggingface",
      "hub",
      "models--ResembleAI--chatterbox",
    );
    if (existsSync(chatterboxCache)) {
      environment.HF_HUB_OFFLINE = "1";
    }
  }

  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    env: environment,
  });
  child.on("error", () => {});
  child.unref();

  if (config.webUrl) {
    // Give start_ui.sh time to stop a stale server before polling. Without
    // this delay Hub can mistake the old process for the newly launched UI.
    setTimeout(() => openWebUiWhenReady(config.webUrl), 3000);
    return {
      ok: true,
      message: `${path.basename(cwd)} is loading. Its web UI will open when ready.`,
    };
  }

  return { ok: true, message: `${path.basename(cwd)} is starting.` };
});

ipcMain.handle("hub:open-path", async (_event, targetPath) => {
  if (typeof targetPath !== "string" || !path.isAbsolute(targetPath)) {
    return "Invalid path.";
  }
  return shell.openPath(targetPath);
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
