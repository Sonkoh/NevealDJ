const { ipcMain } = require("electron");
const { DjEngine, init } = require("../sound_engine");

init();

const engine = new DjEngine();

module.exports = () => {
    ipcMain.handle("ping-engine", () => {
        return engine.ping();
    });
}