import type * as alphaTab from '@coderline/alphatab';
import type { MidiInputService, MidiInputState, MidiNoteInput } from '../../input/MidiInputService';
import { css, html, injectStyles, type Mountable, parseHtml } from '../../util/Dom';
import type { PianoKeyboard } from '../PianoKeyboard';
import {
    buildPracticeQueue,
    defaultPerformSettings,
    filterPracticeQueueByRange,
    getPlayableBeatsFromTracks,
    type PerformExpectedItem,
    type PerformInputResult,
    type PerformPassResult,
    PerformSession,
    type PerformSettings,
    type PracticeQueueItem,
    resolvePracticeInputChannel,
    selectTempoCursorItem
} from './PracticeController';
import { PracticeOverlay } from './PracticeOverlay';
import { TempoCursorOverlay } from './TempoCursorOverlay';

interface PlaybackSnapshot {
    playbackSpeed: number;
    isLooping: boolean;
    metronomeVolume: number;
    countInVolume: number;
    playbackRange: alphaTab.synth.PlaybackRange | null;
    tracks: Array<{ track: alphaTab.model.Track; isMute: boolean; isSolo: boolean }>;
}

interface PositionSample {
    timestampMs: number;
    currentTick: number;
    currentTimeMs: number;
    endTick: number;
}

interface PerformBuildResult {
    expectedItems: PerformExpectedItem<alphaTab.model.Beat>[];
    tempoQueue: PracticeQueueItem<alphaTab.model.Beat>[];
}

const positionBufferSize = 80;
const performLeadInTicks = 3840;
const performHintLeadInMs = 1000;

injectStyles(
    'PerformPanel',
    css`
    .at-footer-perform {
        display: none;
        border-top: 1px solid var(--at-border);
        background: var(--at-bg);
        color: var(--at-text);
        padding: 8px 12px;
    }
    .at-footer-perform.open {
        display: block;
    }
    .at-perform-panel,
    .at-perform-left,
    .at-perform-center,
    .at-perform-stats {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        min-width: 0;
        font-size: 13px;
    }
    .at-perform-panel {
        justify-content: space-between;
    }
    .at-perform-center {
        flex: 1;
        justify-content: flex-end;
    }
    .at-perform-label,
    .at-perform-midi-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        white-space: nowrap;
    }
    .at-perform-midi-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6b7280;
        display: inline-block;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
    }
    .at-perform-midi-indicator.connected {
        background: #10b981;
        box-shadow: 0 0 6px #10b981;
    }
    .at-perform-midi-indicator.connecting {
        background: #f59e0b;
        box-shadow: 0 0 6px #f59e0b;
    }
    .at-perform-midi-indicator.error {
        background: #ef4444;
        box-shadow: 0 0 6px #ef4444;
    }
    .at-perform-midi-select,
    .at-perform-speed {
        font: inherit;
        font-weight: 600;
        border: 1px solid var(--at-border);
        border-radius: 4px;
        background: var(--at-bg);
        color: var(--at-text);
        padding: 2px 8px;
        outline: none;
    }
    .at-perform-midi-select {
        max-width: 180px;
    }
    .at-perform-speed {
        width: 56px;
    }
    .at-perform-counter {
        font-weight: 700;
        background: var(--at-border);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        color: var(--at-text);
        white-space: nowrap;
    }
    .at-perform-button {
        border: 1px solid var(--at-border);
        border-radius: 4px;
        background: var(--at-bg);
        color: var(--at-text);
        font: inherit;
        font-weight: 700;
        padding: 3px 8px;
        cursor: pointer;
    }
    .at-perform-button.primary {
        background: #1f6feb;
        border-color: #1f6feb;
        color: #ffffff;
    }
    .at-perform-button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .at-perform-feedback {
        font-weight: 600;
        color: var(--at-text);
        min-width: 0;
        max-width: 240px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .at-perform-feedback.correct {
        color: #10b981;
    }
    .at-perform-feedback.wrong {
        color: #ef4444;
    }
    `
);

