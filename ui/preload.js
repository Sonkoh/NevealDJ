const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nevealdj', {
  ping: () => ipcRenderer.invoke('ping-engine'),
  expandWindow: (payload) => ipcRenderer.send('ui:expand-window', payload),
  getDecks: () => ipcRenderer.invoke('engine:get-decks'),
  getState: () => ipcRenderer.invoke('engine:get-state'),
  getDeck: (deckId) => ipcRenderer.invoke('engine:get-deck', deckId),
  loadDeck: (deckId, filePath) => ipcRenderer.invoke('engine:load-deck', { deckId, filePath }),
  toggleDeckPlayback: (deckId) => ipcRenderer.invoke('engine:toggle-playback', deckId),
  setDeckVolume: (deckId, volume) => ipcRenderer.invoke('engine:set-deck-volume', { deckId, volume }),
  setDeckPitch: (deckId, pitchPercent) => ipcRenderer.invoke('engine:set-deck-pitch', { deckId, pitchPercent }),
  clearDeck: (deckId) => ipcRenderer.invoke('engine:clear-deck', deckId),
  listDirectories: (targetPath) => ipcRenderer.invoke('browser:list-directories', targetPath),
  getTrackMetadata: (filePath) => ipcRenderer.invoke('metadata:get-track', filePath),
  getConfig: () => ipcRenderer.invoke('config:get'),
  getDeckTrackMetadata: (deckId) => ipcRenderer.invoke('deck:get-track-metadata', deckId),
  subscribeToEngineState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('engine:state', listener);
    return () => {
      ipcRenderer.removeListener('engine:state', listener);
    };
  },
});
