import { describe, expect, it } from 'vitest';
import { PracticeSession, buildPracticeQueue, type PracticeBeatSource } from '../src/components/practice/PracticeController';

describe('PracticeController', () => {
    it('builds a queue from playable beats and skips rests', () => {
        const rest = beat([], true);
        const playable = beat([60]);
        const queue = buildPracticeQueue([rest, playable]);

        expect(queue).toHaveLength(1);
        expect(queue[0].beat).toBe(playable);
        expect(queue[0].expectedNotes).toEqual([60]);
    });

    it('requires exact pitch by default', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60])]));
        session.start();

        expect(session.handleMidiNote(72).type).toBe('wrong');
        expect(session.handleMidiNote(60).type).toBe('complete');
    });

    it('can ignore octave when matching notes', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60])]));
        session.setIgnoreOctave(true);
        session.start();

        expect(session.handleMidiNote(72).type).toBe('complete');
    });

    it('handles chord notes in any order and reports partial progress', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60, 64, 67])]));
        session.start();

        const partial = session.handleMidiNote(67);
        expect(partial.type).toBe('partial');
        expect(partial.state.matchedNotes).toEqual([67]);

        expect(session.handleMidiNote(60).type).toBe('partial');
        expect(session.handleMidiNote(64).type).toBe('complete');
    });

    it('does not advance a chord when the input is wrong', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60, 64])]));
        session.start();

        expect(session.handleMidiNote(60).type).toBe('partial');
        const wrong = session.handleMidiNote(61);

        expect(wrong.type).toBe('wrong');
        expect(wrong.state.currentIndex).toBe(0);
        expect(wrong.state.matchedNotes).toEqual([]);
    });
});

function beat(notes: number[], isRest = false): PracticeBeatSource {
    return {
        isRest,
        notes: notes.map(realValue => ({ realValue }))
    };
}
