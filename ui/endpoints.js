const { ipcMain, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { DjEngine, init, getTrackMetadata, updateTrackMetadata } = require("../sound_engine");
const { loadConfig } = require("./config");

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
            let metadata = null;
            try {
                metadata = getTrackMetadata(fullPath);
            } catch (error) {
                console.warn("[metadata] Failed to read tags for", fullPath, error?.message ?? error);
            }
            return {
                name: entry.name,
                path: fullPath,
                title:
                    metadata?.title ??
                    path.basename(entry.name, path.extname(entry.name)),
                artist: metadata?.artist ?? null,
                bpm: metadata?.bpm ?? null,
                durationSeconds: metadata?.durationSeconds ?? null,
                hotCues: metadata?.hotCues ?? [],
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

    ipcMain.handle("engine:set-deck-volume", (_, payload) => {
        const id = Number(payload?.deckId);
        const volume = Number(payload?.volume);
        if (!id || id < 1 || id > 6) {
            throw new Error("Invalid deck id");
        }
        if (!Number.isFinite(volume)) {
            throw new Error("Invalid volume value");
        }
        const normalized = Math.max(0, Math.min(1, volume));
        const deckState = engine.setDeckVolume(id, normalized);
        broadcastEngineState();
        return deckState;
    });

    ipcMain.handle("browser:list-directories", async (_, targetPath) => {
        try {
            return await listDirectories(targetPath);
        } catch (error) {
            throw new Error(`Failed to read directory: ${(error && error.message) || "unknown error"}`);
        }
    });

    ipcMain.handle("metadata:get-track", (_, filePath) => {
        const resolvedPath = resolveFilePath(filePath);
        if (!resolvedPath) {
            throw new Error("File path is required");
        }
        return getTrackMetadata(resolvedPath);
    });

    ipcMain.handle("metadata:update-track", (_, payload) => {
        if (!payload || !payload.filePath) {
            throw new Error("filePath is required");
        }
        const resolvedPath = resolveFilePath(payload.filePath);
        if (!resolvedPath) {
            throw new Error("Unable to resolve file path");
        }
        const updates = payload.updates || payload.metadata;
        if (!updates) {
            throw new Error("No metadata updates provided");
        }
        return updateTrackMetadata(resolvedPath, updates);
    });

    ipcMain.handle("config:get", () => {
        return loadConfig();
    });

    // loadTestDeck();
    broadcastEngineState();
};
