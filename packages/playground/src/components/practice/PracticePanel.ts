import * as alphaTab from '@coderline/alphatab';
import { type Mountable, css, html, injectStyles, parseHtml } from '../../util/Dom';
import { MidiInputService, type MidiInputState, type MidiNoteInput } from '../../input/MidiInputService';
import {
    PracticeSession,
    buildPracticeQueue,
    getPlayableBeatsFromTracks,
    type PracticeInputResult,
    type PracticeQueueItem,
    type PracticeSessionState
} from './PracticeController';
import { PracticeOverlay } from './PracticeOverlay';

injectStyles(
    'PracticePanel',
    css`
    .at-footer-practice {
        display: none;
        min-height: 118px;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
        background: #fff;
        color: #1f2328;
    }
    .at-footer-practice.open {
        display: block;
    }
    .at-practice-panel {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 12px;
    }
    .at-practice-main {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, auto));
        gap: 10px 18px;
        align-items: center;
        justify-content: start;
    }
    .at-practice-field {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 120px;
    }
    .at-practice-field > span:first-child {
        color: #5f6874;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
    }
    .at-practice-value {
        font-weight: 700;
        white-space: nowrap;
    }
    .at-practice-feedback {
        min-height: 18px;
        color: #5f6874;
        font-weight: 600;
    }
    .at-practice-feedback.correct { color: #1f8f4d; }
    .at-practice-feedback.wrong { color: #c92a2a; }
    .at-practice-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
    }
    .at-practice-actions select {
        min-height: 36px;
        max-width: 220px;
        border: 1px solid #dadde1;
        border-radius: 4px;
        background: #fff;
        color: #1f2328;
        font: inherit;
        padding: 0 8px;
    }
    .at-practice-actions label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        white-space: nowrap;
    }
    @media screen and (max-width: 920px) {
        .at-practice-panel {
            grid-template-columns: 1fr;
        }
        .at-practice-actions {
            justify-content: flex-start;
        }
    }
`
);

export class PracticePanel implements Mountable {
    readonly root: HTMLElement;
    private midiService = new MidiInputService();
    private session = new PracticeSession<alphaTab.model.Beat>();
    private overlay: PracticeOverlay;
    private statusEl: HTMLElement;
    private expectedEl: HTMLElement;
    private progressEl: HTMLElement;
    private feedbackEl: HTMLElement;
    private inputSelect: HTMLSelectElement;
    private ignoreOctaveInput: HTMLInputElement;
    private connectButton: HTMLButtonElement;
    private startButton: HTMLButtonElement;
    private stopButton: HTMLButtonElement;
    private resetButton: HTMLButtonElement;
    private subscriptions: (() => void)[] = [];
    private lastMidiState: MidiInputState = this.midiService.getState();

    public constructor(
        private api: alphaTab.AlphaTabApi,
        overlayHost: HTMLElement
    ) {
        this.root = parseHtml(html`
            <div class="at-footer-practice">
                <div class="at-practice-panel">
                    <div class="at-practice-main">
                        <div class="at-practice-field">
                            <span>MIDI</span>
                            <span class="at-practice-value" data-practice-status>Not connected</span>
                        </div>
                        <div class="at-practice-field">
                            <span>Expected</span>
                            <span class="at-practice-value" data-practice-expected>-</span>
                        </div>
                        <div class="at-practice-field">
                            <span>Progress</span>
                            <span class="at-practice-value" data-practice-progress>0 / 0</span>
                        </div>
                        <div class="at-practice-feedback" data-practice-feedback></div>
                    </div>
                    <div class="at-practice-actions">
                        <select data-practice-input aria-label="MIDI input"></select>
                        <label><input type="checkbox" data-practice-octave /> Ignore octave</label>
                        <button type="button" class="button button--secondary" data-practice-connect>Connect MIDI</button>
                        <button type="button" class="button button--primary" data-practice-start>Start</button>
                        <button type="button" class="button button--secondary" data-practice-stop>Stop</button>
                        <button type="button" class="button button--secondary button--outline" data-practice-reset>Reset</button>
                    </div>
                </div>
            </div>
        `);

        this.overlay = new PracticeOverlay(api, overlayHost);
        this.statusEl = this.root.querySelector('[data-practice-status]')!;
        this.expectedEl = this.root.querySelector('[data-practice-expected]')!;
        this.progressEl = this.root.querySelector('[data-practice-progress]')!;
        this.feedbackEl = this.root.querySelector('[data-practice-feedback]')!;
        this.inputSelect = this.root.querySelector('[data-practice-input]')!;
        this.ignoreOctaveInput = this.root.querySelector('[data-practice-octave]')!;
        this.connectButton = this.root.querySelector('[data-practice-connect]')!;
        this.startButton = this.root.querySelector('[data-practice-start]')!;
        this.stopButton = this.root.querySelector('[data-practice-stop]')!;
        this.resetButton = this.root.querySelector('[data-practice-reset]')!;

        this.connectButton.addEventListener('click', () => this.connectMidi());
        this.startButton.addEventListener('click', () => this.start());
        this.stopButton.addEventListener('click', () => this.stop());
        this.resetButton.addEventListener('click', () => this.reset());
        this.inputSelect.addEventListener('change', () => {
            this.midiService.selectInput(this.inputSelect.value);
        });
        this.ignoreOctaveInput.addEventListener('change', () => {
            this.session.setIgnoreOctave(this.ignoreOctaveInput.checked);
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
    }

    public setOpen(open: boolean): void {
        this.root.classList.toggle('open', open);
        if (open) {
            this.rebuildQueue();
            this.refresh();
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
        this.feedbackEl.textContent = state.total > 0 ? 'Play the highlighted note.' : 'No playable notes in the rendered score.';
        this.feedbackEl.className = 'at-practice-feedback';
        this.refresh();
    }

    private stop(): void {
        this.session.stop();
        this.overlay.clear();
        this.feedbackEl.textContent = 'Practice stopped.';
        this.feedbackEl.className = 'at-practice-feedback';
        this.refresh();
    }

    private reset(): void {
        this.session.reset();
        this.overlay.clear();
        this.feedbackEl.textContent = '';
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
        this.expectedEl.textContent = state.currentItem ? formatExpectedNotes(state.currentItem) : '-';
        this.progressEl.textContent = `${Math.min(state.currentIndex + (state.complete ? 0 : 1), state.total)} / ${state.total}`;
        this.startButton.disabled = state.running || state.total === 0;
        this.stopButton.disabled = !state.running;
        this.resetButton.disabled = state.total === 0;
        if (state.running) {
            this.overlay.showItem(state.currentItem, state.matchedNotes);
        } else if (!state.complete) {
            this.overlay.clear();
        }
    }

    private updateMidiState(state: MidiInputState): void {
        this.lastMidiState = state;
        this.statusEl.textContent = this.getMidiStatusText(state);
        this.connectButton.disabled = state.connecting || !state.available;
        this.connectButton.textContent = state.connecting ? 'Connecting...' : 'Connect MIDI';
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

    private getMidiStatusText(state: MidiInputState): string {
        if (!state.available) {
            return 'Web MIDI unavailable';
        }
        if (state.error) {
            return state.error;
        }
        if (state.connecting) {
            return 'Connecting...';
        }
        if (!state.enabled) {
            return 'Not connected';
        }
        return `${state.inputs.length} input${state.inputs.length === 1 ? '' : 's'} connected`;
    }
}

function formatExpectedNotes(item: PracticeQueueItem<alphaTab.model.Beat>): string {
    return item.expectedNotes.map(formatMidiNote).join(' + ');
}

function formatMidiNote(note: number): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}
