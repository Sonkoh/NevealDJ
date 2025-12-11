use rodio::{Decoder, OutputStreamHandle, Sink};
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};

// Representa una “bandeja” (Deck A, Deck B, etc.)
pub struct Deck {
    id: u8,
    volume: f32,
    pitch_percent: f32,
    pitch_muted: bool,
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
            pitch_percent: 0.0,
            pitch_muted: false,
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

    pub fn pitch_percent(&self) -> f32 {
        self.pitch_percent
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
        sink.set_speed(Self::pitch_to_speed(self.pitch_percent));
        self.apply_volume_to_sink(&sink);

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
                self.is_playing = true;
                if !self.pitch_muted {
                    sink.play();
                }
            }
        }
    }

    pub fn set_volume(&mut self, volume: f32) {
        let clamped = volume.clamp(0.0, 1.0);
        self.volume = clamped;
        if let Some(sink) = self.sink.as_ref() {
            if !self.pitch_muted {
                sink.set_volume(clamped);
            }
        }
    }

    pub fn set_pitch_percent(&mut self, percent: f32) {
        let clamped = percent.clamp(-100.0, 100.0);
        self.pitch_percent = clamped;
        if let Some(sink) = self.sink.as_ref() {
            if clamped <= Self::PITCH_STOP_THRESHOLD {
                if !self.pitch_muted {
                    self.pitch_muted = true;
                }
                sink.pause();
                sink.set_speed(Self::MIN_PLAYBACK_SPEED);
                sink.set_volume(0.0);
            } else {
                self.pitch_muted = false;
                sink.set_speed(Self::pitch_to_speed(clamped));
                sink.set_volume(self.volume);
                if self.is_playing {
                    sink.play();
                }
            }
        }
    }

    fn pitch_to_speed(percent: f32) -> f32 {
        (1.0 + percent / 100.0).max(Self::MIN_PLAYBACK_SPEED)
    }

    fn apply_volume_to_sink(&self, sink: &Sink) {
        if self.pitch_muted {
            sink.set_volume(0.0);
        } else {
            sink.set_volume(self.volume);
        }
    }
}

impl Deck {
    const PITCH_STOP_THRESHOLD: f32 = -99.0;
    const MIN_PLAYBACK_SPEED: f32 = 0.0001;
}
