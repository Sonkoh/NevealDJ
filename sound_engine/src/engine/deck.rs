use rodio::{Decoder, OutputStreamHandle, Sink};
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};

// Representa una “bandeja” (Deck A, Deck B, etc.)
pub struct Deck {
    id: u8,
    volume: f32,
    is_playing: bool,
    loaded_track: Option<String>,
    track_path: Option<PathBuf>,
    sink: Option<Sink>,
    output_handle: OutputStreamHandle,
}

impl Deck {
    pub fn new(id: u8, output_handle: OutputStreamHandle) -> Self {
        Deck {
            id,
            volume: 1.0,
            is_playing: false,
            loaded_track: None,
            track_path: None,
            sink: None,
            output_handle,
        }
    }

    pub fn id(&self) -> u8 {
        self.id
    }

    pub fn volume(&self) -> f32 {
        self.volume
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing
    }

    pub fn loaded_track(&self) -> Option<&String> {
        self.loaded_track.as_ref()
    }

    pub fn load_track(&mut self, track_path: &Path) -> Result<(), String> {
        let file = File::open(track_path).map_err(|err| err.to_string())?;
        let source = Decoder::new(BufReader::new(file)).map_err(|err| err.to_string())?;
        let sink = Sink::try_new(&self.output_handle)
            .map_err(|err| format!("Audio sink error: {}", err))?;

        sink.append(source);
        sink.pause();

        self.sink = Some(sink);
        self.track_path = Some(track_path.to_path_buf());
        self.loaded_track = track_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string());
        self.is_playing = false;
        Ok(())
    }

    pub fn clear_track(&mut self) {
        if let Some(sink) = &self.sink {
            sink.stop();
        }
        self.sink = None;
        self.track_path = None;
        self.loaded_track = None;
        self.is_playing = false;
    }

    pub fn toggle_playback(&mut self) {
        if let Some(sink) = self.sink.as_ref() {
            if self.is_playing {
                sink.pause();
                self.is_playing = false;
            } else {
                sink.play();
                self.is_playing = true;
            }
        }
    }
}
