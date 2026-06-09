import * as alphaTab from '@coderline/alphatab';
import { MidiInputService, type MidiInputState, type MidiNoteInput } from '../../input/MidiInputService';
import { css, html, injectStyles, type Mountable, parseHtml } from '../../util/Dom';
import type { PianoKeyboard } from '../PianoKeyboard';
import {
    buildPracticeQueue,
    getPlayableBeatsFromTracks,
    type PracticeInputResult,
    PracticeSession,
    type PracticeSessionState
} from './PracticeController';
import { PracticeOverlay } from './PracticeOverlay';

injectStyles(
    'PracticePanel',
    css`
    .at-footer-practice {
        display: none;
        border-top: 1px solid var(--at-border);
        background: var(--at-bg);
        color: var(--at-text);
        padding: 8px 12px;
    }
    .at-footer-practice.open {
        display: block;
    }
    .at-practice-panel {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        font-size: 13px;
    }
    .at-practice-left {
        display: flex;
        align-items: center;
        gap: 16px;
    }
    .at-midi-status {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .at-midi-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6b7280;
        display: inline-block;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
        transition: background-color 0.2s, box-shadow 0.2s;
    }
    .at-midi-indicator.connected {
        background: #10b981;
        box-shadow: 0 0 6px #10b981;
    }
    .at-midi-indicator.connecting {
        background: #f59e0b;
        box-shadow: 0 0 6px #f59e0b;
    }
    .at-midi-indicator.error {
        background: #ef4444;
        box-shadow: 0 0 6px #ef4444;
    }
    .at-midi-select {
        font: inherit;
        font-weight: 600;
        border: 1px solid var(--at-border);
        border-radius: 4px;
        background: var(--at-bg);
        color: var(--at-text);
        padding: 2px 8px;
        outline: none;
        cursor: pointer;
        max-width: 180px;
    }
    .at-practice-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        cursor: pointer;
        user-select: none;
    }
    .at-practice-center {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        justify-content: flex-end;
    }
    .at-practice-progress {
        font-weight: 700;
        background: var(--at-border);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        color: var(--at-text);
        white-space: nowrap;
    }
    .at-practice-feedback {
        font-weight: 600;
        color: var(--at-text);
        font-size: 13px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .at-practice-feedback.correct {
        color: #10b981;
    }
    .at-practice-feedback.wrong {
        color: #ef4444;
    }
    `
);

export class PracticePanel implements Mountable {
    readonly root: HTMLElement;
    private midiService = new MidiInputService();
    private session = new PracticeSession<alphaTab.model.Beat>();
    private overlay: PracticeOverlay;
    private indicatorEl: HTMLElement;
    private progressEl: HTMLElement;
    private feedbackEl: HTMLElement;
    private inputSelect: HTMLSelectElement;
    private ignoreOctaveInput: HTMLInputElement;
    private showHintsInput: HTMLInputElement;
    private showHints = true;
    private subscriptions: (() => void)[] = [];
    private lastMidiState: MidiInputState = this.midiService.getState();