export class PerformPanel implements Mountable {
    readonly root: HTMLElement;
    private session = new PerformSession<alphaTab.model.Beat>();
    private overlay: PracticeOverlay;
    private tempoOverlay: TempoCursorOverlay;
    private subscriptions: (() => void)[] = [];
    private lastMidiState: MidiInputState;
    private settings: PerformSettings = { ...defaultPerformSettings };
    private showHints = true;
    private showTempoCursor = true;
    private loopEnabled = false;
    private snapshot: PlaybackSnapshot | null = null;
    private restored = true;
    private positionSamples: PositionSample[] = [];
    private previousTick = 0;
    private tempoQueue: PracticeQueueItem<alphaTab.model.Beat>[] = [];

    private indicatorEl: HTMLElement;
    private inputSelect: HTMLSelectElement;
    private ignoreOctaveInput: HTMLInputElement;
    private showHintsInput: HTMLInputElement;
    private showTempoCursorInput: HTMLInputElement;
    private loopInput: HTMLInputElement;
    private startSpeedInput: HTMLInputElement;
    private targetSpeedInput: HTMLInputElement;
    private startStopButton: HTMLButtonElement;
    private resetButton: HTMLButtonElement;
    private feedbackEl: HTMLElement;
    private passEl: HTMLElement;
    private correctEl: HTMLElement;
    private wrongEl: HTMLElement;
    private missedEl: HTMLElement;
    private earlyEl: HTMLElement;
    private lateEl: HTMLElement;
    private cleanEl: HTMLElement;
    private speedEl: HTMLElement;

    public constructor(
        private api: alphaTab.AlphaTabApi,
        private midiService: MidiInputService,
        overlayHost: HTMLElement,
        private keyboardPanel: PianoKeyboard | null = null
    ) {
        this.lastMidiState = this.midiService.getState();
        this.root = parseHtml(html`
            <div class="at-footer-perform">
                <div class="at-perform-panel">
                    <div class="at-perform-left">
                        <div class="at-perform-midi-status">
                            <span class="at-perform-midi-indicator" data-perform-indicator></span>
                            <select class="at-perform-midi-select" data-perform-input aria-label="MIDI input"></select>
                        </div>
                        <label class="at-perform-label"><input type="checkbox" data-perform-octave /> Ignore octave</label>
                        <label class="at-perform-label"><input type="checkbox" data-perform-hints /> Show hints</label>
                        <label class="at-perform-label"><input type="checkbox" data-perform-tempo-cursor /> Tempo cursor</label>
                        <label class="at-perform-label"><input type="checkbox" data-perform-loop /> Loop range</label>
                        <label class="at-perform-label">Start <input class="at-perform-speed" type="number" min="0.1" max="1" step="0.1" data-perform-start-speed /></label>
                        <label class="at-perform-label">Target <input class="at-perform-speed" type="number" min="0.1" max="1" step="0.1" data-perform-target-speed /></label>
                    </div>
                    <div class="at-perform-center">
                        <button class="at-perform-button primary" type="button" data-perform-start>Start</button>
                        <button class="at-perform-button" type="button" data-perform-reset>Reset</button>
                        <div class="at-perform-stats">
                            <span class="at-perform-counter" data-perform-pass>Pass 1</span>
                            <span class="at-perform-counter" data-perform-correct>Correct 0</span>
                            <span class="at-perform-counter" data-perform-wrong>Wrong 0</span>
                            <span class="at-perform-counter" data-perform-missed>Missed 0</span>
                            <span class="at-perform-counter" data-perform-early>Early 0</span>
                            <span class="at-perform-counter" data-perform-late>Late 0</span>
                            <span class="at-perform-counter" data-perform-clean>Clean 0</span>
                            <span class="at-perform-counter" data-perform-speed>0.7x</span>
                        </div>
                        <span class="at-perform-feedback" data-perform-feedback></span>
                    </div>
                </div>
            </div>
        `);

        this.overlay = new PracticeOverlay(api, overlayHost);
        this.tempoOverlay = new TempoCursorOverlay(api, overlayHost);
        this.indicatorEl = this.root.querySelector('[data-perform-indicator]')!;
        this.inputSelect = this.root.querySelector('[data-perform-input]')!;
        this.ignoreOctaveInput = this.root.querySelector('[data-perform-octave]')!;
        this.showHintsInput = this.root.querySelector('[data-perform-hints]')!;
        this.showTempoCursorInput = this.root.querySelector('[data-perform-tempo-cursor]')!;
        this.loopInput = this.root.querySelector('[data-perform-loop]')!;
        this.startSpeedInput = this.root.querySelector('[data-perform-start-speed]')!;
        this.targetSpeedInput = this.root.querySelector('[data-perform-target-speed]')!;
        this.startStopButton = this.root.querySelector('[data-perform-start]')!;
        this.resetButton = this.root.querySelector('[data-perform-reset]')!;
        this.feedbackEl = this.root.querySelector('[data-perform-feedback]')!;
        this.passEl = this.root.querySelector('[data-perform-pass]')!;
        this.correctEl = this.root.querySelector('[data-perform-correct]')!;
        this.wrongEl = this.root.querySelector('[data-perform-wrong]')!;
        this.missedEl = this.root.querySelector('[data-perform-missed]')!;
        this.earlyEl = this.root.querySelector('[data-perform-early]')!;
        this.lateEl = this.root.querySelector('[data-perform-late]')!;
        this.cleanEl = this.root.querySelector('[data-perform-clean]')!;
        this.speedEl = this.root.querySelector('[data-perform-speed]')!;

        this.loadSettings();
        this.applySettingsToInputs();
        this.wireUi();

        this.subscriptions.push(this.midiService.onStateChange(state => this.updateMidiState(state)));
        this.subscriptions.push(this.api.playerPositionChanged.on(args => this.handlePlayerPosition(args)));
        this.subscriptions.push(this.api.playerFinished.on(() => this.handlePlayerFinished()));
        this.subscriptions.push(
            this.api.playerStateChanged.on(args => {
                if (args.stopped && this.session.getState().running) {
                    this.stop('Perform stopped.');
                }
            })
        );
        this.subscriptions.push(this.api.scoreLoaded.on(() => this.stop('Perform stopped.')));
        this.subscriptions.push(this.api.renderFinished.on(() => this.stop('Perform stopped.')));

        this.updateMidiState(this.lastMidiState);
        this.refresh();
        this.connectMidi();
    }

