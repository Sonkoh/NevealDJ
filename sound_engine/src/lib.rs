use lofty::{
    config::{ParseOptions, WriteOptions},
    file::{AudioFile, BoundTaggedFile, TaggedFileExt},
    read_from_path,
    tag::{Accessor, ItemKey, ItemValue, Tag, TagItem},
};
use napi::bindgen_prelude::*;
use napi::Error;
use napi_derive::napi;
use rodio::OutputStream;
use serde::{Deserialize, Serialize};
use std::{
    fs::OpenOptions,
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

mod engine;

use engine::{analysis::AnalysisEngine, deck::Deck, mixer::Mixer};

#[napi]
pub fn init() -> Result<()> {
    engine::init();
    Ok(())
}

#[napi(object)]
pub struct DeckState {
    pub id: u8,
    pub volume: f64,
    pub pitch_percent: f64,
    pub is_playing: bool,
    pub loaded_track: Option<String>,
}

impl From<&Deck> for DeckState {
    fn from(deck: &Deck) -> Self {
        Self {
            id: deck.id(),
            volume: deck.volume() as f64,
            pitch_percent: deck.pitch_percent() as f64,
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

        if let Ok(result) = AnalysisEngine::analyze_track(path) {
            if let Some(bpm) = result.bpm {
                persist_bpm_metadata(path, bpm, None);
            }
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

    #[napi]
    pub fn set_deck_volume(&mut self, deck_id: u8, volume: f64) -> Result<DeckState> {
        if !volume.is_finite() {
            return Err(Error::from_reason("Volume must be a finite number".to_string()));
        }
        let deck = self.deck_mut(deck_id)?;
        let normalized = volume.max(0.0).min(1.0) as f32;
        deck.set_volume(normalized);
        Ok(DeckState::from(&*deck))
    }

    #[napi]
    pub fn set_deck_pitch(&mut self, deck_id: u8, pitch_percent: f64) -> Result<DeckState> {
        if !pitch_percent.is_finite() {
            return Err(Error::from_reason("Pitch value must be finite".to_string()));
        }
        let deck = self.deck_mut(deck_id)?;
        let clamped = pitch_percent.clamp(-99.0, 100.0) as f32;
        deck.set_pitch_percent(clamped);
        Ok(DeckState::from(&*deck))
    }

    #[napi]
    pub fn clear_deck(&mut self, deck_id: u8) -> Result<DeckState> {
        let deck = self.deck_mut(deck_id)?;
        deck.clear_track();
        Ok(DeckState::from(&*deck))
    }
}

const HOT_CUES_STORAGE_KEY: &str = "NEVEALDJ::HOTCUES";
const BPM_TIMESTAMP_KEY: &str = "NEVEALDJ::BPM_TIMESTAMP";
const BPM_TIMESTAMP_TOLERANCE_SECS: u64 = 2;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[napi(object)]
pub struct HotCueMetadata {
    pub position_seconds: f64,
    pub label: Option<String>,
}

#[napi(object)]
pub struct TrackMetadata {
    pub path: String,
    pub title: String,
    pub artist: Option<String>,
    pub bpm: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub hot_cues: Vec<HotCueMetadata>,
}

#[napi(object)]
pub struct TrackMetadataUpdate {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub bpm: Option<f64>,
    pub hot_cues: Option<Vec<HotCueMetadata>>,
}

#[napi]
pub fn get_track_metadata(file_path: String) -> Result<TrackMetadata> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(Error::from_reason(format!("File not found: {}", file_path)));
    }

    let tagged_file = read_from_path(path).map_err(|err| {
        Error::from_reason(format!("Failed to read metadata from {}: {}", file_path, err))
    })?;

    let analysis_result = match AnalysisEngine::analyze_track(path) {
        Ok(result) => Some(result),
        Err(err) => {
            eprintln!("[analysis] Failed to analyze {}: {}", file_path, err);
            None
        }
    };

    let selected_tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.tags().first());

    let mut title = selected_tag.and_then(|tag| tag.title().map(|value| value.to_string()));
    let artist = selected_tag.and_then(|tag| tag.artist().map(|value| value.to_string()));
    let analysis_bpm = analysis_result.as_ref().and_then(|result| result.bpm);
    let bpm_from_tags = selected_tag
        .and_then(parse_bpm)
        .or_else(|| tagged_file.tags().iter().find_map(parse_bpm));
    let hot_cues = selected_tag.map(read_hot_cues).unwrap_or_default();
    let file_mtime = file_modified_timestamp(path);
    let stored_timestamp = selected_tag
        .and_then(read_bpm_timestamp)
        .or_else(|| tagged_file.tags().iter().find_map(read_bpm_timestamp));

    let mut bpm = bpm_from_tags;
    let mut should_persist_bpm = false;

    match (bpm_from_tags, file_mtime, stored_timestamp) {
        (None, _, _) => {
            if let Some(analysis_value) = analysis_bpm {
                bpm = Some(analysis_value);
                should_persist_bpm = true;
            }
        }
        (Some(_), Some(current_ts), stored) => {
            let matches = stored
                .map(|stored_ts| timestamps_close(stored_ts, current_ts))
                .unwrap_or(false);
            if !matches {
                if let Some(analysis_value) = analysis_bpm {
                    bpm = Some(analysis_value);
                    should_persist_bpm = true;
                }
            }
        }
        (Some(_), None, stored) if stored.is_none() => {
            if let Some(analysis_value) = analysis_bpm {
                bpm = Some(analysis_value);
                should_persist_bpm = true;
            }
        }
        _ => {}
    }

    if should_persist_bpm {
        if let Some(value) = bpm {
            persist_bpm_metadata(path, value, None);
        }
    }

    if title.as_ref().map(|value| value.trim().is_empty()).unwrap_or(true) {
        title = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(|stem| stem.to_string());
    }

    let duration_seconds = duration_in_seconds(tagged_file.properties().duration());
    let default_title = path
        .file_stem()
        .or_else(|| path.file_name())
        .and_then(|val| val.to_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    Ok(TrackMetadata {
        path: path.to_string_lossy().to_string(),
        title: title.unwrap_or(default_title),
        artist,
        bpm: bpm.map(|value| (value * 100.0).round() / 100.0),
        duration_seconds,
        hot_cues,
    })
}

#[napi]
pub fn update_track_metadata(
    file_path: String,
    updates: TrackMetadataUpdate,
) -> Result<TrackMetadata> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(Error::from_reason(format!("File not found: {}", file_path)));
    }

    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|err| Error::from_reason(format!("Failed to open {}: {}", file_path, err)))?;
    let mut tagged_file = BoundTaggedFile::read_from(file, ParseOptions::default()).map_err(
        |err| Error::from_reason(format!("Failed to parse metadata: {}", err)),
    )?;

    {
        let tag = ensure_primary_tag(&mut tagged_file);

        if let Some(title) = updates.title {
            if title.trim().is_empty() {
                tag.remove_title();
            } else {
                tag.set_title(title);
            }
        }

        if let Some(artist) = updates.artist {
            if artist.trim().is_empty() {
                tag.remove_artist();
            } else {
                tag.set_artist(artist);
            }
        }

        if let Some(bpm) = updates.bpm {
            apply_bpm(tag, bpm);
            apply_bpm_timestamp(tag, unix_timestamp_now());
        }

        if let Some(hot_cues) = updates.hot_cues {
            store_hot_cues(tag, &hot_cues)?;
        }
    }

    tagged_file
        .save(WriteOptions::default())
        .map_err(|err| Error::from_reason(format!("Failed to write metadata: {}", err)))?;

    get_track_metadata(file_path)
}

