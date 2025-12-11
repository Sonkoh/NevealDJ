use napi::bindgen_prelude::*;
use napi::Error;
use napi_derive::napi;
use rodio::OutputStream;
use std::path::Path;

mod engine;

use engine::{deck::Deck, mixer::Mixer};

#[napi]
pub fn init() -> Result<()> {
    engine::init();
    Ok(())
}

#[napi(object)]
pub struct DeckState {
    pub id: u8,
    pub volume: f64,
    pub is_playing: bool,
    pub loaded_track: Option<String>,
}

impl From<&Deck> for DeckState {
    fn from(deck: &Deck) -> Self {
        Self {
            id: deck.id(),
            volume: deck.volume() as f64,
            is_playing: deck.is_playing(),
            loaded_track: deck.loaded_track().cloned(),
        }
    }
}

#[napi(object)]
pub struct MixerState {
    pub master_volume: f64,
    pub deck_channels: Vec<u8>,
}

impl From<&Mixer> for MixerState {
    fn from(mixer: &Mixer) -> Self {
        Self {
            master_volume: mixer.master_volume() as f64,
            deck_channels: mixer.channels().to_vec(),
        }
    }
}

#[napi(object)]
pub struct EngineState {
    pub mixer: MixerState,
    pub decks: Vec<DeckState>,
}

#[napi]
pub struct DjEngine {
    mixer: Mixer,
    decks: Vec<Deck>,
    #[allow(dead_code)]
    output_stream: OutputStream,
}

impl DjEngine {
    fn deck_states(&self) -> Vec<DeckState> {
        self.decks.iter().map(DeckState::from).collect()
    }

    fn mixer_state(&self) -> MixerState {
        MixerState::from(&self.mixer)
    }

    fn deck_mut(&mut self, deck_id: u8) -> Result<&mut Deck> {
        self.decks
            .iter_mut()
            .find(|deck| deck.id() == deck_id)
            .ok_or_else(|| Error::from_reason(format!("Deck {} not found", deck_id)))
    }
}

#[napi]
impl DjEngine {
    #[napi(constructor)]
    pub fn new() -> Self {
        let (output_stream, output_handle) =
            OutputStream::try_default().expect("Failed to initialize audio output");
        let decks: Vec<Deck> = (1..=6)
            .map(|id| Deck::new(id, output_handle.clone()))
            .collect();
        let deck_ids: Vec<u8> = decks.iter().map(|deck| deck.id()).collect();
        let mixer = Mixer::new(deck_ids);

        DjEngine {
            mixer,
            decks,
            output_stream,
        }
    }

    #[napi]
    pub fn ping(&self) -> String {
        "sound_engine base ready".to_string()
    }

    #[napi]
    pub fn get_decks(&self) -> Vec<DeckState> {
        self.deck_states()
    }

    #[napi]
    pub fn get_mixer(&self) -> MixerState {
        self.mixer_state()
    }

    #[napi]
    pub fn get_state(&self) -> EngineState {
        EngineState {
            mixer: self.mixer_state(),
            decks: self.deck_states(),
        }
    }

    #[napi]
    pub fn get_deck(&self, deck_id: u8) -> Option<DeckState> {
        self.decks
            .iter()
            .find(|deck| deck.id() == deck_id)
            .map(DeckState::from)
    }

    #[napi]
    pub fn load_track(&mut self, deck_id: u8, file_path: String) -> Result<()> {
        if file_path.trim().is_empty() {
            return Err(Error::from_reason("File path cannot be empty".to_string()));
        }

        let path = Path::new(&file_path);
        if !path.exists() {
            return Err(Error::from_reason(format!("File not found: {}", file_path)));
        }

        let deck = self.deck_mut(deck_id)?;
        deck.load_track(path)
            .map_err(|err| Error::from_reason(err))?;
        Ok(())
    }

    #[napi]
    pub fn toggle_deck_playback(&mut self, deck_id: u8) -> Result<DeckState> {
        let deck = self.deck_mut(deck_id)?;
        deck.toggle_playback();
        Ok(DeckState::from(&*deck))
    }
}