    public setOpen(open: boolean): void {
        this.root.classList.toggle('open', open);
        if (open) {
            this.connectMidi();
            this.feedbackEl.textContent = 'Ready to perform.';
            this.refresh();
        } else {
            this.stop('Perform stopped.');
        }
    }

    public dispose(): void {
        this.stop('Perform stopped.');
        for (const unsubscribe of this.subscriptions) {
            unsubscribe();
        }
        this.subscriptions = [];
        this.overlay.dispose();
        this.tempoOverlay.dispose();
        this.root.remove();
    }

    public handleMidiNote(note: MidiNoteInput): void {
        this.keyboardPanel?.playInputNote(note.note, note.velocity, this.getInputChannel(note.note));
        const result = this.session.handleNoteOn(note.note, note.timestampMs);
        this.applyInputResult(result);
    }

    public handleMidiNoteOff(note: MidiNoteInput): void {
        this.keyboardPanel?.stopInputNote(note.note);
    }

    public clearActiveInput(): void {
        this.keyboardPanel?.stopAllInputNotes();
    }

    private wireUi(): void {
        this.inputSelect.addEventListener('change', () => this.midiService.selectInput(this.inputSelect.value));
        this.ignoreOctaveInput.addEventListener('change', () => {
            if (this.session.getState().running) {
                this.applySettingsToInputs();
                return;
            }
            this.settings.ignoreOctave = this.ignoreOctaveInput.checked;
            this.session.configure(this.settings);
        });
        this.showHintsInput.addEventListener('change', () => {
            this.showHints = this.showHintsInput.checked;
            this.saveCustomSetting('performShowHints', this.showHints);
            this.refresh();
        });
        this.showTempoCursorInput.addEventListener('change', () => {
            this.showTempoCursor = this.showTempoCursorInput.checked;
            this.saveCustomSetting('performTempoCursor', this.showTempoCursor);
            if (this.showTempoCursor) {
                this.updateTempoCursor(this.api.tickPosition);
            } else {
                this.tempoOverlay.clear();
            }
        });
        this.loopInput.addEventListener('change', () => {
            if (this.session.getState().running) {
                this.applySettingsToInputs();
                return;
            }
            this.loopEnabled = this.loopInput.checked;
            this.saveCustomSetting('performLoopEnabled', this.loopEnabled);
        });
        this.startSpeedInput.addEventListener('change', () => {
            if (this.session.getState().running) {
                this.applySettingsToInputs();
                return;
            }
            this.settings.startSpeed = this.readSpeed(this.startSpeedInput, defaultPerformSettings.startSpeed);
            this.startSpeedInput.value = this.settings.startSpeed.toFixed(1);
            this.saveCustomSetting('performStartSpeed', this.settings.startSpeed);
            this.session.configure(this.settings);
        });
        this.targetSpeedInput.addEventListener('change', () => {
            if (this.session.getState().running) {
                this.applySettingsToInputs();
                return;
            }
            this.settings.targetSpeed = this.readSpeed(this.targetSpeedInput, defaultPerformSettings.targetSpeed);
            this.targetSpeedInput.value = this.settings.targetSpeed.toFixed(1);
            this.saveCustomSetting('performTargetSpeed', this.settings.targetSpeed);
            this.session.configure(this.settings);
        });
        this.startStopButton.addEventListener('click', () => {
            if (this.session.getState().running) {
                this.stop('Perform stopped.');
            } else {
                this.start();
            }
        });
        this.resetButton.addEventListener('click', () => {
            this.session.resetStats();
            this.feedbackEl.textContent = 'Perform stats reset.';
            this.feedbackEl.className = 'at-perform-feedback';
            this.refresh();
        });
    }

