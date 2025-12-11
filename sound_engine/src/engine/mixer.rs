// Representa el mixer/crossfader global

pub struct Mixer {
    master_volume: f32,
    deck_channels: Vec<u8>,
}

impl Mixer {
    pub fn new(deck_channels: Vec<u8>) -> Self {
        Mixer {
            master_volume: 1.0,
            deck_channels,
        }
    }

    pub fn master_volume(&self) -> f32 {
        self.master_volume
    }

    pub fn channels(&self) -> &[u8] {
        &self.deck_channels
    }
}
