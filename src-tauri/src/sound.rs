use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Sound {
    #[default]
    Chime,
    Soft,
    Silent,
}

#[tauri::command]
pub async fn preview_sound(sound: Sound) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || play(sound))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn edge_sound(expanding: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || play_edge(expanding))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(windows)]
fn play(sound: Sound) -> Result<(), String> {
    use std::f32::consts::TAU;
    let (notes, amplitude) = match sound {
        Sound::Chime => ([(659.25, 0.0), (880.0, 0.16)], 0.22),
        Sound::Soft => ([(392.0, 0.0), (523.25, 0.11)], 0.12),
        Sound::Silent => return Ok(()),
    };
    play_wave(0.5, |time| {
        let value: f32 = notes
            .iter()
            .map(|&(frequency, start)| {
                let elapsed = time - start;
                let attack = (elapsed * 90.0).clamp(0.0, 1.0);
                let decay = (-elapsed.max(0.0) * 10.0).exp();
                (TAU * frequency * elapsed).sin() * attack * decay
            })
            .sum();
        value * amplitude * ((0.5 - time) * 40.0).min(1.0)
    })
}

#[cfg(windows)]
fn play_edge(expanding: bool) -> Result<(), String> {
    use std::f32::consts::{FRAC_2_PI, TAU};

    // Sweep and envelope parameters from Edge-Drop's expand and retract sound design.
    // https://github.com/Deepender25/Edge-Drop/blob/main/src/lib/soundEffects.ts
    let (slide, latch, onset) = if expanding {
        ((260.0, 740.0, 0.06, 0.08), (180.0, 70.0, 0.05, 0.10), 0.02)
    } else {
        ((540.0, 190.0, 0.08, 0.09), (140.0, 45.0, 0.05, 0.08), 0.06)
    };
    let sweep = |time: f32, (start, end, length, volume): (f32, f32, f32, f32), triangle| {
        if !(0.0..length).contains(&time) {
            return 0.0;
        }
        let slope = (end / start).ln() / length;
        let phase = TAU * start * (slope * time).exp_m1() / slope;
        let wave = phase.sin();
        let shape = if triangle {
            FRAC_2_PI * wave.asin()
        } else {
            wave
        };
        shape * volume * (0.001 / volume).powf(time / length)
    };
    play_wave(onset + latch.2, |time| {
        sweep(time, slide, false) + sweep(time - onset, latch, true)
    })
}

#[cfg(windows)]
fn play_wave(duration: f32, sample: impl Fn(f32) -> f32) -> Result<(), String> {
    use std::ptr::null_mut;
    use windows_sys::Win32::Media::Audio::{PlaySoundW, SND_MEMORY, SND_NODEFAULT, SND_NOSTOP};

    const RATE: u32 = 22050;
    let samples = (RATE as f32 * duration).ceil() as u32;
    let mut wave = Vec::with_capacity((44 + samples * 2) as usize);
    wave.extend(b"RIFF");
    wave.extend((36 + samples * 2).to_le_bytes());
    wave.extend(b"WAVEfmt ");
    wave.extend(16u32.to_le_bytes());
    wave.extend(1u16.to_le_bytes());
    wave.extend(1u16.to_le_bytes());
    wave.extend(RATE.to_le_bytes());
    wave.extend((RATE * 2).to_le_bytes());
    wave.extend(2u16.to_le_bytes());
    wave.extend(16u16.to_le_bytes());
    wave.extend(b"data");
    wave.extend((samples * 2).to_le_bytes());
    for index in 0..samples {
        let value = sample(index as f32 / RATE as f32).clamp(-1.0, 1.0);
        wave.extend(((value * i16::MAX as f32) as i16).to_le_bytes());
    }
    // Play synchronously on the blocking worker so the WAV stays alive during playback.
    let played = unsafe {
        PlaySoundW(
            wave.as_ptr().cast(),
            null_mut(),
            SND_MEMORY | SND_NODEFAULT | SND_NOSTOP,
        )
    };
    (played != 0)
        .then_some(())
        .ok_or_else(|| "Could not play sound".into())
}

#[cfg(not(windows))]
fn play(_sound: Sound) -> Result<(), String> {
    Ok(())
}

#[cfg(not(windows))]
fn play_edge(_expanding: bool) -> Result<(), String> {
    Ok(())
}
