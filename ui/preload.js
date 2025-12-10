const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nevealdj', {
  ping: () => ipcRenderer.invoke("ping-engine")
});