fn parse_bpm(tag: &Tag) -> Option<f64> {
    parse_bpm_for_key(tag, &ItemKey::Bpm)
        .or_else(|| parse_bpm_for_key(tag, &ItemKey::IntegerBpm))
        .or_else(|| parse_custom_bpm_fields(tag))
}

fn parse_bpm_for_key(tag: &Tag, key: &ItemKey) -> Option<f64> {
    tag.get(key).and_then(|item| parse_bpm_value(item.value()))
}

fn parse_custom_bpm_fields(tag: &Tag) -> Option<f64> {
    const ALT_KEYS: [&str; 5] = ["BPM", "TBPM", "TEMPO", "TMPO", "TMP0"];
    tag.items().find_map(|item| match item.key() {
        ItemKey::Unknown(raw_key) if ALT_KEYS.iter().any(|alt| raw_key.eq_ignore_ascii_case(alt)) => {
            parse_bpm_value(item.value())
        }
        _ => None,
    })
}

fn parse_bpm_value(value: &ItemValue) -> Option<f64> {
    match value {
        ItemValue::Text(text) | ItemValue::Locator(text) => parse_bpm_from_str(text),
        ItemValue::Binary(bytes) => std::str::from_utf8(bytes).ok().and_then(parse_bpm_from_str),
    }
}

fn parse_bpm_from_str(input: &str) -> Option<f64> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }

    trimmed
        .parse::<f64>()
        .ok()
        .or_else(|| trimmed.replace(',', ".").parse::<f64>().ok())
        .or_else(|| {
            let digits: String = trimmed
                .chars()
                .filter(|c| c.is_ascii_digit() || matches!(c, '.' | ','))
                .collect();
            if digits.is_empty() {
                None
            } else {
                digits.replace(',', ".").parse::<f64>().ok()
            }
        })
}

