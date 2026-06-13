import * as alphaTab from '@coderline/alphatab';
import { MidiInputService, type MidiInputState, type MidiNoteInput } from '../../input/MidiInputService';
import { css, html, injectStyles, type Mountable, parseHtml } from '../../util/Dom';
import type { PianoKeyboard } from '../PianoKeyboard';
import {
    buildLoopTrainerQueue,
    buildPracticeQueue,
    defaultLoopTrainerSettings,
    getPlayableBeatsFromTracks,
    type LoopTrainerExpectedItem,
    type LoopTrainerPassResult,
    type LoopTrainerSettings,
    type LoopTrainerState,
    LoopTrainerSession,
    type PracticeInputResult,
    type PracticeQueueItem,
    PracticeSession,
    type PracticeSessionState
} from './PracticeController';
import { PracticeOverlay } from './PracticeOverlay';

type PracticeMode = 'step' | 'loop';

interface PositionSample {
    timestampMs: number;
    tick: number;
}

interface PlaybackSnapshot {
    playbackSpeed: number;
    isLooping: boolean;
    playbackRange: alphaTab.synth.PlaybackRange | null;
}

const positionBufferSize = 80;

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
    .at-practice-loop-controls {
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
    .at-midi-select,
    .at-practice-mode,
    .at-loop-speed {
        font: inherit;
        font-weight: 600;
        border: 1px solid var(--at-border);
        border-radius: 4px;
        background: var(--at-bg);
        color: var(--at-text);
        padding: 2px 8px;
        outline: none;
        cursor: pointer;
    }
    .at-midi-select {
        max-width: 180px;
    }
    .at-loop-speed {
        width: 56px;
        text-align: center;
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
    .at-loop-counter {
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
        max-width: 240px;
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
    .at-loop-button {
        border: 1px solid var(--at-border);
        border-radius: 4px;
        background: var(--at-bg);
        color: var(--at-text);
        font: inherit;
        font-weight: 700;
        padding: 3px 8px;
        cursor: pointer;
    }
    .at-loop-button.primary {
        background: #1f6feb;
        border-color: #1f6feb;
        color: #ffffff;
    }
    .at-practice-loop-controls.hidden,
    .at-step-only.hidden {
        display: none;
    }
    `
);

export class PracticePanel implements Mountable {
    readonly root: HTMLElement;
    private midiService = new MidiInputService();
    private session = new PracticeSession<alphaTab.model.Beat>();
    private loopTrainer = new LoopTrainerSession<alphaTab.model.Beat>();
    private overlay: PracticeOverlay;
    private indicatorEl: HTMLElement;
    private progressEl: HTMLElement;
    private feedbackEl: HTMLElement;
    private inputSelect: HTMLSelectElement;
    private modeSelect: HTMLSelectElement;
    private ignoreOctaveInput: HTMLInputElement;
    private showHintsInput: HTMLInputElement;
    private loopControlsEl: HTMLElement;
    private startStopButton: HTMLButtonElement;
    private startSpeedInput: HTMLInputElement;
    private targetSpeedInput: HTMLInputElement;
    private resetStatsButton: HTMLButtonElement;
    private passCounterEl: HTMLElement;
    private streakCounterEl: HTMLElement;
    private wrongCounterEl: HTMLElement;
    private missedCounterEl: HTMLElement;
    private speedCounterEl: HTMLElement;
    private showHints = true;
    private mode: PracticeMode = 'step';
    private loopSettings: LoopTrainerSettings = { ...defaultLoopTrainerSettings };
    private playbackSnapshot: PlaybackSnapshot | null = null;
    private positionSamples: PositionSample[] = [];
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
                        <select class="at-practice-mode" data-practice-mode aria-label="Practice mode">
                            <option value="step">Step Practice</option>
                            <option value="loop">Loop Trainer</option>
                        </select>
                        <label class="at-practice-label at-step-only">
                            <input type="checkbox" data-practice-octave /> Ignore octave
                        </label>
                        <label class="at-practice-label">
                            <input type="checkbox" data-practice-hints /> Show hints
                        </label>
                    </div>
                    <div class="at-practice-center">
                        <div class="at-practice-loop-controls hidden" data-loop-controls>
                            <button class="at-loop-button primary" type="button" data-loop-start>Start</button>
                            <label class="at-practice-label">
                                Start
                                <input class="at-loop-speed" type="number" min="0.1" max="1" step="0.1" data-loop-start-speed />
                            </label>
                            <label class="at-practice-label">
                                Target
                                <input class="at-loop-speed" type="number" min="0.1" max="1" step="0.1" data-loop-target-speed />
                            </label>
                            <button class="at-loop-button" type="button" data-loop-reset>Reset</button>
                            <span class="at-loop-counter" data-loop-pass>Pass 0</span>
                            <span class="at-loop-counter" data-loop-streak>Clean 0</span>
                            <span class="at-loop-counter" data-loop-wrong>Wrong 0</span>
                            <span class="at-loop-counter" data-loop-missed>Missed 0</span>
                            <span class="at-loop-counter" data-loop-speed>0.7x</span>
                        </div>
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
        this.modeSelect = this.root.querySelector('[data-practice-mode]')!;
        this.ignoreOctaveInput = this.root.querySelector('[data-practice-octave]')!;
        this.showHintsInput = this.root.querySelector('[data-practice-hints]')!;
        this.loopControlsEl = this.root.querySelector('[data-loop-controls]')!;
        this.startStopButton = this.root.querySelector('[data-loop-start]')!;
        this.startSpeedInput = this.root.querySelector('[data-loop-start-speed]')!;
        this.targetSpeedInput = this.root.querySelector('[data-loop-target-speed]')!;
        this.resetStatsButton = this.root.querySelector('[data-loop-reset]')!;
        this.passCounterEl = this.root.querySelector('[data-loop-pass]')!;
        this.streakCounterEl = this.root.querySelector('[data-loop-streak]')!;
        this.wrongCounterEl = this.root.querySelector('[data-loop-wrong]')!;
        this.missedCounterEl = this.root.querySelector('[data-loop-missed]')!;
        this.speedCounterEl = this.root.querySelector('[data-loop-speed]')!;

        this.loadSettings();
        this.applySettingsToInputs();
        this.wireUi();

        this.subscriptions.push(this.midiService.onStateChange(state => this.updateMidiState(state)));
        this.subscriptions.push(this.midiService.onMidiNote(note => this.handleMidiNote(note)));
        this.subscriptions.push(this.midiService.onMidiNoteOff(note => this.handleMidiNoteOff(note)));
        this.subscriptions.push(this.api.scoreLoaded.on(() => this.rebuildQueue()));
        this.subscriptions.push(this.api.renderFinished.on(() => this.rebuildQueue()));
        this.subscriptions.push(this.api.postRenderFinished.on(() => this.refresh()));
        this.subscriptions.push(this.api.playerPositionChanged.on(args => this.handlePlayerPosition(args.currentTick)));
        this.subscriptions.push(
            this.api.playerStateChanged.on(args => {
                if (this.mode === 'step' && args.stopped && this.session.getState().running) {
                    this.startStepPractice();
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
            if (this.mode === 'step') {
                this.startStepPractice();
            } else {
                this.feedbackEl.textContent = 'Set a range or use the full score, then start trainer.';
                this.feedbackEl.className = 'at-practice-feedback';
                this.refresh();
            }
        } else {
            this.stopCurrentMode();
        }
    }

    public dispose(): void {
        this.stopLoopTrainer();
        for (const unsubscribe of this.subscriptions) {
            unsubscribe();
        }
        this.subscriptions = [];
        this.midiService.dispose();
        this.overlay.dispose();
        this.root.remove();
    }

    private wireUi(): void {
        this.inputSelect.addEventListener('change', () => {
            this.midiService.selectInput(this.inputSelect.value);
        });
        this.modeSelect.addEventListener('change', () => {
            this.setMode(this.modeSelect.value === 'loop' ? 'loop' : 'step');
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
        this.startStopButton.addEventListener('click', () => {
            if (this.loopTrainer.getState().running) {
                this.stopLoopTrainer();
            } else {
                this.startLoopTrainer();
            }
            this.refresh();
        });
        this.startSpeedInput.addEventListener('change', () => {
            this.loopSettings.startSpeed = this.readSpeedInput(this.startSpeedInput, defaultLoopTrainerSettings.startSpeed);
            this.startSpeedInput.value = this.loopSettings.startSpeed.toFixed(1);
            this.saveCustomSetting('loopTrainerStartSpeed', this.loopSettings.startSpeed);
        });
        this.targetSpeedInput.addEventListener('change', () => {
            this.loopSettings.targetSpeed = this.readSpeedInput(this.targetSpeedInput, defaultLoopTrainerSettings.targetSpeed);
            this.targetSpeedInput.value = this.loopSettings.targetSpeed.toFixed(1);
            this.saveCustomSetting('loopTrainerTargetSpeed', this.loopSettings.targetSpeed);
        });
        this.resetStatsButton.addEventListener('click', () => {
            this.loopTrainer.resetStats();
            this.feedbackEl.textContent = 'Loop stats reset.';
            this.feedbackEl.className = 'at-practice-feedback';
            this.refreshLoopUi(this.loopTrainer.getState());
        });
    }

    private async connectMidi(): Promise<void> {
        await this.midiService.initMidi();
        this.updateMidiState(this.midiService.getState());
    }

    private setMode(mode: PracticeMode): void {
        if (this.mode === mode) {
            return;
        }

        this.stopCurrentMode();
        this.mode = mode;
        this.modeSelect.value = mode;
        this.refresh();
        if (this.root.classList.contains('open') && mode === 'step') {
            this.startStepPractice();
        } else if (mode === 'loop') {
            this.feedbackEl.textContent = 'Set a range or use the full score, then start trainer.';
            this.feedbackEl.className = 'at-practice-feedback';
        }
    }

    private stopCurrentMode(): void {
        if (this.mode === 'loop') {
            this.stopLoopTrainer();
        } else {
            this.stopStepPractice();
        }
    }

    private startStepPractice(): void {
        const currentTick = this.api.tickPosition;
        this.rebuildQueue();
        if (this.api.playerState === alphaTab.synth.PlayerState.Playing) {
            this.api.pause();
        }
        this.session.seekToTick(currentTick);
        const state = this.session.start();
        this.seekToCurrent(state);
        this.feedbackEl.textContent =
            state.total > 0 ? 'Play the highlighted note.' : 'No playable notes in the rendered score.';
        this.feedbackEl.className = 'at-practice-feedback';
        this.refresh();
    }

    private stopStepPractice(): void {
        this.session.stop();
        this.overlay.clear();
        this.keyboardPanel?.clearHints();
        this.feedbackEl.textContent = 'Practice stopped.';
        this.feedbackEl.className = 'at-practice-feedback';
        this.refresh();
    }

    private startLoopTrainer(): void {
        this.stopStepPractice();
        this.loopTrainer.configure(this.loopSettings);

        const range = this.snapshotLoopRange();
        const queue = buildLoopTrainerQueue(getPlayableBeatsFromTracks(this.api.tracks), this.api.tickCache, range);
        const state = this.loopTrainer.start(queue);
        if (!state.running) {
            this.feedbackEl.textContent = 'No playable notes in the loop range.';
            this.feedbackEl.className = 'at-practice-feedback wrong';
            this.refreshLoopUi(state);
            return;
        }

        this.playbackSnapshot = {
            playbackSpeed: this.api.playbackSpeed,
            isLooping: this.api.isLooping,
            playbackRange: this.copyPlaybackRange(this.api.playbackRange)
        };
        this.positionSamples = [];
        this.api.playbackRange = range;
        this.api.isLooping = true;
        this.api.playbackSpeed = state.speed;
        this.api.tickPosition = range.startTick;
        this.api.play();
        this.feedbackEl.textContent = 'Loop trainer running.';
        this.feedbackEl.className = 'at-practice-feedback';
        this.refreshLoopUi(state);
    }

    private stopLoopTrainer(): void {
        const wasRunning = this.loopTrainer.getState().running;
        this.loopTrainer.stop();
        if (wasRunning && this.api.playerState === alphaTab.synth.PlayerState.Playing) {
            this.api.pause();
        }
        if (this.playbackSnapshot) {
            this.api.playbackSpeed = this.playbackSnapshot.playbackSpeed;
            this.api.isLooping = this.playbackSnapshot.isLooping;
            this.api.playbackRange = this.copyPlaybackRange(this.playbackSnapshot.playbackRange);
            this.playbackSnapshot = null;
        }
        this.positionSamples = [];
        this.overlay.clear();
        this.keyboardPanel?.clearHints();
        this.feedbackEl.textContent = 'Loop trainer stopped.';
        this.feedbackEl.className = 'at-practice-feedback';
    }

    private rebuildQueue(): void {
        if (this.mode === 'loop' && this.loopTrainer.getState().running) {
            return;
        }

        const currentTick = this.api.tickPosition;
        const beats = getPlayableBeatsFromTracks(this.api.tracks);
        const queue = buildPracticeQueue(beats, this.api.tickCache);
        const wasRunning = this.session.getState().running;

        this.session.setQueue(queue);
        if (wasRunning && this.mode === 'step') {
            this.session.seekToTick(currentTick);
            const state = this.session.start();
            this.seekToCurrent(state);
        }

        this.overlay.clear();
        this.refresh();
    }

    private handleMidiNote(note: MidiNoteInput): void {
        const channel = this.getInputChannel();
        this.keyboardPanel?.playInputNote(note.note, note.velocity, channel);

        if (this.mode === 'loop') {
            this.handleLoopMidiNote(note);
            return;
        }

        const result = this.session.handleMidiNote(note.note);
        this.applyInputResult(result);
    }

    private handleMidiNoteOff(note: MidiNoteInput): void {
        this.keyboardPanel?.stopInputNote(note.note);
    }

    private handleLoopMidiNote(note: MidiNoteInput): void {
        const tick = this.findTickForTimestamp(note.timestampMs);
        const result = this.loopTrainer.handleMidiNote(note.note, tick);
        switch (result.type) {
            case 'ignored':
            case 'duplicate':
                return;
            case 'matched':
                this.feedbackEl.textContent = 'Correct.';
                this.feedbackEl.className = 'at-practice-feedback correct';
                this.overlay.flash(this.toPracticeQueueItem(result.item), 'correct');
                break;
            case 'wrong':
                this.feedbackEl.textContent = `Wrong note: ${formatMidiNote(result.inputNote)}`;
                this.feedbackEl.className = 'at-practice-feedback wrong';
                this.overlay.flash(this.toPracticeQueueItem(this.loopTrainer.getCurrentItem(tick)), 'wrong');
                break;
        }
        this.refreshLoopUi(result.state);
    }

    private handlePlayerPosition(tick: number): void {
        const timestampMs = performance.now();
        this.positionSamples.push({ timestampMs, tick });
        if (this.positionSamples.length > positionBufferSize) {
            this.positionSamples.shift();
        }

        if (this.mode !== 'loop') {
            return;
        }

        const pass = this.loopTrainer.updateTick(tick);
        if (pass) {
            this.applyLoopPass(pass);
        } else {
            const current = this.loopTrainer.getCurrentItem(tick);
            if (current) {
                this.overlay.showItem(this.toPracticeQueueItem(current));
                if (this.showHints) {
                    this.keyboardPanel?.setHintNotes(this.getExpectedNotesForBeat(current.beat));
                }
            }
        }
        this.refreshLoopUi(this.loopTrainer.getState());
    }

    private applyLoopPass(pass: LoopTrainerPassResult<alphaTab.model.Beat>): void {
        if (pass.stats.clean) {
            this.feedbackEl.textContent = pass.speedChanged ? `Speed up to ${this.loopTrainer.getState().speed.toFixed(1)}x` : 'Clean pass';
            this.feedbackEl.className = 'at-practice-feedback correct';
        } else {
            const mistakes = pass.stats.wrongCount + pass.stats.missedCount;
            this.feedbackEl.textContent = `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}`;
            this.feedbackEl.className = 'at-practice-feedback wrong';
            if (pass.missedItems.length > 0) {
                this.overlay.flashItems(
                    pass.missedItems
                        .slice(0, 12)
                        .map(item => this.toPracticeQueueItem(item))
                        .filter((item): item is PracticeQueueItem<alphaTab.model.Beat> => item !== null),
                    'missed'
                );
            }
        }
        if (pass.speedChanged) {
            this.api.playbackSpeed = this.loopTrainer.getState().speed;
        }
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
        const isLoop = this.mode === 'loop';
        this.modeSelect.value = this.mode;
        this.loopControlsEl.classList.toggle('hidden', !isLoop);
        for (const el of Array.from(this.root.querySelectorAll('.at-step-only'))) {
            el.classList.toggle('hidden', isLoop);
        }

        if (isLoop) {
            this.progressEl.textContent = '';
            this.refreshLoopUi(this.loopTrainer.getState());
            return;
        }

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

    private refreshLoopUi(state: LoopTrainerState): void {
        this.startStopButton.textContent = state.running ? 'Stop' : 'Start';
        this.passCounterEl.textContent = `Pass ${state.currentPass}`;
        this.streakCounterEl.textContent = `Clean ${state.cleanPassStreak}`;
        this.wrongCounterEl.textContent = `Wrong ${state.lastPass?.wrongCount ?? 0}`;
        this.missedCounterEl.textContent = `Missed ${state.lastPass?.missedCount ?? 0}`;
        this.speedCounterEl.textContent = `${state.speed.toFixed(1)}x`;
        this.progressEl.textContent = state.running
            ? `${countMatched(this.loopTrainer.getExpectedItems())} / ${this.loopTrainer.getExpectedItems().length}`
            : '0 / 0';
        if (!state.running && this.mode === 'loop') {
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
            this.loopSettings = {
                startSpeed: Number(data?.custom?.loopTrainerStartSpeed ?? defaultLoopTrainerSettings.startSpeed),
                targetSpeed: Number(data?.custom?.loopTrainerTargetSpeed ?? defaultLoopTrainerSettings.targetSpeed),
                cleanPassesRequired: Number(
                    data?.custom?.loopTrainerCleanPasses ?? defaultLoopTrainerSettings.cleanPassesRequired
                ),
                speedIncrement: Number(data?.custom?.loopTrainerSpeedIncrement ?? defaultLoopTrainerSettings.speedIncrement)
            };
        } catch (e) {
            console.error('Failed to load saved settings:', e);
        }
        this.saveCustomSetting('loopTrainerCleanPasses', this.loopSettings.cleanPassesRequired);
        this.saveCustomSetting('loopTrainerSpeedIncrement', this.loopSettings.speedIncrement);
    }

    private applySettingsToInputs(): void {
        this.showHintsInput.checked = this.showHints;
        this.startSpeedInput.value = this.loopSettings.startSpeed.toFixed(1);
        this.targetSpeedInput.value = this.loopSettings.targetSpeed.toFixed(1);
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

    private findTickForTimestamp(timestampMs: number): number {
        if (this.positionSamples.length === 0) {
            return this.api.tickPosition;
        }

        let best = this.positionSamples[0];
        let bestDiff = Math.abs(best.timestampMs - timestampMs);
        for (const sample of this.positionSamples) {
            const diff = Math.abs(sample.timestampMs - timestampMs);
            if (diff < bestDiff) {
                best = sample;
                bestDiff = diff;
            }
        }
        return best.tick;
    }

    private snapshotLoopRange(): alphaTab.synth.PlaybackRange {
        const current = this.api.playbackRange;
        if (current) {
            return this.copyPlaybackRange(current)!;
        }

        const startTick = 0;
        const lastStartTick = Math.max(
            ...buildPracticeQueue(getPlayableBeatsFromTracks(this.api.tracks), this.api.tickCache).map(item => item.startTick),
            0
        );
        const endTick = this.api.endTick || Math.max(1, lastStartTick + 1);
        return { startTick, endTick } as alphaTab.synth.PlaybackRange;
    }

    private copyPlaybackRange(range: alphaTab.synth.PlaybackRange | null): alphaTab.synth.PlaybackRange | null {
        if (!range) {
            return null;
        }
        return { startTick: range.startTick, endTick: range.endTick } as alphaTab.synth.PlaybackRange;
    }

    private getInputChannel(): number {
        const currentItem = this.mode === 'step' ? this.session.getState().currentItem : null;
        if (currentItem?.beat) {
            return (currentItem.beat as any).voice?.bar?.staff?.track?.playbackInfo?.primaryChannel ?? 0;
        }
        if (this.api.tracks && this.api.tracks.length > 0) {
            return this.api.tracks[0].playbackInfo.primaryChannel;
        }
        return 0;
    }

    private getExpectedNotesForBeat(beat: alphaTab.model.Beat): number[] {
        return Array.from(
            new Set(
                this.loopTrainer
                    .getExpectedItems()
                    .filter(item => item.beat === beat)
                    .map(item => item.pitch)
            )
        );
    }

    private toPracticeQueueItem(
        item: LoopTrainerExpectedItem<alphaTab.model.Beat> | null
    ): PracticeQueueItem<alphaTab.model.Beat> | null {
        if (!item) {
            return null;
        }
        return {
            beat: item.beat,
            expectedNotes: this.getExpectedNotesForBeat(item.beat),
            startTick: item.startTick
        };
    }

    private readSpeedInput(input: HTMLInputElement, fallback: number): number {
        if (!Number.isFinite(input.valueAsNumber)) {
            return fallback;
        }
        return Math.min(1, Math.max(0.1, Math.round(input.valueAsNumber * 10) / 10));
    }
}

function formatMidiNote(note: number): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}

function countMatched(items: readonly LoopTrainerExpectedItem[]): number {
    return items.filter(item => item.matched).length;
}
