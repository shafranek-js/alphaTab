import { describe, expect, it } from 'vitest';
import { MidiInputService, parseMidiNoteMessage } from '../src/input/MidiInputService';

interface FakeMidiMessageEvent {
    data: ArrayLike<number>;
}

interface FakeMidiInput {
    id: string;
    name: string;
    manufacturer: string;
    onmidimessage: ((event: FakeMidiMessageEvent) => void) | null;
}

describe('MidiInputService', () => {
    it('accepts note-on messages with velocity', () => {
        expect(parseMidiNoteMessage([0x90, 60, 100])).toEqual({ note: 60, velocity: 100 });
    });

    it('ignores note-off and zero-velocity note-on messages', () => {
        expect(parseMidiNoteMessage([0x80, 60, 64])).toBeNull();
        expect(parseMidiNoteMessage([0x90, 60, 0])).toBeNull();
    });

    it('updates connected inputs from MIDI state changes', async () => {
        const firstInput = createInput('first', 'First Keyboard');
        const secondInput = createInput('second', 'Second Keyboard');
        const inputs = new Map<string, FakeMidiInput>([[firstInput.id, firstInput]]);
        const access = {
            inputs,
            onstatechange: null as (() => void) | null
        };
        const service = new MidiInputService({
            requestMIDIAccess: async () => access
        });

        await service.initMidi();
        expect(service.getMidiInputs().map(input => input.id)).toEqual(['first']);

        inputs.set(secondInput.id, secondInput);
        access.onstatechange?.();
        expect(service.getMidiInputs().map(input => input.id)).toEqual(['first', 'second']);
    });

    it('emits normalized note input only for the selected device', async () => {
        const firstInput = createInput('first', 'First Keyboard');
        const secondInput = createInput('second', 'Second Keyboard');
        const access = {
            inputs: new Map<string, FakeMidiInput>([
                [firstInput.id, firstInput],
                [secondInput.id, secondInput]
            ]),
            onstatechange: null as (() => void) | null
        };
        const service = new MidiInputService({
            requestMIDIAccess: async () => access
        });
        const notes: number[] = [];
        service.onMidiNote(note => notes.push(note.note));

        await service.initMidi();
        service.selectInput('second');
        firstInput.onmidimessage?.({ data: [0x90, 60, 100] });
        secondInput.onmidimessage?.({ data: [0x90, 64, 100] });

        expect(notes).toEqual([64]);
    });

    it('emits timestampMs for note-on and note-off messages', async () => {
        const input = createInput('first', 'First Keyboard');
        const access = {
            inputs: new Map<string, FakeMidiInput>([[input.id, input]]),
            onstatechange: null as (() => void) | null
        };
        const service = new MidiInputService({
            requestMIDIAccess: async () => access
        });
        const noteOns: number[] = [];
        const noteOffs: number[] = [];
        service.onMidiNote(note => noteOns.push(note.timestampMs));
        service.onMidiNoteOff(note => noteOffs.push(note.timestampMs));

        await service.initMidi();
        input.onmidimessage?.({ data: [0x90, 60, 100] });
        input.onmidimessage?.({ data: [0x80, 60, 0] });

        expect(noteOns).toHaveLength(1);
        expect(noteOffs).toHaveLength(1);
        expect(Number.isFinite(noteOns[0])).toBe(true);
        expect(Number.isFinite(noteOffs[0])).toBe(true);
    });

    it('releases active notes before switching to another input', async () => {
        const firstInput = createInput('first', 'First Keyboard');
        const secondInput = createInput('second', 'Second Keyboard');
        const service = new MidiInputService({
            requestMIDIAccess: async () => ({
                inputs: new Map<string, FakeMidiInput>([
                    [firstInput.id, firstInput],
                    [secondInput.id, secondInput]
                ]),
                onstatechange: null
            })
        });
        const noteOffs: number[] = [];
        service.onMidiNoteOff(note => noteOffs.push(note.note));

        await service.initMidi();
        firstInput.onmidimessage?.({ data: [0x90, 60, 100] });
        service.selectInput('second');

        expect(noteOffs).toEqual([60]);
        expect(firstInput.onmidimessage).toBeNull();
    });

    it('releases active notes when a MIDI input disconnects', async () => {
        const input = createInput('first', 'First Keyboard');
        const inputs = new Map<string, FakeMidiInput>([[input.id, input]]);
        const access = {
            inputs,
            onstatechange: null as (() => void) | null
        };
        const service = new MidiInputService({ requestMIDIAccess: async () => access });
        const noteOffs: number[] = [];
        service.onMidiNoteOff(note => noteOffs.push(note.note));

        await service.initMidi();
        input.onmidimessage?.({ data: [0x90, 60, 100] });
        inputs.delete(input.id);
        access.onstatechange?.();

        expect(noteOffs).toEqual([60]);
        expect(input.onmidimessage).toBeNull();
    });

    it('keeps a shared pitch active until the last MIDI input releases it', async () => {
        const firstInput = createInput('first', 'First Keyboard');
        const secondInput = createInput('second', 'Second Keyboard');
        const service = new MidiInputService({
            requestMIDIAccess: async () => ({
                inputs: new Map<string, FakeMidiInput>([
                    [firstInput.id, firstInput],
                    [secondInput.id, secondInput]
                ]),
                onstatechange: null
            })
        });
        const noteOns: number[] = [];
        const noteOffs: number[] = [];
        service.onMidiNote(note => noteOns.push(note.note));
        service.onMidiNoteOff(note => noteOffs.push(note.note));

        await service.initMidi();
        firstInput.onmidimessage?.({ data: [0x90, 60, 100] });
        secondInput.onmidimessage?.({ data: [0x90, 60, 90] });
        firstInput.onmidimessage?.({ data: [0x80, 60, 0] });

        expect(noteOns).toEqual([60]);
        expect(noteOffs).toEqual([]);

        secondInput.onmidimessage?.({ data: [0x80, 60, 0] });
        expect(noteOffs).toEqual([60]);
    });

    it('releases active notes before disposal clears callbacks', async () => {
        const input = createInput('first', 'First Keyboard');
        const service = new MidiInputService({
            requestMIDIAccess: async () => ({
                inputs: new Map<string, FakeMidiInput>([[input.id, input]]),
                onstatechange: null
            })
        });
        const noteOffs: number[] = [];
        service.onMidiNoteOff(note => noteOffs.push(note.note));

        await service.initMidi();
        input.onmidimessage?.({ data: [0x90, 60, 100] });
        service.dispose();

        expect(noteOffs).toEqual([60]);
        expect(input.onmidimessage).toBeNull();
    });

});

function createInput(id: string, name: string): FakeMidiInput {
    return {
        id,
        name,
        manufacturer: 'Test',
        onmidimessage: null
    };
}
