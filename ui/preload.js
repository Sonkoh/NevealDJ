const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nevealdj', {
  ping: () => ipcRenderer.invoke('ping-engine'),
  expandWindow: (payload) => ipcRenderer.send('ui:expand-window', payload),
  getDecks: () => ipcRenderer.invoke('engine:get-decks'),
  getState: () => ipcRenderer.invoke('engine:get-state'),
  getDeck: (deckId) => ipcRenderer.invoke('engine:get-deck', deckId),
  loadDeck: (deckId, filePath) => ipcRenderer.invoke('engine:load-deck', { deckId, filePath }),
  toggleDeckPlayback: (deckId) => ipcRenderer.invoke('engine:toggle-playback', deckId),
  subscribeToEngineState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('engine:state', listener);
    return () => {
      ipcRenderer.removeListener('engine:state', listener);
    };
  },
});
