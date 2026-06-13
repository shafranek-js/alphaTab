import * as alphaTab from '@coderline/alphatab';
import { css, html, injectStyles, type Mountable, parseHtml } from '../util/Dom';

injectStyles(
    'PianoKeyboard',
    css`
    .at-keyboard-panel {
        display: none;
        min-height: 180px;
        border-top: 1px solid var(--at-border);
        background: var(--at-bg);
        color: var(--at-text);
        padding: 12px;
    }
    .at-keyboard-panel.open {
        display: block;
    }
    .virtual-keyboard-wrap {
        display: grid;
        gap: 8px;
        overflow-x: auto;
    }
    .virtual-keyboard {
        --black-key-width: min(9vw, 36px);
        position: relative;
        min-height: 156px;
        padding: 6px;
        border: 1px solid var(--at-kb-line);
        border-radius: 8px;
        background: linear-gradient(180deg, var(--at-bg), var(--at-sidebar-bg));
        touch-action: manipulation;
        user-select: none;
    }
    .white-key-row {
        display: grid;
        gap: 2px;
        height: 100%;
        min-height: 140px;
    }
    .black-key-row {
        position: absolute;
        inset: 6px 6px auto;
        height: 60%;
        pointer-events: none;
    }
    .piano-key {
        position: relative;
        display: grid;
        align-content: end;
        justify-items: center;
        gap: 2px;
        min-width: 0;
        min-height: 40px;
        padding: 6px 2px 8px;
        border-radius: 0 0 6px 6px;
        border: 1px solid var(--at-kb-line);
        font-weight: 700;
        touch-action: manipulation;
        isolation: isolate;
        overflow: hidden;
        transition: transform 80ms ease, box-shadow 80ms ease, background 80ms ease;
        cursor: pointer;
    }
    .white-key {
        z-index: 1;
        height: 100%;
        background: var(--at-kb-white-bg);
        color: var(--at-kb-text);
        box-shadow: inset 0 -6px 8px rgba(0, 0, 0, 0.04);
    }
    .black-key {
        position: absolute;
        z-index: 2;
        top: 0;
        width: var(--black-key-width);
        height: 100%;
        min-height: 0;
        padding: 0;
        border-color: #0d1210;
        border-radius: 0 0 5px 5px;
        background: var(--at-kb-black-bg);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        pointer-events: auto;
    }
    .black-key-label {
        position: absolute;
        left: 50%;
        bottom: 6px;
        transform: translateX(-50%);
        max-width: calc(100% - 4px);
        color: rgba(244, 248, 245, 0.86);
        font-size: 8px;
        font-weight: 800;
        white-space: nowrap;
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .white-key:hover {
        border-color: var(--at-accent);
    }
    .white-key:active,
    .white-key.is-pressed {
        transform: translateY(2px);
        background: var(--at-kb-white-pressed) !important;
        box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.1) !important;
        border-color: var(--at-accent);
    }
    .black-key:hover:not(:disabled) {
        border-color: var(--at-accent);
    }
    .black-key:active,
    .black-key.is-pressed {
        transform: translateY(2px);
        background: var(--at-kb-black-pressed) !important;
        box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.4) !important;
        border-color: var(--at-accent);
    }
    .piano-key.demo-highlight {
        border-color: var(--at-accent) !important;
        background: var(--at-kb-white-pressed) !important;
        box-shadow: inset 0 0 0 2px var(--at-accent), inset 0 6px 0 var(--at-accent) !important;
        transform: translateY(2px);
        animation: key-press-white 0.25s cubic-bezier(0.1, 0.8, 0.3, 1);
    }
    .black-key.demo-highlight {
        background: var(--at-kb-black-pressed) !important;
        box-shadow: inset 0 0 0 2px var(--at-accent) !important;
        transform: translateY(2px);
        animation: key-press-black 0.25s cubic-bezier(0.1, 0.8, 0.3, 1);
    }
    @keyframes key-press-white {
        0% {
            transform: translateY(0) scale(1);
            filter: brightness(1.4);
            box-shadow: inset 0 0 0 2px var(--at-accent), inset 0 6px 0 var(--at-accent), 0 0 15px var(--at-accent) !important;
        }
        40% {
            transform: translateY(3px) scale(0.98);
            filter: brightness(1.2);
            box-shadow: inset 0 0 0 2px var(--at-accent), inset 0 6px 0 var(--at-accent), 0 0 10px var(--at-accent) !important;
        }
        100% {
            transform: translateY(2px) scale(1);
            filter: brightness(1);
            box-shadow: inset 0 0 0 2px var(--at-accent), inset 0 6px 0 var(--at-accent) !important;
        }
    }
    @keyframes key-press-black {
        0% {
            transform: translateY(0) scale(1);
            filter: brightness(1.4);
            box-shadow: inset 0 0 0 2px var(--at-accent), 0 0 15px var(--at-accent) !important;
        }
        40% {
            transform: translateY(3px) scale(0.98);
            filter: brightness(1.2);
            box-shadow: inset 0 0 0 2px var(--at-accent), 0 0 10px var(--at-accent) !important;
        }
        100% {
            transform: translateY(2px) scale(1);
            filter: brightness(1);
            box-shadow: inset 0 0 0 2px var(--at-accent) !important;
        }
    }
    .piano-key.hint-highlight {
        border-color: #3b82f6 !important;
        background: rgba(59, 130, 246, 0.15) !important;
        box-shadow: inset 0 0 0 2px #3b82f6, inset 0 6px 0 #3b82f6 !important;
    }
    .dark-theme .piano-key.hint-highlight {
        background: rgba(59, 130, 246, 0.25) !important;
    }
    .black-key.hint-highlight {
        background: #2563eb !important;
        box-shadow: inset 0 0 0 2px #3b82f6 !important;
    }

    .key-shortcut {
        display: inline-block;
        background: rgba(0, 0, 0, 0.06);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 3px;
        padding: 0 4px;
        font-size: 9px;
        font-family: monospace;
        margin-left: 4px;
        color: var(--at-kb-muted);
    }
    .dark-theme .key-shortcut {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    :root {
        --at-kb-bg: #fff;
        --at-kb-white-bg: linear-gradient(180deg, #ffffff, #f1f5f3);
        --at-kb-white-pressed: #e8f5ed;
        --at-kb-black-bg: linear-gradient(180deg, #2c3531, #0d1210);
        --at-kb-black-pressed: linear-gradient(180deg, #354a40, #15231d);
        --at-kb-line: rgba(0, 0, 0, 0.12);
        --at-kb-text: #1c1e21;
        --at-kb-muted: #5f6874;
    }
    :root.dark-theme {
        --at-kb-bg: #111a17;
        --at-kb-white-bg: linear-gradient(180deg, #101a17, #24332e);
        --at-kb-white-pressed: #1f3d32;
        --at-kb-black-bg: linear-gradient(180deg, #18221e, #070d0b);
        --at-kb-black-pressed: linear-gradient(180deg, #152d24, #08140f);
        --at-kb-line: #31423d;
        --at-kb-text: #eaf1ee;
        --at-kb-muted: #a9b8b2;
    }
`
);