    private async connectMidi(): Promise<void> {
        await this.midiService.initMidi();
        this.updateMidiState(this.midiService.getState());
    }

    private start(): void {
        this.stop('Perform stopped.');
        const selectedRange = this.copyPlaybackRange(this.api.playbackRange);
        const buildResult = this.buildPerformItems(selectedRange);
        const expectedItems = buildResult.expectedItems;
        if (expectedItems.length === 0) {
            this.feedbackEl.textContent = 'No playable notes in range.';
            this.feedbackEl.className = 'at-perform-feedback wrong';
            this.tempoOverlay.clear();
            this.refresh();
            return;
        }
        this.tempoQueue = buildResult.tempoQueue;

        this.snapshot = {
            playbackSpeed: this.api.playbackSpeed,
            isLooping: this.api.isLooping,
            metronomeVolume: this.api.metronomeVolume,
            countInVolume: this.api.countInVolume,
            playbackRange: this.copyPlaybackRange(this.api.playbackRange),
            tracks: (this.api.score?.tracks ?? []).map(track => ({
                track,
                isMute: track.playbackInfo.isMute,
                isSolo: track.playbackInfo.isSolo
            }))
        };
        this.restored = false;
        this.positionSamples = [];
        const playbackStartTick = this.getLeadInStartTick(selectedRange, expectedItems[0].startTick);
        const playbackRange = this.getLeadInPlaybackRange(selectedRange, playbackStartTick);
        this.previousTick = playbackStartTick;
        this.session.configure(this.settings);
        const state = this.session.start(expectedItems);

        if (this.api.player) {
            this.api.player.silentScorePlayback = true;
        }
        this.api.playbackRange = playbackRange;
        this.api.isLooping = this.loopEnabled;
        this.api.playbackSpeed = state.speed;
        this.api.metronomeVolume = 0.1;
        this.api.countInVolume = 0.1;
        this.api.tickPosition = playbackStartTick;
        this.api.play();
        this.feedbackEl.textContent = 'Perform running.';
        this.feedbackEl.className = 'at-perform-feedback';
        this.updateTempoCursor(this.previousTick);
        this.refresh();
    }

    private stop(feedback: string): void {
        const wasRunning = this.session.getState().running || !this.restored;
        this.session.stop();
        this.restorePlayback();
        this.overlay.clear();
        this.tempoOverlay.clear();
        this.tempoQueue = [];
        this.keyboardPanel?.clearHints();
        this.keyboardPanel?.stopAllInputNotes();
        if (wasRunning) {
            this.feedbackEl.textContent = feedback;
            this.feedbackEl.className = 'at-perform-feedback';
        }
        this.refresh();
    }

    private restorePlayback(): void {
        const snapshot = this.snapshot;
        this.snapshot = null;
        if (!snapshot) {
            return;
        }
        this.restored = true;
        this.api.stop();
        if (this.api.player) {
            this.api.player.silentScorePlayback = false;
        }
        this.api.playbackRange = this.copyPlaybackRange(snapshot.playbackRange);
        this.api.isLooping = snapshot.isLooping;
        this.api.playbackSpeed = snapshot.playbackSpeed;
        this.api.metronomeVolume = snapshot.metronomeVolume;
        this.api.countInVolume = snapshot.countInVolume;
        for (const item of snapshot.tracks) {
            this.api.changeTrackMute([item.track], item.isMute);
            this.api.changeTrackSolo([item.track], item.isSolo);
        }
    }

