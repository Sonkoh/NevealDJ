// Módulo para análisis de audio (BPM, waveform, key, etc.)

use std::{fs::File, path::Path};

use rustfft::{num_complex::Complex32, FftPlanner};
use symphonia::{
    core::{
        audio::SampleBuffer,
        codecs::DecoderOptions,
        errors::Error as SymphoniaError,
        formats::FormatOptions,
        io::MediaSourceStream,
        meta::MetadataOptions,
        probe::Hint,
    },
    default::{get_codecs, get_probe},
};

const MAX_ANALYSIS_SECONDS: usize = 90;
const BPM_MIN: f64 = 60.0;
const BPM_MAX: f64 = 200.0;
const TARGET_FLUX_RATE: f64 = 220.0;
const FLUX_WINDOW: usize = 4096;
const FLUX_HOP: usize = 256;

pub struct AnalysisResult {
    pub bpm: Option<f64>,
}

pub struct AnalysisEngine;

impl AnalysisEngine {
    pub fn analyze_track<P: AsRef<Path>>(path: P) -> Result<AnalysisResult, String> {
        let (samples, sample_rate) = Self::decode_mono_samples(path)?;
        let bpm = Self::estimate_bpm_from_samples(&samples, sample_rate);
        Ok(AnalysisResult { bpm })
    }

    fn decode_mono_samples<P: AsRef<Path>>(path: P) -> Result<(Vec<f32>, usize), String> {
        let path_ref = path.as_ref();
        let file = File::open(path_ref).map_err(|err| err.to_string())?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(ext) = path_ref.extension().and_then(|ext| ext.to_str()) {
            hint.with_extension(ext);
        }

        let probed = get_probe()
            .format(
                &hint,
                mss,
                &FormatOptions::default(),
                &MetadataOptions::default(),
            )
            .map_err(|err| err.to_string())?;
        let mut format = probed.format;

        let track = match format.default_track() {
            Some(track) => track,
            None => return Err("No se encontró pista de audio".into()),
        };
        let track_id = track.id;
        let codec_params = track.codec_params.clone();
        let sample_rate = match codec_params.sample_rate {
            Some(rate) if rate > 0 => rate as usize,
            _ => return Err("Sample rate inválido".into()),
        };

        let mut decoder = get_codecs()
            .make(&codec_params, &DecoderOptions::default())
            .map_err(|err| err.to_string())?;

        let mut mono_samples = Vec::new();
        let target_samples = sample_rate * MAX_ANALYSIS_SECONDS;

        while mono_samples.len() < target_samples {
            let packet = match format.next_packet() {
                Ok(packet) => packet,
                Err(SymphoniaError::IoError(_)) => break,
                Err(SymphoniaError::ResetRequired) => {
                    decoder.reset();
                    continue;
                }
                Err(err) => return Err(err.to_string()),
            };

            if packet.track_id() != track_id {
                continue;
            }

            let decoded = match decoder.decode(&packet) {
                Ok(decoded) => decoded,
                Err(SymphoniaError::IoError(_)) => break,
                Err(SymphoniaError::DecodeError(_)) => continue,
                Err(SymphoniaError::ResetRequired) => {
                    decoder.reset();
                    continue;
                }
                Err(err) => return Err(err.to_string()),
            };

            let spec = *decoded.spec();
            let chan_count = spec.channels.count().max(1);
            let duration = decoded.capacity() as u64;
            let mut sample_buf = SampleBuffer::<f32>::new(duration, spec);
            sample_buf.copy_interleaved_ref(decoded);

            for chunk in sample_buf.samples().chunks(chan_count) {
                let sum: f32 = chunk.iter().copied().sum();
                mono_samples.push(sum / chan_count as f32);
            }
        }

        if mono_samples.len() < sample_rate {
            return Err("No se pudieron decodificar suficientes muestras".into());
        }

        Ok((mono_samples, sample_rate))
    }

    fn estimate_bpm_from_samples(samples: &[f32], sample_rate: usize) -> Option<f64> {
        if samples.is_empty() || sample_rate == 0 {
            return None;
        }

        let (flux, flux_rate) = Self::spectral_flux_envelope(samples, sample_rate);
        Self::estimate_bpm_from_envelope(&flux, flux_rate)
    }

    fn spectral_flux_envelope(samples: &[f32], sample_rate: usize) -> (Vec<f32>, f64) {
        let window = FLUX_WINDOW.min(samples.len());
        if window < 512 {
            return (Vec::new(), 0.0);
        }

        let hop = FLUX_HOP.min(window / 4).max(1);
        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(window);
        let mut buffer = vec![Complex32::new(0.0, 0.0); window];
        let mut prev_mag = vec![0.0f32; window / 2];
        let mut envelope = Vec::new();

        let hann: Vec<f32> = (0..window)
            .map(|i| {
                0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / window as f32).cos()
            })
            .collect();

