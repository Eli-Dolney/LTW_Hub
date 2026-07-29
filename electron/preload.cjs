const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ltwHub", {
  detectTools: (root) => ipcRenderer.invoke("hub:detect-tools", root),
  chooseToolsRoot: () => ipcRenderer.invoke("hub:choose-tools-root"),
  chooseMedia: () => ipcRenderer.invoke("hub:choose-media"),
  launchTool: (id, root) => ipcRenderer.invoke("hub:launch-tool", id, root),
  openPath: (targetPath) => ipcRenderer.invoke("hub:open-path", targetPath),
});
