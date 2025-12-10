const { ipcMain } = require("electron");
const backend = require("../ux_backend/endpoint.js");

module.exports = () => {
    ipcMain.handle("ping-engine", () => {
        return backend.ping();
    });
}