        let mut idx = 0usize;
        while idx + window <= samples.len() {
            for i in 0..window {
                buffer[i].re = samples[idx + i] * hann[i];
                buffer[i].im = 0.0;
            }

            fft.process(&mut buffer);

            let mut flux = 0.0f32;
            for bin in 1..window / 2 {
                let mag = buffer[bin].norm();
                let diff = (mag - prev_mag[bin]).max(0.0);
                flux += diff;
                prev_mag[bin] = mag;
            }
            envelope.push(flux);
            idx += hop;
        }

        let current_rate = sample_rate as f64 / hop as f64;
        let mut envelope_rate = current_rate;
        let target_rate = TARGET_FLUX_RATE;
        let downsample_factor = (current_rate / target_rate).round().max(1.0) as usize;

        if downsample_factor <= 1 {
            return (envelope, envelope_rate);
        }

        let mut downsampled = Vec::with_capacity(envelope.len() / downsample_factor + 1);
        let mut i = 0;
        while i < envelope.len() {
            let end = (i + downsample_factor).min(envelope.len());
            let slice = &envelope[i..end];
            let avg = slice.iter().copied().sum::<f32>() / slice.len() as f32;
            downsampled.push(avg);
            i += downsample_factor;
        }
        envelope_rate /= downsample_factor as f64;
        (downsampled, envelope_rate)
    }

    fn estimate_bpm_from_envelope(envelope: &[f32], sample_rate: f64) -> Option<f64> {
        if envelope.len() < 4 || sample_rate == 0.0 {
            return None;
        }

        let mean = envelope.iter().copied().sum::<f32>() / envelope.len() as f32;
        let centered: Vec<f32> = envelope.iter().map(|value| value - mean).collect();

        let min_lag = (sample_rate * 60.0 / BPM_MAX).round() as usize;
        let max_lag = (sample_rate * 60.0 / BPM_MIN).round() as usize;
        if max_lag >= centered.len() || min_lag == 0 {
            return None;
        }

        let mut scores = vec![0.0f32; max_lag + 1];
        let mut candidate_lags = Vec::new();

        for lag in min_lag..=max_lag {
            let mut sum = 0.0f32;
            for i in lag..centered.len() {
                sum += centered[i] * centered[i - lag];
            }
            let norm = (centered.len() - lag) as f32;
            if norm <= 0.0 {
                continue;
            }
            let score = sum / norm;
            if score > 0.0 {
                scores[lag] = score;
                candidate_lags.push(lag);
            }
        }

        if candidate_lags.is_empty() {
            return None;
        }

        let mut best_lag = candidate_lags[0];
        let mut best_score = f32::MIN;
        for &lag in &candidate_lags {
            let normalized = Self::harmonic_score(lag, &scores);
            if normalized > best_score {
                best_score = normalized;
                best_lag = lag;
            }
        }

        let refined_lag = Self::refine_lag(best_lag, &scores);
        let bpm = 60.0 * sample_rate / refined_lag;
        bpm.is_finite()
            .then_some(bpm.clamp(BPM_MIN, BPM_MAX))
    }

    fn refine_lag(lag: usize, scores: &[f32]) -> f64 {
        if lag == 0 || lag >= scores.len() {
            return lag as f64;
        }
        let best = scores[lag];
        let prev = if lag > 1 { scores[lag - 1] } else { best };
        let next = if lag + 1 < scores.len() {
            scores[lag + 1]
        } else {
            best
        };
        let denom = prev - 2.0 * best + next;
        if denom.abs() < 1e-6 {
            return lag as f64;
        }
        let offset = 0.5 * (prev - next) / denom;
        let clamped = offset.clamp(-1.0, 1.0) as f64;
        lag as f64 + clamped
    }

    fn harmonic_score(lag: usize, raw_scores: &[f32]) -> f32 {
        if lag == 0 || lag >= raw_scores.len() {
            return 0.0;
        }

        const HARMONICS: &[(f64, f32)] = &[
            (1.0, 1.0),
            (0.5, 0.8),
            (2.0, 0.7),
            (1.5, 0.6),
            (2.0 / 3.0, 0.5),
            (4.0 / 3.0, 0.4),
            (3.0 / 4.0, 0.35),
        ];

        let mut total = 0.0f32;
        for &(ratio, weight) in HARMONICS {
            let idx = (lag as f64 * ratio).round() as usize;
            if idx == 0 || idx >= raw_scores.len() {
                continue;
            }
            let score = raw_scores[idx];
            if score > 0.0 {
                total += score * weight;
            }
        }
        total
    }
}
