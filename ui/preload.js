const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nevealdj', {
  ping: () => ipcRenderer.invoke('ping-engine'),
  expandWindow: (payload) => ipcRenderer.send('ui:expand-window', payload),
});
