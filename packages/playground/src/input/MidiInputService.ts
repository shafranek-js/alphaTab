export interface MidiInputInfo {
    id: string;
    name: string;
    manufacturer: string;
}

export interface MidiNoteInput {
    note: number;
    pitchClass: number;
    velocity: number;
    inputId: string;
    inputName: string;
    timestampMs: number;
}

export interface MidiInputState {
    enabled: boolean;
    available: boolean;
    connecting: boolean;
    error: string | null;
    inputs: MidiInputInfo[];
    selectedInputId: string | 'all';
}

interface MidiMessageEventLike {
    data: ArrayLike<number>;
    currentTarget?: unknown;
    target?: unknown;
}

interface MidiInputLike {
    id: string;
    name?: string | null;
    manufacturer?: string | null;
    onmidimessage: ((event: MidiMessageEventLike) => void) | null;
}

interface MidiAccessLike {
    inputs: Map<string, MidiInputLike> | { values(): IterableIterator<MidiInputLike> };
    onstatechange: (() => void) | null;
}

interface MidiNavigatorLike {
    requestMIDIAccess?: (options: { sysex: false }) => Promise<MidiAccessLike>;
}

export function parseMidiNoteMessage(data: ArrayLike<number>): { note: number; velocity: number } | null {
    if (data.length < 3) {
        return null;
    }

    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];
    if (status !== 0x90 || velocity <= 0) {
        return null;
    }

    return { note, velocity };
}

export class MidiInputService {
    private midiAccess: MidiAccessLike | null = null;
    private inputs: MidiInputLike[] = [];
    private selectedInputId: string | 'all' = 'all';
    private enabled = false;
    private connecting = false;
    private error: string | null = null;
    private noteCallbacks: Array<(note: MidiNoteInput) => void> = [];
    private noteOffCallbacks: Array<(note: MidiNoteInput) => void> = [];
    private stateCallbacks: Array<(state: MidiInputState) => void> = [];
    private activeNotesByInput = new Map<string, Map<number, MidiNoteInput>>();

    public constructor(private navigatorLike: MidiNavigatorLike | undefined = globalThis.navigator as MidiNavigatorLike | undefined) {}

    public isMidiAvailable(): boolean {
        return typeof this.navigatorLike?.requestMIDIAccess === 'function';
    }

    public getState(): MidiInputState {
        return {
            enabled: this.enabled,
            available: this.isMidiAvailable(),
            connecting: this.connecting,
            error: this.error,
            inputs: this.getMidiInputs(),
            selectedInputId: this.selectedInputId
        };
    }

    public getMidiInputs(): MidiInputInfo[] {
        return this.inputs.map(input => this.toInputInfo(input));
    }

    public selectInput(id: string | 'all'): void {
        const deselectedInputIds = Array.from(this.activeNotesByInput.keys()).filter(
            inputId => !this.isInputSelected(inputId, id)
        );
        this.releaseInputNotes(deselectedInputIds);
        this.selectedInputId = id;
        this.attachMessageHandlers();
        this.notifyStateChange();
    }

    public onMidiNote(callback: (note: MidiNoteInput) => void): () => void {
        this.noteCallbacks.push(callback);
        return () => {
            this.noteCallbacks = this.noteCallbacks.filter(cb => cb !== callback);
        };
    }

    public onMidiNoteOff(callback: (note: MidiNoteInput) => void): () => void {
        this.noteOffCallbacks.push(callback);
        return () => {
            this.noteOffCallbacks = this.noteOffCallbacks.filter(cb => cb !== callback);
        };
    }

    public onStateChange(callback: (state: MidiInputState) => void): () => void {
        this.stateCallbacks.push(callback);
        return () => {
            this.stateCallbacks = this.stateCallbacks.filter(cb => cb !== callback);
        };
    }

    public async initMidi(): Promise<boolean> {
        if (!this.isMidiAvailable() || this.connecting) {
            this.notifyStateChange();
            return this.enabled;
        }

        if (this.midiAccess) {
            this.updateInputs();
            return this.enabled;
        }

        this.connecting = true;
        this.error = null;
        this.notifyStateChange();

        try {
            this.midiAccess = await this.navigatorLike!.requestMIDIAccess!({ sysex: false });
            this.midiAccess.onstatechange = () => {
                this.updateInputs();
            };
            this.updateInputs();
            return this.enabled;
        } catch (e) {
            this.error = e instanceof Error ? e.message : 'MIDI access denied or unavailable.';
            this.enabled = false;
            this.inputs = [];
            return false;
        } finally {
            this.connecting = false;
            this.notifyStateChange();
        }
    }

