// Representa una “bandeja” (Deck A, Deck B, etc.)

pub struct Deck {
    pub id: u8,
    // luego: ruta del track, bpm, pitch, estado, etc.
}

impl Deck {
    pub fn new(id: u8) -> Self {
        Deck { id }
    }
}
