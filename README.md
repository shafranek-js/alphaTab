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