interface VirtualKey {
    pitch: string;
    step: string;
    octave: number;
    midi: number;
    isBlack: boolean;
    whiteIndex?: number;
    afterWhiteIndex?: number;
}

export class PianoKeyboard implements Mountable {
    readonly root: HTMLElement;
    private subscriptions: (() => void)[] = [];
    private keys: VirtualKey[] = [];
    private middleOctave: number = 4;
    private pressedMidiNotes = new Set<number>();
    private hintNotes: number[] = [];
    private activeChannels = new Map<number, number>();

    private shortcutMap: Record<string, number> = {
        a: 0, // C
        w: 1, // C#
        s: 2, // D
        e: 3, // D#
        d: 4, // E
        f: 5, // F
        t: 6, // F#
        g: 7, // G
        y: 8, // G#
        h: 9, // A
        u: 10, // A#
        j: 11 // B
    };

    public constructor(private api: alphaTab.AlphaTabApi) {
        this.root = parseHtml(html`
            <div class="at-keyboard-panel">
                <div class="virtual-keyboard-wrap"></div>
            </div>
        `);

        this.subscriptions.push(this.api.scoreLoaded.on(() => this.rebuildKeyboard()));
        this.subscriptions.push(this.api.renderFinished.on(() => this.rebuildKeyboard()));

        // Dynamic highlights on played beats
        this.subscriptions.push(this.api.playedBeatChanged.on(beat => this.highlightPlayedBeat(beat)));
        this.subscriptions.push(
            this.api.playerStateChanged.on(args => {
                if (args.state !== alphaTab.synth.PlayerState.Playing) {
                    this.clearHighlights();
                }
            })
        );

        // Computer keyboard shortcuts
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        this.rebuildKeyboard();
    }