    private handlePlayerPosition(args: alphaTab.synth.PositionChangedEventArgs): void {
        if (!this.session.getState().running) {
            return;
        }

        const timestampMs = performance.now();
        const sample: PositionSample = {
            timestampMs,
            currentTick: args.currentTick,
            currentTimeMs: args.currentTime,
            endTick: args.endTick
        };
        this.positionSamples.push(sample);
        if (this.positionSamples.length > positionBufferSize) {
            this.positionSamples.shift();
        }
        this.projectExpectedWallTimes();

        const result = this.session.advancePosition(args.currentTick, timestampMs);
        this.applyInputResult(result);
        this.updateTempoCursor(args.currentTick);
        if (this.loopEnabled && this.previousTick > args.currentTick) {
            this.completePass(timestampMs);
        }
        this.previousTick = args.currentTick;
    }

    private handlePlayerFinished(): void {
        if (!this.session.getState().running) {
            return;
        }
        this.completePass(performance.now());
        if (!this.loopEnabled) {
            this.stop('Perform complete.');
        }
    }

    private completePass(boundaryToken: number): void {
        const pass = this.session.completePass(boundaryToken);
        if (!pass) {
            return;
        }
        this.applyPassResult(pass);
        this.session.clearExpectedWallTimestamps();
        this.positionSamples = [];
        if (pass.speedChanged) {
            this.api.playbackSpeed = pass.state.speed;
        }
    }

    private applyInputResult(result: PerformInputResult<alphaTab.model.Beat>): void {
        switch (result.type) {
            case 'ignored':
                break;
            case 'matched':
                this.feedbackEl.textContent = result.timingMs < 0 ? 'Early' : result.timingMs > 0 ? 'Late' : 'Correct';
                this.feedbackEl.className = 'at-perform-feedback correct';
                this.overlay.flash(this.toPracticeQueueItem(result.item), 'correct');
                break;
            case 'wrong':
                this.feedbackEl.textContent = `Wrong note: ${formatMidiNote(result.inputNote)}`;
                this.feedbackEl.className = 'at-perform-feedback wrong';
                this.overlay.flash(this.toPracticeQueueItem(result.state.currentItem), 'wrong');
                break;
            case 'missed':
                this.feedbackEl.textContent = `${result.items.length} missed`;
                this.feedbackEl.className = 'at-perform-feedback wrong';
                this.overlay.flash(this.toPracticeQueueItem(result.items[0] ?? null), 'wrong');
                break;
        }
        this.refresh();
    }

    private applyPassResult(pass: PerformPassResult<alphaTab.model.Beat>): void {
        if (pass.speedChanged) {
            this.feedbackEl.textContent = `Speed up to ${pass.state.speed.toFixed(1)}x`;
            this.feedbackEl.className = 'at-perform-feedback correct';
        } else if (pass.stats.clean) {
            this.feedbackEl.textContent = 'Clean pass';
            this.feedbackEl.className = 'at-perform-feedback correct';
        } else {
            const mistakes = pass.stats.wrongCount + pass.stats.missedCount;
            this.feedbackEl.textContent = `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}`;
            this.feedbackEl.className = 'at-perform-feedback wrong';
        }
        if (pass.missedItems.length > 0) {
            this.overlay.flash(this.toPracticeQueueItem(pass.missedItems[0] ?? null), 'wrong');
        }
        this.refresh();
    }

