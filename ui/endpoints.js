const { ipcMain, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { DjEngine, init } = require("../sound_engine");

init();

const engine = new DjEngine();
const projectRoot = path.join(__dirname, "..");
const filesDir = path.join(projectRoot, "files");
const systemRoot = path.parse(process.cwd()).root || path.sep;

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

const SUPPORTED_AUDIO_EXTENSIONS = new Set([".mp3", ".wav"]);

const listDirectories = async (targetPath) => {
    const basePath = targetPath ? path.resolve(targetPath) : systemRoot;
    const entries = await fsp.readdir(basePath, { withFileTypes: true });
    const directories = entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) => ({
            name: entry.name,
            path: path.join(basePath, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const files = entries
        .filter((entry) => entry.isFile())
        .filter((entry) => SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map((entry) => {
            const fullPath = path.join(basePath, entry.name);
            const title = path.basename(entry.name, path.extname(entry.name));
            return {
                name: entry.name,
                path: fullPath,
                title,
                artist: "Desconocido",
                bpm: "--",
                duration: "--",
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    const parent = path.resolve(basePath) === systemRoot ? null : path.dirname(basePath);
    return { path: basePath, parent, directories, files };
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

    ipcMain.handle("explorer:list-directories", async (_, targetPath) => {
        try {
            return await listDirectories(targetPath);
        } catch (error) {
            throw new Error(`Failed to read directory: ${(error && error.message) || "unknown error"}`);
        }
    });

    loadTestDeck();
    broadcastEngineState();
};