    public dispose(): void {
        this.releaseInputNotes(Array.from(this.activeNotesByInput.keys()));
        if (this.midiAccess) {
            this.midiAccess.onstatechange = null;
        }
        for (const input of this.inputs) {
            input.onmidimessage = null;
        }
        this.inputs = [];
        this.noteCallbacks = [];
        this.noteOffCallbacks = [];
        this.stateCallbacks = [];
    }

    private updateInputs(): void {
        if (!this.midiAccess) {
            return;
        }

        const previousInputs = this.inputs;
        const nextInputs = Array.from(this.midiAccess.inputs.values());
        const nextInputIds = new Set(nextInputs.map(input => input.id));
        const removedInputIds = previousInputs.filter(input => !nextInputIds.has(input.id)).map(input => input.id);
        for (const input of previousInputs) {
            if (!nextInputIds.has(input.id)) {
                input.onmidimessage = null;
            }
        }
        this.releaseInputNotes(removedInputIds);
        this.inputs = nextInputs;
        this.enabled = this.inputs.length > 0;
        if (this.selectedInputId !== 'all' && !this.inputs.some(input => input.id === this.selectedInputId)) {
            this.selectedInputId = 'all';
        }
        this.attachMessageHandlers();
        this.notifyStateChange();
    }

    private attachMessageHandlers(): void {
        for (const input of this.inputs) {
            input.onmidimessage =
                this.selectedInputId === 'all' || input.id === this.selectedInputId
                    ? event => this.handleMidiMessage(event, input)
                    : null;
        }
    }

    private handleMidiMessage(event: MidiMessageEventLike, input: MidiInputLike): void {
        if (event.data.length < 3) {
            return;
        }
        const status = event.data[0] & 0xf0;
        const noteNumber = event.data[1];
        const velocity = event.data[2];

        const isNoteOn = status === 0x90 && velocity > 0;
        const isNoteOff = status === 0x80 || (status === 0x90 && velocity === 0);

        if (!isNoteOn && !isNoteOff) {
            return;
        }

        const note: MidiNoteInput = {
            note: noteNumber,
            pitchClass: noteNumber % 12,
            velocity: velocity,
            inputId: input.id,
            inputName: input.name ?? 'MIDI Device',
            timestampMs: performance.now()
        };

        if (isNoteOn) {
            let activeNotes = this.activeNotesByInput.get(input.id);
            if (!activeNotes) {
                activeNotes = new Map<number, MidiNoteInput>();
                this.activeNotesByInput.set(input.id, activeNotes);
            }
            if (activeNotes.has(noteNumber)) {
                return;
            }
            const wasActive = this.isNoteActive(noteNumber);
            activeNotes.set(noteNumber, note);
            if (!wasActive) {
                for (const callback of this.noteCallbacks) {
                    callback(note);
                }
            }
        } else {
            const activeNotes = this.activeNotesByInput.get(input.id);
            if (!activeNotes?.delete(noteNumber)) {
                return;
            }
            if (activeNotes.size === 0) {
                this.activeNotesByInput.delete(input.id);
            }
            if (!this.isNoteActive(noteNumber)) {
                for (const callback of this.noteOffCallbacks) {
                    callback(note);
                }
            }
        }
    }

    private releaseInputNotes(inputIds: Iterable<string>): void {
        for (const inputId of inputIds) {
            const activeNotes = this.activeNotesByInput.get(inputId);
            if (!activeNotes) {
                continue;
            }
            this.activeNotesByInput.delete(inputId);
            for (const note of activeNotes.values()) {
                if (this.isNoteActive(note.note)) {
                    continue;
                }
                const noteOff = { ...note, velocity: 0, timestampMs: performance.now() };
                for (const callback of this.noteOffCallbacks) {
                    callback(noteOff);
                }
            }
        }
    }

    private isNoteActive(noteNumber: number): boolean {
        for (const activeNotes of this.activeNotesByInput.values()) {
            if (activeNotes.has(noteNumber)) {
                return true;
            }
        }
        return false;
    }

    private isInputSelected(inputId: string, selection: string | 'all' = this.selectedInputId): boolean {
        return selection === 'all' || inputId === selection;
    }

    private notifyStateChange(): void {
        const state = this.getState();
        for (const callback of this.stateCallbacks) {
            callback(state);
        }
    }

    private toInputInfo(input: MidiInputLike): MidiInputInfo {
        return {
            id: input.id,
            name: input.name ?? 'MIDI Device',
            manufacturer: input.manufacturer ?? ''
        };
    }
}
