use napi::bindgen_prelude::*;
use napi_derive::napi;

mod engine;

#[napi]
pub fn init() -> Result<()> {
    engine::init();
    Ok(())
}

#[napi]
pub struct DjEngine;

#[napi]
impl DjEngine {
    #[napi(constructor)]
    pub fn new() -> Self {
        DjEngine
    }

    #[napi]
    pub fn ping(&self) -> String {
        "sound_engine base ready".to_string()
    }
}