    private refresh(): void {
        const state = this.session.getState();
        this.startStopButton.textContent = state.running ? 'Stop' : 'Start';
        this.passEl.textContent = `Pass ${state.currentPass}`;
        const displayedStats = !state.running && state.lastPass ? state.lastPass : state;
        this.correctEl.textContent = `Correct ${displayedStats.correctCount}`;
        this.wrongEl.textContent = `Wrong ${displayedStats.wrongCount}`;
        this.missedEl.textContent = `Missed ${displayedStats.missedCount}`;
        this.earlyEl.textContent = `Early ${displayedStats.earlyCount}`;
        this.lateEl.textContent = `Late ${displayedStats.lateCount}`;
        this.cleanEl.textContent = `Clean ${state.cleanPassStreak}`;
        this.speedEl.textContent = `${state.speed.toFixed(1)}x`;
        this.setSessionControlsDisabled(state.running);

        if (state.running) {
            const practiceItem = this.toPracticeQueueItem(this.selectHintItem(state));
            this.overlay.showItem(practiceItem);
            if (this.showHints && practiceItem) {
                this.keyboardPanel?.setHintNotes(practiceItem.expectedNotes);
            } else if (!this.showHints) {
                this.keyboardPanel?.clearHints();
            }
        } else {
            this.keyboardPanel?.clearHints();
            this.overlay.clear();
            this.tempoOverlay.clear();
        }
    }

    private selectHintItem(state: ReturnType<PerformSession<alphaTab.model.Beat>['getState']>): PerformExpectedItem<alphaTab.model.Beat> | null {
        if (!state.running) {
            return null;
        }

        const now = performance.now();
        const allItems = this.session.getExpectedItems().filter(item => !item.matched);
        const pendingItems = allItems.filter(item => item.expectedWallTimestampMs !== undefined);

        if (pendingItems.length > 0) {
            const activeItems = pendingItems
                .filter(item => Math.abs(now - item.expectedWallTimestampMs!) <= this.settings.timingWindowMs)
                .sort((a, b) => a.expectedWallTimestampMs! - b.expectedWallTimestampMs!);
            if (activeItems.length > 0) {
                return activeItems[0];
            }

            return (
                pendingItems
                    .filter(item => item.expectedWallTimestampMs! > now && item.expectedWallTimestampMs! - now <= performHintLeadInMs)
                    .sort((a, b) => a.expectedWallTimestampMs! - b.expectedWallTimestampMs!)[0] ?? null
            );
        }

        // fallback: no wall timestamps yet (initial load) — show first upcoming item by startTick
        const sampleTick = this.positionSamples.length > 0
            ? this.positionSamples[this.positionSamples.length - 1].currentTick
            : this.api.tickPosition;
        const next = allItems.find(item => item.startTick >= sampleTick);
        return next ?? allItems[0] ?? null;
    }

    private buildPerformItems(range: alphaTab.synth.PlaybackRange | null): PerformBuildResult {
        const queue = filterPracticeQueueByRange(
            buildPracticeQueue(getPlayableBeatsFromTracks(this.api.tracks), this.api.tickCache),
            range
        );
        const items: PerformExpectedItem<alphaTab.model.Beat>[] = [];
        for (const item of queue) {
            for (const pitch of item.expectedNotes) {
                items.push({
                    sourceItem: item,
                    pitch,
                    startTick: item.startTick,
                    matched: false
                });
            }
        }
        return {
            expectedItems: items,
            tempoQueue: queue
        };
    }

    private getLeadInStartTick(range: alphaTab.synth.PlaybackRange | null, firstExpectedTick: number): number {
        const requestedStartTick = range?.startTick ?? firstExpectedTick;
        return Math.max(0, Math.min(requestedStartTick, firstExpectedTick) - performLeadInTicks);
    }

    private getLeadInPlaybackRange(
        range: alphaTab.synth.PlaybackRange | null,
        playbackStartTick: number
    ): alphaTab.synth.PlaybackRange | null {
        if (!range) {
            return null;
        }
        return {
            startTick: playbackStartTick,
            endTick: range.endTick
        } as alphaTab.synth.PlaybackRange;
    }

    private updateTempoCursor(currentTick: number): void {
        if (!this.session.getState().running || !this.showTempoCursor) {
            this.tempoOverlay.clear();
            return;
        }

        this.tempoOverlay.showItem(selectTempoCursorItem(this.tempoQueue, currentTick));
    }

