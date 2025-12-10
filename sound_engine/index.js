// Carga el addon nativo compilado por napi-rs
const addon = require('./index.node');

// Reexporta todo lo que marcas con #[napi] en Rust
module.exports = addon;

// Opcionalmente, si quieres ser explícito:
// module.exports = {
//   init: addon.init,
//   DjEngine: addon.DjEngine,
// };
