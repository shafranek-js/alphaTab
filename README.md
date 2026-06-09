# alphaTab

[![Official Site](https://img.shields.io/badge/site-alphatab.net-blue.svg)](https://www.alphatab.net/)
[![Documentation](https://img.shields.io/badge/docs-alphatab.net-blue.svg)](https://www.alphatab.net/docs/introduction)
[![License MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-green.svg)](https://www.mozilla.org/en-US/MPL/2.0/)
[![Build](https://github.com/CoderLine/alphaTab/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/CoderLine/alphaTab/actions/workflows/build.yml)

alphaTab is a cross-platform music notation and guitar tablature rendering library. You can use alphaTab within your own website or application to load and display interactive music sheets from various data sources like Guitar Pro, MusicXML, or alphaTab's built-in markup language, alphaTex.

![alphaTab](img/banner.png?raw=true "alphaTab")

---

## 🏗️ Monorepo Architecture

The repository is structured as a monorepo containing multiple packages under the `packages/` directory:

* **`packages/alphatab`**: The core library containing the rendering logic, file importers (Guitar Pro, MusicXML, alphaTex), and the synthesizer engine.
* **`packages/playground`**: A feature-rich Vite-based playground application for demonstrating, testing, and debugging alphaTab features in real-time.
* **`packages/lsp`**: A Language Server Protocol implementation for alphaTex, helping developers integrate notation editing helpers into editors.
* **`packages/monaco`**: Monaco Editor integration components for editing alphaTex.
* **`packages/vite`** & **`packages/webpack`**: Integration plugins for modern JavaScript packagers and bundlers.

---

## ✨ Core Features

* **File Format Support**: Load and play files from Guitar Pro 3-5 (`.gp3`, `.gp4`, `.gp5`), Guitar Pro 6 (`.gpx`), Guitar Pro 7/8 (`.gp`), MusicXML, and alphaTex.
* **Responsive Rendering**: Beautiful music sheets rendered dynamically as scalable vector graphics (SVG) or canvas elements that adjust perfectly to different viewport widths.
* **Rich Notation & Articulations**: Display single or multiple instruments as standard notation, guitar tablature, or drum tabs. Supports key signatures, time signatures, accidentals, repeats, alternate endings, tied notes, grace notes, bends, let-ring, vibratos, lyrics, chords, and much more.
* **Built-in Synthesizer (alphaSynth)**: An advanced WebAudio-based MIDI synthesizer that plays music sheets directly in the browser.

---

## 🎛️ Playground App Features

The playground app (`packages/playground`) showcases the full power of alphaTab's interactive APIs and custom UI controls:

### 🔊 Comprehensive Playback Control Bar
* **Play / Pause / Stop**: Classic media controls linked directly to the synthesizer state.
* **Looping Toggle**: Loops playback over a selected range or the entire song.
* **Playback Speed Slider**: Dynamically adjust speed from `0.1x` to `3.0x`.
* **Metronome Volume**: Control the volume of metronome ticks during playback.
* **Count-In Volume**: Adjust volume for count-in ticks before song playback starts.

### 🎸 Detailed Track Settings & Mixers
* **Instrument Selection**: Switch track instruments dynamically in real-time. Automatically synchronizes beat-level program change events to prevent automated instruments from locking the selection.
* **Solo / Mute**: Toggle soloing or muting for individual tracks.
* **Volume & Pan (Balance) Sliders**: Adjust track volume levels and spatial panning.
* **Transposition Sliders**: Support for transposing both audio and notation by up to two octaves (`-24` to `+12` semitones), with optional linked sliders.
* **Stave Layout Options**: Toggle standard notation, tablature, slash notation, or numbered notation individually per staff.

### 🎨 Live Theme & Visual Customizations
* **Dark & Light Mode**: Seamless theme switching.
* **Custom Background Colors**: Color pickers to adjust theme backgrounds dynamically, saved persistently.
* **Bar Cursor Customization**: A native color picker to change the active playback bar highlighter.
* **Layout Filters**: Interactive toggles for score title, layout elements, page outlines, and spacing templates.

### 🎓 Educational & Practice Tools
* **Interactive Playback & Speed Training**: Follow notation in real-time with a moving bar cursor highlighting active bars and beats. Adjust playback speed from `0.1x` to `3.0x` to practice at comfortable tempos.
* **Suzuki Note Coloring Spectrum**: Toggle note-head and fret-number colors according to the Suzuki color spectrum (C = Red, D = Orange, E = Yellow, F = Green, G = Light Blue, A = Dark Blue, B = Magenta/Pink). This visual aid helps beginners quickly associate pitches with positions on standard notation, guitar tablature, and numbered staves, making sheet music reading much more intuitive.

### 🎹 Virtual Piano Keyboard & Practice Mode
* **Interactive Virtual Keyboard**: A fully rendered, real-size piano keyboard displayed at the bottom of the screen. Responds live to MIDI input, synthesizer output, and manual mouse/touch interaction.
* **Practice Mode**: A dedicated practice panel that guides the user through a score note-by-note. The current note to play is highlighted on both the sheet and the virtual keyboard, allowing learners to practice at their own pace without any time pressure.
* **Note Hint Highlighting**: An optional "Show hints" toggle visually highlights the next note to play on the virtual keyboard — white keys glow with a blue inner shadow, black keys turn deep blue — helping beginners find the correct key instantly.
* **Keyboard Visibility Toggle**: The virtual keyboard panel can be shown or hidden at any time independently of the Practice mode state, keeping the UI uncluttered for advanced users.

### 🎙️ MIDI Device Integration
* **Auto-Connect MIDI Input**: The app automatically detects and connects to any available MIDI input device as soon as it is plugged in — no manual setup required.
* **Connection Status Indicator**: A clear visual indicator (🟢 green with device name when connected, 🔴 red when no device is found) shows the current MIDI connection state at a glance in the Practice panel.
* **Live MIDI-to-Keyboard Mapping**: Notes played on a physical MIDI keyboard are reflected in real-time on the virtual keyboard and validated against the expected note in Practice mode.

### 💾 Settings Export & Import
* **Export All Settings**: Download a complete snapshot of every application and user preference — track settings, theme, layout options, practice state, and more — as a single `alphatab-settings.json` file.
* **Import Settings**: Restore a previously exported settings file to instantly reproduce any saved configuration across different sessions or machines.
* **Reset to Defaults**: A one-click button restores all settings to their factory defaults.

---

## 🎹 Synthesizer & SoundFont Technology

alphaTab features a custom `TinySoundFont` implementation optimized for web applications:

* **Vorbis-Compressed SF3 Support**: Connects high-quality, lightweight compressed SoundFonts (such as `FluidR3.sf3` by default) to dramatically reduce download sizes (from ~150MB down to ~20MB) while maintaining excellent audio quality.
* **Stereo Down-Mixing**: Intelligently treats the Left stereo channel as mono and skips the Right stereo channel to balance volume and save processing power.
* **Zombie Voice Prevention**: Actively guards against infinite loops by ignoring empty sample regions, ensuring active voice slots are not exhausted.

---

## 🚀 Getting Started (Developers)

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Typecheck**:
   ```bash
   npm run typecheck
   ```

3. **Start the Playground Locally**:
   ```bash
   npm run dev
   ```
   Open the local address shown in the terminal (usually `http://localhost:5174/` or `http://localhost:5173/`).

4. **Build the Project**:
   ```bash
   npm run build
   ```

5. **Run Tests**:
   ```bash
   npm run test
   ```

---

## 📚 Documentation & Guides

For details on API usage, custom settings, and step-by-step tutorials, please visit our official resources:
* **Guides & Introduction**: [alphatab.net/docs/introduction](https://www.alphatab.net/docs/introduction)
* **API Documentation**: [alphatab.net/docs/tutorials](https://www.alphatab.net/docs/tutorials)

---

## ❤️ Acknowledgements & Credits

* **JetBrains**: For providing Open Source licenses for their development tools, allowing us to build across multiple platforms with modern IDE assistance.
  <p align="center">
    <a href="https://www.jetbrains.com/" target="_blank"><img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.png" width="120" /></a>
  </p>

* **BrowserStack**: For providing a free cross-browser testing plan, helping us ensure that alphaTab renders perfectly on all devices and OS configurations.
  <p align="center">
    <a href="https://www.browserstack.com" target="_blank"><img src="img/BrowserStack.png?raw=true" width="300" /></a>
  </p>

* **TinySoundFont & SFZero**: Special thanks to Bernhard Schelling (author of [TinySoundFont](https://github.com/schellingb/TinySoundFont)) and Steve Folta (author of [SFZero](https://github.com/stevefolta/SFZero)) for providing the foundation of our synthesis engine.