    private projectExpectedWallTimes(): void {
        if (this.positionSamples.length < 2) {
            return;
        }
        const latest = this.positionSamples[this.positionSamples.length - 1];
        let previous = this.positionSamples[this.positionSamples.length - 2];
        for (let i = this.positionSamples.length - 2; i >= 0; i--) {
            if (this.positionSamples[i].currentTick !== latest.currentTick) {
                previous = this.positionSamples[i];
                break;
            }
        }
        const tickDelta = latest.currentTick - previous.currentTick;
        const wallDelta = latest.timestampMs - previous.timestampMs;
        if (tickDelta <= 0 || wallDelta <= 0) {
            return;
        }
        const ticksPerMs = tickDelta / wallDelta;
        const timestamps = new Map<number, number>();
        for (const item of this.session.getExpectedItems()) {
            if (!item.matched) {
                timestamps.set(item.startTick, latest.timestampMs + (item.startTick - latest.currentTick) / ticksPerMs);
            }
        }
        this.session.setExpectedWallTimestamps(timestamps);
    }

    private toPracticeQueueItem(item: PerformExpectedItem<alphaTab.model.Beat> | null): PracticeQueueItem<alphaTab.model.Beat> | null {
        return item?.sourceItem ?? null;
    }

    private getInputChannel(inputNote: number): number {
        const normalizedInput = this.settings.ignoreOctave ? inputNote % 12 : inputNote;
        const matchingItem = this.session.getExpectedItems().find(item => {
            const normalizedExpected = this.settings.ignoreOctave ? item.pitch % 12 : item.pitch;
            return !item.matched && normalizedExpected === normalizedInput;
        });
        const sourceItem = matchingItem?.sourceItem ?? this.session.getState().currentItem?.sourceItem ?? null;
        const fallbackChannel = this.api.tracks?.[0]?.playbackInfo?.primaryChannel ?? 0;
        return resolvePracticeInputChannel(
            sourceItem,
            inputNote,
            this.settings.ignoreOctave,
            beat => (beat as any).voice?.bar?.staff?.track?.playbackInfo?.primaryChannel,
            fallbackChannel
        );
    }

    private copyPlaybackRange(range: alphaTab.synth.PlaybackRange | null): alphaTab.synth.PlaybackRange | null {
        return range && range.endTick > range.startTick
            ? ({ startTick: range.startTick, endTick: range.endTick } as alphaTab.synth.PlaybackRange)
            : null;
    }

    private updateMidiState(state: MidiInputState): void {
        this.lastMidiState = state;
        this.indicatorEl.className = 'at-perform-midi-indicator';
        if (!state.available || state.error) {
            this.indicatorEl.classList.add('error');
        } else if (state.connecting) {
            this.indicatorEl.classList.add('connecting');
        } else if (state.enabled) {
            this.indicatorEl.classList.add('connected');
        }
        this.inputSelect.disabled = state.inputs.length === 0;
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
        this.inputSelect.value = state.selectedInputId;
    }

    private loadSettings(): void {
        try {
            const dataStr = localStorage.getItem('at-playground-settings');
            const data = dataStr ? JSON.parse(dataStr) : {};
            this.settings.startSpeed = Number(data?.custom?.performStartSpeed ?? defaultPerformSettings.startSpeed);
            this.settings.targetSpeed = Number(data?.custom?.performTargetSpeed ?? defaultPerformSettings.targetSpeed);
            this.showHints = data?.custom?.performShowHints !== undefined ? !!data.custom.performShowHints : true;
            this.showTempoCursor =
                data?.custom?.performTempoCursor !== undefined ? !!data.custom.performTempoCursor : true;
            this.loopEnabled = data?.custom?.performLoopEnabled !== undefined ? !!data.custom.performLoopEnabled : false;
        } catch (e) {
            console.error('Failed to load perform settings:', e);
        }
    }

    private applySettingsToInputs(): void {
        this.ignoreOctaveInput.checked = this.settings.ignoreOctave;
        this.showHintsInput.checked = this.showHints;
        this.showTempoCursorInput.checked = this.showTempoCursor;
        this.loopInput.checked = this.loopEnabled;
        this.startSpeedInput.value = this.settings.startSpeed.toFixed(1);
        this.targetSpeedInput.value = this.settings.targetSpeed.toFixed(1);
        this.session.configure(this.settings);
    }

    private setSessionControlsDisabled(disabled: boolean): void {
        this.ignoreOctaveInput.disabled = disabled;
        this.loopInput.disabled = disabled;
        this.startSpeedInput.disabled = disabled;
        this.targetSpeedInput.disabled = disabled;
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
            console.error('Failed to save perform setting:', e);
        }
    }

    private readSpeed(input: HTMLInputElement, fallback: number): number {
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
