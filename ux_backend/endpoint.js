const { DjEngine, init } = require("../sound_engine");

init();

const engine = new DjEngine();

module.exports = {
  ping() {
    return engine.ping();
  }
};
