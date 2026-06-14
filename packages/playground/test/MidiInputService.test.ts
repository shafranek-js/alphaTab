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

});

function createInput(id: string, name: string): FakeMidiInput {
    return {
        id,
        name,
        manufacturer: 'Test',
        onmidimessage: null
    };
}