    public constructor(
        private api: alphaTab.AlphaTabApi,
        overlayHost: HTMLElement,
        private keyboardPanel: PianoKeyboard | null = null
    ) {
        this.root = parseHtml(html`
            <div class="at-footer-practice">
                <div class="at-practice-panel">
                    <div class="at-practice-left">
                        <div class="at-midi-status">
                            <span class="at-midi-indicator" data-practice-indicator></span>
                            <select class="at-midi-select" data-practice-input aria-label="MIDI input"></select>
                        </div>
                        <label class="at-practice-label">
                            <input type="checkbox" data-practice-octave /> Ignore octave
                        </label>
                        <label class="at-practice-label">
                            <input type="checkbox" data-practice-hints /> Show hints
                        </label>
                    </div>
                    <div class="at-practice-center">
                        <span class="at-practice-feedback" data-practice-feedback></span>
                        <span class="at-practice-progress" data-practice-progress>0 / 0</span>
                    </div>
                </div>
            </div>
        `);

        this.overlay = new PracticeOverlay(api, overlayHost);
        this.indicatorEl = this.root.querySelector('[data-practice-indicator]')!;
        this.progressEl = this.root.querySelector('[data-practice-progress]')!;
        this.feedbackEl = this.root.querySelector('[data-practice-feedback]')!;
        this.inputSelect = this.root.querySelector('[data-practice-input]')!;
        this.ignoreOctaveInput = this.root.querySelector('[data-practice-octave]')!;
        this.showHintsInput = this.root.querySelector('[data-practice-hints]')!;

        this.inputSelect.addEventListener('change', () => {
            this.midiService.selectInput(this.inputSelect.value);
        });
        this.ignoreOctaveInput.addEventListener('change', () => {
            this.session.setIgnoreOctave(this.ignoreOctaveInput.checked);
            this.refresh();
        });

        let savedShowHints = true;
        try {
            const dataStr = localStorage.getItem('at-playground-settings');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data?.custom?.showHints !== undefined) {
                    savedShowHints = !!data.custom.showHints;
                }
            }
        } catch (e) {
            console.error('Failed to load saved settings:', e);
        }
        this.showHints = savedShowHints;
        this.showHintsInput.checked = this.showHints;

        this.showHintsInput.addEventListener('change', () => {
            this.showHints = this.showHintsInput.checked;
            this.saveCustomSetting('showHints', this.showHints);
            this.refresh();
        });

        this.subscriptions.push(this.midiService.onStateChange(state => this.updateMidiState(state)));
        this.subscriptions.push(this.midiService.onMidiNote(note => this.handleMidiNote(note)));
        this.subscriptions.push(this.api.scoreLoaded.on(() => this.rebuildQueue()));
        this.subscriptions.push(this.api.renderFinished.on(() => this.rebuildQueue()));
        this.subscriptions.push(this.api.postRenderFinished.on(() => this.refresh()));

        this.rebuildQueue();
        this.updateMidiState(this.lastMidiState);
        this.refresh();

        // Automatically connect MIDI input
        this.connectMidi();
    }

    public setOpen(open: boolean): void {
        this.root.classList.toggle('open', open);
        if (open) {
            this.connectMidi();
            this.rebuildQueue();
            this.start();
        } else {
            this.stop();
        }
    }

    public dispose(): void {
        for (const unsubscribe of this.subscriptions) {
            unsubscribe();
        }
        this.subscriptions = [];
        this.midiService.dispose();
        this.overlay.dispose();
        this.root.remove();
    }

    private async connectMidi(): Promise<void> {
        await this.midiService.initMidi();
        this.updateMidiState(this.midiService.getState());
    }

    private start(): void {
        this.rebuildQueue();
        if (this.api.playerState === alphaTab.synth.PlayerState.Playing) {
            this.api.pause();
        }
        const state = this.session.start();
        this.seekToCurrent(state);
        this.feedbackEl.textContent =
            state.total > 0 ? 'Play the highlighted note.' : 'No playable notes in the rendered score.';
        this.feedbackEl.className = 'at-practice-feedback';
        this.refresh();
    }

    private stop(): void {
        this.session.stop();
        this.overlay.clear();
        this.keyboardPanel?.clearHints();
        this.feedbackEl.textContent = 'Practice stopped.';
        this.feedbackEl.className = 'at-practice-feedback';
        this.refresh();
    }

    private rebuildQueue(): void {
        const beats = getPlayableBeatsFromTracks(this.api.tracks);
        const queue = buildPracticeQueue(beats, this.api.tickCache);
        this.session.setQueue(queue);
        this.overlay.clear();
        this.refresh();
    }

    private handleMidiNote(note: MidiNoteInput): void {
        const result = this.session.handleMidiNote(note.note);
        this.applyInputResult(result);
    }

    private applyInputResult(result: PracticeInputResult<alphaTab.model.Beat>): void {
        switch (result.type) {
            case 'ignored':
                return;
            case 'wrong':
                this.feedbackEl.textContent = `Wrong note: ${formatMidiNote(result.inputNote)}`;
                this.feedbackEl.className = 'at-practice-feedback wrong';
                this.overlay.flash(result.state.currentItem, 'wrong', result.state.matchedNotes);
                break;
            case 'partial':
                this.feedbackEl.textContent = 'Keep holding the chord.';
                this.feedbackEl.className = 'at-practice-feedback correct';
                this.overlay.showItem(result.state.currentItem, result.state.matchedNotes);
                break;
            case 'correct':
                this.feedbackEl.textContent = 'Correct.';
                this.feedbackEl.className = 'at-practice-feedback correct';
                this.overlay.flash(result.item, 'correct');
                this.seekToCurrent(result.state);
                break;
            case 'complete':
                this.feedbackEl.textContent = 'Practice complete.';
                this.feedbackEl.className = 'at-practice-feedback correct';
                this.overlay.flash(result.item, 'correct');
                this.keyboardPanel?.clearHints();
                break;
        }
        this.refresh();
    }

    private seekToCurrent(state: PracticeSessionState<alphaTab.model.Beat>): void {
        if (!state.currentItem) {
            return;
        }
        this.api.tickPosition = state.currentItem.startTick;
        this.api.scrollToCursor();
    }

    private refresh(): void {
        const state = this.session.getState();
        this.progressEl.textContent = `${Math.min(state.currentIndex + (state.complete ? 0 : 1), state.total)} / ${state.total}`;
        if (state.running && state.currentItem) {
            this.overlay.showItem(state.currentItem, state.matchedNotes);
            if (this.showHints) {
                this.keyboardPanel?.setHintNotes(state.currentItem.expectedNotes);
            } else {
                this.keyboardPanel?.clearHints();
            }
        } else {
            if (!state.complete) {
                this.overlay.clear();
            }
            this.keyboardPanel?.clearHints();
        }
    }

    private updateMidiState(state: MidiInputState): void {
        this.lastMidiState = state;

        this.indicatorEl.className = 'at-midi-indicator';
        if (!state.available || state.error) {
            this.indicatorEl.classList.add('error');
        } else if (state.connecting) {
            this.indicatorEl.classList.add('connecting');
        } else if (state.enabled) {
            this.indicatorEl.classList.add('connected');
        }

        this.inputSelect.disabled = state.inputs.length === 0;
        this.renderInputOptions(state);
    }

    private renderInputOptions(state: MidiInputState): void {
        const selected = state.selectedInputId;
        this.inputSelect.replaceChildren();
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = state.inputs.length > 0 ? 'All MIDI inputs' : 'No MIDI inputs';
        this.inputSelect.appendChild(all);
        for (const input of state.inputs) {
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = input.manufacturer ? `${input.name} (${input.manufacturer})` : input.name;
            this.inputSelect.appendChild(option);
        }
        this.inputSelect.value = selected;
    }

    private saveCustomSetting(key: string, value: any): void {
        try {
            const dataStr = localStorage.getItem('at-playground-settings');
            const data = dataStr ? JSON.parse(dataStr) : {};
            if (!data.custom) {
                data.custom = {};
            }
            data.custom[key] = value;
            localStorage.setItem('at-playground-settings', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save custom setting:', e);
        }
    }
}

function formatMidiNote(note: number): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}