fn read_hot_cues(tag: &Tag) -> Vec<HotCueMetadata> {
    tag.items()
        .find_map(|item| match item.key() {
            ItemKey::Unknown(key) if key == HOT_CUES_STORAGE_KEY => match item.value() {
                ItemValue::Text(value) | ItemValue::Locator(value) => {
                    serde_json::from_str::<Vec<HotCueMetadata>>(value).ok()
                }
                _ => None,
            },
            _ => None,
        })
        .unwrap_or_default()
}

fn store_hot_cues(tag: &mut Tag, cues: &[HotCueMetadata]) -> Result<()> {
    remove_hot_cues(tag);

    if cues.is_empty() {
        return Ok(());
    }

    let payload = serde_json::to_string(cues).map_err(|err| {
        Error::from_reason(format!("Failed to serialize hot cues metadata: {}", err))
    })?;

    tag.insert_unchecked(TagItem::new(
        ItemKey::Unknown(HOT_CUES_STORAGE_KEY.to_string()),
        ItemValue::Text(payload),
    ));
    Ok(())
}

fn remove_hot_cues(tag: &mut Tag) {
    tag.retain(|item| match item.key() {
        ItemKey::Unknown(key) => key != HOT_CUES_STORAGE_KEY,
        _ => true,
    });
}

fn apply_bpm(tag: &mut Tag, bpm: f64) {
    if bpm <= 0.0 {
        tag.retain(|item| match item.key() {
            ItemKey::Bpm | ItemKey::IntegerBpm => false,
            _ => true,
        });
        return;
    }

    let formatted_decimal = format!("{:.2}", bpm);
    let rounded = format!("{:.0}", bpm.round());

    tag.insert_text(ItemKey::Bpm, formatted_decimal);
    tag.insert_text(ItemKey::IntegerBpm, rounded);
}

fn persist_bpm_metadata(path: &Path, bpm: f64, timestamp_hint: Option<u64>) {
    let file = match OpenOptions::new().read(true).write(true).open(path) {
        Ok(file) => file,
        Err(err) => {
            eprintln!("[metadata] Unable to open {} for BPM write: {}", path.display(), err);
            return;
        }
    };

    let mut tagged_file = match BoundTaggedFile::read_from(file, ParseOptions::default()) {
        Ok(file) => file,
        Err(err) => {
            eprintln!(
                "[metadata] Unable to parse {} for BPM write: {}",
                path.display(),
                err
            );
            return;
        }
    };

    {
        let tag = ensure_primary_tag(&mut tagged_file);
        apply_bpm(tag, bpm);
        let ts = timestamp_hint.unwrap_or_else(unix_timestamp_now);
        apply_bpm_timestamp(tag, ts);
    }

    if let Err(err) = tagged_file.save(WriteOptions::default()) {
        eprintln!(
            "[metadata] Unable to persist BPM for {}: {}",
            path.display(),
            err
        );
    }
}

fn ensure_primary_tag<'a>(tagged_file: &'a mut BoundTaggedFile) -> &'a mut Tag {
    let tag_type = tagged_file.primary_tag_type();
    if !tagged_file.contains_tag_type(tag_type) {
        tagged_file.insert_tag(Tag::new(tag_type));
    }
    tagged_file
        .primary_tag_mut()
        .expect("primary tag to exist after insertion")
}

fn duration_in_seconds(duration: Duration) -> Option<f64> {
    let seconds = duration.as_secs_f64();
    (seconds > 0.0).then_some(seconds)
}

fn read_bpm_timestamp(tag: &Tag) -> Option<u64> {
    tag.items().find_map(|item| match item.key() {
        ItemKey::Unknown(key) if key == BPM_TIMESTAMP_KEY => match item.value() {
            ItemValue::Text(value) | ItemValue::Locator(value) => value.parse::<u64>().ok(),
            _ => None,
        },
        _ => None,
    })
}

fn apply_bpm_timestamp(tag: &mut Tag, timestamp: u64) {
    tag.insert_unchecked(TagItem::new(
        ItemKey::Unknown(BPM_TIMESTAMP_KEY.to_string()),
        ItemValue::Text(timestamp.to_string()),
    ));
}

fn file_modified_timestamp(path: &Path) -> Option<u64> {
    std::fs::metadata(path)
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
}

fn unix_timestamp_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_secs(0))
        .as_secs()
}

fn timestamps_close(a: u64, b: u64) -> bool {
    if a >= b {
        a - b <= BPM_TIMESTAMP_TOLERANCE_SECS
    } else {
        b - a <= BPM_TIMESTAMP_TOLERANCE_SECS
    }
}