    public setOpen(open: boolean): void {
        this.root.classList.toggle('open', open);
        if (open) {
            this.rebuildKeyboard();
        }
    }

    public dispose(): void {
        for (const unsubscribe of this.subscriptions) {
            unsubscribe();
        }
        this.subscriptions = [];
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.root.remove();
    }

    private rebuildKeyboard(): void {
        const wrap = this.root.querySelector('.virtual-keyboard-wrap')!;
        wrap.replaceChildren();

        const pitches = this.getPitchesFromScore();
        const minMidi = pitches.length > 0 ? pitches[0] : 48; // Default C3
        const maxMidi = pitches.length > 0 ? pitches[pitches.length - 1] : 84; // Default C6

        let minOctave = Math.max(0, Math.floor(minMidi / 12) - 1);
        let maxOctave = Math.min(8, Math.floor(maxMidi / 12) - 1);

        // Ensure at least a 3-octave span for a realistic, playable look
        const minSpan = 3;
        while (maxOctave - minOctave + 1 < minSpan) {
            let expanded = false;
            if (minOctave > 0) {
                minOctave--;
                expanded = true;
            }
            if (maxOctave - minOctave + 1 < minSpan && maxOctave < 8) {
                maxOctave++;
                expanded = true;
            }
            if (!expanded) {
                break;
            }
        }

        this.middleOctave = Math.floor((minOctave + maxOctave) / 2);

        this.keys = this.generateKeys(minOctave, maxOctave);
        const whiteKeys = this.keys.filter(k => !k.isBlack);
        const blackKeys = this.keys.filter(k => k.isBlack);
        const whiteCount = whiteKeys.length;

        const keyboardEl = parseHtml(html`
            <div class="virtual-keyboard" role="group" aria-label="Virtual Piano Keyboard">
                <div class="white-key-row"></div>
                <div class="black-key-row"></div>
            </div>
        `) as HTMLElement;

        keyboardEl.style.width = `max(100%, ${whiteCount * 32}px)`;

        const whiteRow = keyboardEl.querySelector('.white-key-row')! as HTMLElement;
        const blackRow = keyboardEl.querySelector('.black-key-row')! as HTMLElement;

        whiteRow.style.gridTemplateColumns = `repeat(${whiteCount}, minmax(28px, 1fr))`;

        for (const key of whiteKeys) {
            const btn = this.createKeyButton(key, whiteCount);
            whiteRow.appendChild(btn);
        }

        for (const key of blackKeys) {
            const btn = this.createKeyButton(key, whiteCount);
            blackRow.appendChild(btn);
        }

        wrap.appendChild(keyboardEl);
        this.applyHintNotes();
    }

