const { ipcMain, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { DjEngine, init } = require("../sound_engine");

init();

const engine = new DjEngine();
const projectRoot = path.join(__dirname, "..");
const filesDir = path.join(projectRoot, "files");

const resolveFilePath = (filePath) => {
    if (!filePath) return null;
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    return path.join(projectRoot, filePath);
};

const loadTestDeck = () => {
    const testFile = path.join(filesDir, "test.wav");
    if (fs.existsSync(testFile)) {
        try {
            engine.loadTrack(1, testFile);
            console.log("[engine] test.mp3 loaded on Deck 1");
        } catch (error) {
            console.error("[engine] failed to load test deck", error);
        }
    } else {
        console.warn("[engine] test.mp3 not found in files/");
    }
};

const broadcastEngineState = () => {
    const state = engine.getState();
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("engine:state", state);
    });
};

module.exports = () => {
    ipcMain.handle("ping-engine", () => {
        return engine.ping();
    });

    ipcMain.handle("engine:get-decks", () => {
        return engine.getDecks();
    });

    ipcMain.handle("engine:get-state", () => {
        return engine.getState();
    });

    ipcMain.handle("engine:get-deck", (_, deckId) => {
        const id = Number(deckId);
        if (!id || id < 1 || id > 6) {
            throw new Error("Invalid deck id");
        }
        return engine.getDeck(id);
    });

    ipcMain.handle("engine:load-deck", (_, { deckId, filePath }) => {
        const id = Number(deckId);
        if (!id || id < 1 || id > 6) {
            throw new Error("Invalid deck id");
        }

        const resolvedPath = resolveFilePath(filePath);
        if (!resolvedPath) {
            throw new Error("File path is required");
        }

        engine.loadTrack(id, resolvedPath);
        const decks = engine.getDecks();
        broadcastEngineState();
        return decks;
    });

    ipcMain.handle("engine:toggle-playback", (_, deckId) => {
        const id = Number(deckId);
        if (!id || id < 1 || id > 6) {
            throw new Error("Invalid deck id");
        }
        const deckState = engine.toggleDeckPlayback(id);
        broadcastEngineState();
        return deckState;
    });

    // loadTestDeck();
    broadcastEngineState();
};
