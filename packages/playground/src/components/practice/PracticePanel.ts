import * as alphaTab from '@coderline/alphatab';
import type { MidiInputService, MidiInputState, MidiNoteInput } from '../../input/MidiInputService';
import { css, html, injectStyles, type Mountable, parseHtml } from '../../util/Dom';
import type { PianoKeyboard } from '../PianoKeyboard';
import {
    buildPracticeQueue,
    filterPracticeQueueByRange,
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
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        font-size: 13px;
    }
    .at-practice-left,
    .at-practice-center,
    .at-practice-loop-stats {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        min-width: 0;
    }
    .at-practice-center {
        flex: 1;
        justify-content: flex-end;
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
        white-space: nowrap;
    }
    .at-practice-progress,
    .at-practice-loop-counter {
        font-weight: 700;
        background: var(--at-border);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        color: var(--at-text);
        white-space: nowrap;
    }
    .at-practice-restart,
    .at-practice-loop-reset {
        border: 1px solid var(--at-border);
        border-radius: 4px;
        background: var(--at-bg);
        color: var(--at-text);
        font: inherit;
        font-weight: 700;
        padding: 3px 8px;
        cursor: pointer;
    }
    .at-practice-restart:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .at-practice-loop-stats.hidden {
        display: none;
    }
    .at-practice-feedback {
        font-weight: 600;
        color: var(--at-text);
        font-size: 13px;
        min-width: 0;
        max-width: 260px;
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
    private session = new PracticeSession<alphaTab.model.Beat>();
    private overlay: PracticeOverlay;
    private indicatorEl: HTMLElement;
    private progressEl: HTMLElement;
    private feedbackEl: HTMLElement;
    private inputSelect: HTMLSelectElement;
    private ignoreOctaveInput: HTMLInputElement;
    private showHintsInput: HTMLInputElement;
    private loopRangeInput: HTMLInputElement;
    private loopStatsEl: HTMLElement;
    private loopPassEl: HTMLElement;
    private loopStreakEl: HTMLElement;
    private loopWrongEl: HTMLElement;
    private loopResetButton: HTMLButtonElement;
    private restartButton: HTMLButtonElement;
    private showHints = true;
    private loopRange = false;
    private subscriptions: (() => void)[] = [];
    private lastMidiState: MidiInputState;

    public constructor(
        private api: alphaTab.AlphaTabApi,
        private midiService: MidiInputService,
        overlayHost: HTMLElement,
        private keyboardPanel: PianoKeyboard | null = null
    ) {
        this.lastMidiState = this.midiService.getState();
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
                        <label class="at-practice-label">
                            <input type="checkbox" data-practice-loop /> Loop range
                        </label>
                    </div>
                    <div class="at-practice-center">
                        <div class="at-practice-loop-stats hidden" data-practice-loop-stats>
                            <span class="at-practice-loop-counter" data-practice-loop-pass>Pass 1</span>
                            <span class="at-practice-loop-counter" data-practice-loop-streak>Clean 0</span>
                            <span class="at-practice-loop-counter" data-practice-loop-wrong>Wrong 0</span>
                            <button class="at-practice-loop-reset" type="button" data-practice-loop-reset>Reset</button>
                        </div>
                        <span class="at-practice-feedback" data-practice-feedback></span>
                        <span class="at-practice-progress" data-practice-progress>0 / 0</span>
                        <button class="at-practice-restart" type="button" data-practice-restart>Restart</button>
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
        this.loopRangeInput = this.root.querySelector('[data-practice-loop]')!;
        this.loopStatsEl = this.root.querySelector('[data-practice-loop-stats]')!;
        this.loopPassEl = this.root.querySelector('[data-practice-loop-pass]')!;
        this.loopStreakEl = this.root.querySelector('[data-practice-loop-streak]')!;
        this.loopWrongEl = this.root.querySelector('[data-practice-loop-wrong]')!;
        this.loopResetButton = this.root.querySelector('[data-practice-loop-reset]')!;
        this.restartButton = this.root.querySelector('[data-practice-restart]')!;

        this.loadSettings();
        this.applySettingsToInputs();
        this.wireUi();

        this.subscriptions.push(this.midiService.onStateChange(state => this.updateMidiState(state)));
        this.subscriptions.push(this.api.scoreLoaded.on(() => this.rebuildQueue()));
        this.subscriptions.push(this.api.renderFinished.on(() => this.rebuildQueue()));
        this.subscriptions.push(this.api.playbackRangeChanged.on(() => this.rebuildQueue()));
        this.subscriptions.push(this.api.postRenderFinished.on(() => this.refresh()));
        this.subscriptions.push(
            this.api.playerStateChanged.on(args => {
                if (args.stopped && this.session.getState().running) {
                    this.start();
                }
            })
        );

        this.rebuildQueue();
        this.updateMidiState(this.lastMidiState);
        this.refresh();

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
        this.overlay.dispose();
        this.root.remove();
    }

    private wireUi(): void {
        this.inputSelect.addEventListener('change', () => {
            this.midiService.selectInput(this.inputSelect.value);
        });
        this.ignoreOctaveInput.addEventListener('change', () => {
            this.session.setIgnoreOctave(this.ignoreOctaveInput.checked);
            this.refresh();
        });
        this.showHintsInput.addEventListener('change', () => {
            this.showHints = this.showHintsInput.checked;
            this.saveCustomSetting('showHints', this.showHints);
            this.refresh();
        });
        this.loopRangeInput.addEventListener('change', () => {
            this.loopRange = this.loopRangeInput.checked;
            this.saveCustomSetting('stepPracticeLoopEnabled', this.loopRange);
            this.rebuildQueue();
            if (this.root.classList.contains('open')) {
                this.start();
            }
        });
        this.loopResetButton.addEventListener('click', () => {
            this.session.resetLoopStats();
            this.feedbackEl.textContent = 'Loop stats reset.';
            this.feedbackEl.className = 'at-practice-feedback';
            this.refresh();
        });
        this.restartButton.addEventListener('click', () => this.restart());
    }

    private async connectMidi(): Promise<void> {
        await this.midiService.initMidi();
        this.updateMidiState(this.midiService.getState());
    }

    private start(): void {
        const currentTick = this.api.tickPosition;
        this.rebuildQueue();
        if (this.api.playerState === alphaTab.synth.PlayerState.Playing) {
            this.api.pause();
        }
        this.session.seekToTick(this.loopRange && this.api.playbackRange ? this.api.playbackRange.startTick : currentTick);
        const state = this.session.start();
        this.seekToCurrent(state);
        this.feedbackEl.textContent = state.total > 0 ? this.startFeedbackText() : 'No playable notes in the rendered score.';
        this.feedbackEl.className = 'at-practice-feedback';
        this.refresh();
    }

    private restart(): void {
        this.rebuildQueue();
        if (this.api.playerState === alphaTab.synth.PlayerState.Playing) {
            this.api.pause();
        }
        this.session.seekToTick(this.practiceStartTick());
        const state = this.session.start();
        this.seekToCurrent(state);
        this.feedbackEl.textContent = state.total > 0 ? this.startFeedbackText() : 'No playable notes in the rendered score.';
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
        const currentTick = this.api.tickPosition;
        const beats = getPlayableBeatsFromTracks(this.api.tracks);
        const fullQueue = buildPracticeQueue(beats, this.api.tickCache);
        const queue = this.loopRange ? filterPracticeQueueByRange(fullQueue, this.api.playbackRange) : fullQueue;
        const wasRunning = this.session.getState().running;

        this.session.setLoopEnabled(this.loopRange);
        this.session.setQueue(queue);
        if (wasRunning) {
            this.session.seekToTick(this.loopRange && this.api.playbackRange ? this.api.playbackRange.startTick : currentTick);
            const state = this.session.start();
            this.seekToCurrent(state);
        }

        this.overlay.clear();
        this.refresh();
    }

    public handleMidiNote(note: MidiNoteInput): void {
        let channel = 0;
        const currentItem = this.session.getState().currentItem;
        if (currentItem?.beat) {
            channel = (currentItem.beat as any).voice?.bar?.staff?.track?.playbackInfo?.primaryChannel ?? 0;
        }
        if (channel === 0 && this.api.tracks && this.api.tracks.length > 0) {
            channel = this.api.tracks[0].playbackInfo.primaryChannel;
        }

        this.keyboardPanel?.playInputNote(note.note, note.velocity, channel);

        const result = this.session.handleMidiNote(note.note);
        this.applyInputResult(result);
    }

    public handleMidiNoteOff(note: MidiNoteInput): void {
        this.keyboardPanel?.stopInputNote(note.note);
        const result = this.session.handleMidiNoteOff(note.note);
        this.applyInputResult(result);
    }

    public clearActiveInput(): void {
        this.keyboardPanel?.stopAllInputNotes();
        this.session.clearPressedNotes();
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
            case 'looped':
                this.feedbackEl.textContent = result.clean
                    ? 'Clean pass. Loop restarted.'
                    : `${result.wrongCount} ${result.wrongCount === 1 ? 'mistake' : 'mistakes'}. Loop restarted.`;
                this.feedbackEl.className = result.clean ? 'at-practice-feedback correct' : 'at-practice-feedback wrong';
                this.seekToCurrent(result.state);
                this.overlay.showItem(result.state.currentItem, result.state.matchedNotes);
                break;
            case 'complete':
                this.feedbackEl.textContent = 'Complete. Restart to repeat.';
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
        this.loopStatsEl.classList.toggle('hidden', !this.loopRange);
        this.progressEl.textContent = `${Math.min(state.currentIndex + (state.complete ? 0 : 1), state.total)} / ${state.total}`;
        this.loopPassEl.textContent = `Pass ${state.currentPass}`;
        this.loopStreakEl.textContent = `Clean ${state.cleanPassStreak}`;
        this.loopWrongEl.textContent = `Wrong ${state.wrongCount || state.lastPassWrongCount}`;
        this.restartButton.disabled = state.total === 0;

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

    private loadSettings(): void {
        try {
            const dataStr = localStorage.getItem('at-playground-settings');
            const data = dataStr ? JSON.parse(dataStr) : {};
            if (data?.custom?.showHints !== undefined) {
                this.showHints = !!data.custom.showHints;
            }
            if (data?.custom?.stepPracticeLoopEnabled !== undefined) {
                this.loopRange = !!data.custom.stepPracticeLoopEnabled;
            }
        } catch (e) {
            console.error('Failed to load saved settings:', e);
        }
    }

    private applySettingsToInputs(): void {
        this.showHintsInput.checked = this.showHints;
        this.loopRangeInput.checked = this.loopRange;
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

    private startFeedbackText(): string {
        if (!this.loopRange) {
            return 'Play the pulsing note at the cursor.';
        }
        return this.api.playbackRange ? 'Looping selected range.' : 'Looping the rendered score.';
    }

    private practiceStartTick(): number {
        return this.loopRange && this.api.playbackRange ? this.api.playbackRange.startTick : 0;
    }
}

function formatMidiNote(note: number): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}