    private getPitchesFromScore(): number[] {
        const uniqueMidi = new Set<number>();
        if (this.api.score && this.api.tracks) {
            for (const track of this.api.tracks) {
                for (const staff of track.staves) {
                    for (const bar of staff.bars) {
                        for (const voice of bar.voices) {
                            for (const beat of voice.beats) {
                                if (beat.isRest) {
                                    continue;
                                }
                                for (const note of beat.notes) {
                                    if (note.realValue > 0) {
                                        uniqueMidi.add(note.realValue);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return Array.from(uniqueMidi).sort((a, b) => a - b);
    }

    private generateKeys(minOctave: number, maxOctave: number): VirtualKey[] {
        const keys: VirtualKey[] = [];
        let whiteIndex = 0;

        const NOTE_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

        for (let octave = minOctave; octave <= maxOctave; octave++) {
            for (const step of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
                const pitch = `${step}${octave}`;
                const midi = (octave + 1) * 12 + NOTE_SEMITONES[step];

                keys.push({
                    pitch,
                    step,
                    octave,
                    midi,
                    isBlack: false,
                    whiteIndex
                });

                if (['C', 'D', 'F', 'G', 'A'].includes(step)) {
                    keys.push({
                        pitch: `${step}#${octave}`,
                        step: `${step}#`,
                        octave,
                        midi: midi + 1,
                        isBlack: true,
                        afterWhiteIndex: whiteIndex
                    });
                }
                whiteIndex++;
            }
        }
        return keys;
    }

    private createKeyButton(key: VirtualKey, whiteCount: number): HTMLButtonElement {
        const classes = ['piano-key', key.isBlack ? 'black-key' : 'white-key'];

        let label = key.step;
        if (key.isBlack) {
            label = `${key.step.replace('#', '')}#`;
        }

        const isMiddleOctave = key.octave === this.middleOctave;
        const SHORTCUT_HINTS: Record<string, string> = { C: 'A', D: 'S', E: 'D', F: 'F', G: 'G', A: 'H', B: 'J' };
        const shortcutHint =
            !key.isBlack && isMiddleOctave && SHORTCUT_HINTS[key.step]
                ? `<kbd class="key-shortcut">${SHORTCUT_HINTS[key.step]}</kbd>`
                : '';

        let innerHTML = '';
        if (key.isBlack) {
            innerHTML = `<span class="black-key-label">${label}</span>`;
        } else {
            innerHTML = `<span>${label}</span><small>${key.octave}${shortcutHint}</small>`;
        }

        const btn = parseHtml(html`
            <button class="${classes.join(' ')}" type="button"
                    data-midi="${key.midi}"
                    data-pitch="${key.pitch}"
                    aria-label="${key.pitch}">
            </button>
        `) as HTMLButtonElement;

        btn.innerHTML = innerHTML;

        if (key.isBlack && key.afterWhiteIndex !== undefined) {
            const leftPercent = ((key.afterWhiteIndex + 1) / whiteCount) * 100;
            btn.style.left = `calc(${leftPercent}% - (var(--black-key-width) / 2))`;
        }

        // Pointer event interaction for immediate low-latency sound triggering
        btn.addEventListener('pointerdown', e => {
            if (!e.isPrimary) {
                return;
            }
            btn.setPointerCapture(e.pointerId);
            btn.classList.add('is-pressed');
            this.playMidiNote(key.midi);
        });

        btn.addEventListener('pointerup', e => {
            btn.releasePointerCapture(e.pointerId);
            btn.classList.remove('is-pressed');
        });

        btn.addEventListener('pointercancel', e => {
            btn.releasePointerCapture(e.pointerId);
            btn.classList.remove('is-pressed');
        });

        btn.addEventListener('pointerleave', () => {
            btn.classList.remove('is-pressed');
        });

        return btn;
    }

    private playMidiNote(noteNumber: number): void {
        if (!this.api.player) {
            return;
        }

        const midiFile = new alphaTab.midi.MidiFile();
        const trackIndex = 0;
        const channel = this.api.tracks?.[0]?.playbackInfo?.primaryChannel ?? 0;
        const velocity = 127;

        // 400ms duration for note
        const durationTicks = Math.round(400 * 1.92);

        const noteOn = new alphaTab.midi.NoteOnEvent(trackIndex, 0, channel, noteNumber, velocity);
        const noteOff = new alphaTab.midi.NoteOffEvent(trackIndex, durationTicks, channel, noteNumber, velocity);

        midiFile.addEvent(noteOn);
        midiFile.addEvent(noteOff);

        this.api.player.playOneTimeMidiFile(midiFile);
    }

    private highlightPlayedBeat(beat: alphaTab.model.Beat): void {
        if (!beat || beat.isRest) {
            this.clearHighlights();
            return;
        }

        // Get the active MIDI note values and tie destinations in the new beat
        const activeMidiNotes = new Set<number>();
        const tieDestinations = new Set<number>();
        for (const note of beat.notes) {
            if (note.realValue > 0) {
                activeMidiNotes.add(note.realValue);
                if (note.isTieDestination) {
                    tieDestinations.add(note.realValue);
                }
            }
        }

        // Remove highlight from any keys that are not active in the new beat
        for (const el of this.root.querySelectorAll('.piano-key.demo-highlight')) {
            const midi = Number(el.getAttribute('data-midi'));
            if (!activeMidiNotes.has(midi)) {
                el.classList.remove('demo-highlight');
            }
        }

        // Highlight the active keys, handling animation reflow only for new strikes
        for (const note of beat.notes) {
            if (note.realValue > 0) {
                const keyEl = this.root.querySelector(`[data-midi="${note.realValue}"]`) as HTMLElement;
                if (keyEl) {
                    const isAlreadyHighlighted = keyEl.classList.contains('demo-highlight');
                    const isTie = tieDestinations.has(note.realValue);

                    if (!isAlreadyHighlighted) {
                        // Brand new key press
                        void keyEl.offsetWidth; // Force reflow to start CSS animation
                        keyEl.classList.add('demo-highlight');
                    } else if (!isTie) {
                        // Key is already highlighted but struck again
                        keyEl.classList.remove('demo-highlight');
                        void keyEl.offsetWidth; // Force reflow to restart CSS animation
                        keyEl.classList.add('demo-highlight');
                    } else {
                        // Tied note continuation: keep highlighted without restarting the strike animation
                    }
                }
            }
        }
    }

    private clearHighlights(): void {
        for (const el of this.root.querySelectorAll('.piano-key.demo-highlight')) {
            el.classList.remove('demo-highlight');
        }
    }

    public setHintNotes(midiNotes: number[]): void {
        this.hintNotes = midiNotes;
        this.applyHintNotes();
    }

    public clearHints(): void {
        this.hintNotes = [];
        this.applyHintNotes();
    }

    public playInputNote(midi: number, velocity = 127, channel = 0): void {
        const keyEl = this.root.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null;
        if (keyEl) {
            keyEl.classList.add('is-pressed');
        }
        const resolvedChannel = (channel !== undefined && channel !== 0) 
            ? channel 
            : (this.api.tracks?.[0]?.playbackInfo?.primaryChannel ?? 0);
        this.activeChannels.set(midi, resolvedChannel);
        this.api.player?.playLiveNote(resolvedChannel, midi, velocity);
    }

    public stopInputNote(midi: number): void {
        const keyEl = this.root.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null;
        if (keyEl) {
            keyEl.classList.remove('is-pressed');
        }
        const channel = this.activeChannels.get(midi) ?? 0;
        this.activeChannels.delete(midi);
        this.api.player?.stopLiveNote(channel, midi);
    }

    private applyHintNotes(): void {
        for (const el of this.root.querySelectorAll('.piano-key.hint-highlight')) {
            el.classList.remove('hint-highlight');
        }
        for (const note of this.hintNotes) {
            const keyEl = this.root.querySelector(`[data-midi="${note}"]`);
            if (keyEl) {
                keyEl.classList.add('hint-highlight');
            }
        }
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.repeat) {
            return;
        }

        const target = e.target as HTMLElement;
        if (
            target &&
            (target.tagName === 'INPUT' ||
                target.tagName === 'SELECT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable)
        ) {
            return;
        }

        const offset = this.shortcutMap[e.key.toLowerCase()];
        if (offset !== undefined) {
            const midi = (this.middleOctave + 1) * 12 + offset;
            this.pressedMidiNotes.add(midi);

            const btn = this.root.querySelector(`[data-midi="${midi}"]`) as HTMLButtonElement;
            if (btn) {
                btn.classList.add('is-pressed');
                this.playMidiNote(midi);
            }
        }
    };

    private handleKeyUp = (e: KeyboardEvent): void => {
        const offset = this.shortcutMap[e.key.toLowerCase()];
        if (offset !== undefined) {
            const midi = (this.middleOctave + 1) * 12 + offset;
            this.pressedMidiNotes.delete(midi);

            const btn = this.root.querySelector(`[data-midi="${midi}"]`);
            if (btn) {
                btn.classList.remove('is-pressed');
            }
        }
    };
}
