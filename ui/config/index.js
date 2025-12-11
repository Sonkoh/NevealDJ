const fs = require("node:fs");
const path = require("node:path");

const CONFIG_FILE = path.join(__dirname, "app-config.json");
const DEFAULTS = Object.freeze({
    mixer: {
        visibleDeckCount: 2,
    },
});

const MAX_DECKS = 6;

const clampVisibleDecks = (value) => {
    if (!Number.isFinite(value)) {
        return DEFAULTS.mixer.visibleDeckCount;
    }
    const normalized = Math.floor(value);
    if (normalized <= 0) {
        return DEFAULTS.mixer.visibleDeckCount;
    }
    return Math.min(MAX_DECKS, normalized);
};

const normalizeConfig = (input) => {
    const mixer = {
        ...DEFAULTS.mixer,
        ...(input?.mixer ?? {}),
    };
    const visible = clampVisibleDecks(Number(mixer.visibleDeckCount));
    return {
        mixer: {
            visibleDeckCount: visible,
        },
    };
};

const loadConfig = () => {
    try {
        const existing = fs.readFileSync(CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(existing);
        return normalizeConfig(parsed);
    } catch (error) {
        console.warn(
            "[config] Using default configuration, file unavailable or invalid:",
            error?.message ?? error,
        );
        return DEFAULTS;
    }
};

module.exports = {
    loadConfig,
    configPath: CONFIG_FILE,
    defaults: DEFAULTS,
};
