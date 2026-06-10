import { describe, expect, it } from 'vitest';
import {
    buildPracticeQueue,
    findBestPianoTransposeIntervals,
    type PracticeBeatSource,
    PracticeSession
} from '../src/components/practice/PracticeController';

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

    it('can seek to the beat closest to a given tick', () => {
        const session = new PracticeSession();
        const b1 = beat([60]);
        (b1 as any).absolutePlaybackStart = 1000;
        const b2 = beat([62]);
        (b2 as any).absolutePlaybackStart = 2000;
        const b3 = beat([64]);
        (b3 as any).absolutePlaybackStart = 3000;

        session.setQueue(buildPracticeQueue([b1, b2, b3]));
        session.start();

        session.seekToTick(1800);
        expect(session.getState().currentIndex).toBe(1);

        session.seekToTick(900);
        expect(session.getState().currentIndex).toBe(0);

        session.seekToTick(3500);
        expect(session.getState().currentIndex).toBe(2);
    });

    describe('findBestPianoTransposeIntervals', () => {
        it('returns empty list for empty notes', () => {
            expect(findBestPianoTransposeIntervals([])).toEqual([]);
        });

        it('transposes E-minor melody with F# to A-minor (+5 or -7 semitones)', () => {
            // Natural E-minor scale: E (64), F# (66), G (67), A (69), B (71), C (72), D (74)
            // It has 1 black key (F#)
            const melody = [64, 66, 67, 69, 71, 72, 74];
            const result = findBestPianoTransposeIntervals(melody);
            // +5 semitones -> A-minor natural scale (all white keys -> 0 black keys)
            // -7 semitones -> A-minor natural scale (all white keys -> 0 black keys)
            expect(result).toContain(5);
            expect(result).toContain(-7);
            // The first element should be the closest to 0 (which is +5 or -7, let's verify sorting order)
            expect(Math.abs(result[0])).toBe(5);
        });

        it('respects piano key bounds [21, 108]', () => {
            // Notes near the top: 106, 107
            // Shifting them up by +5 would exceed 108, so they should be filtered out or penalize unplayable count
            const melody = [106, 107];
            const result = findBestPianoTransposeIntervals(melody);
            // Verify that we do not get intervals that make notes unplayable if playable ones exist
            for (const interval of result) {
                for (const note of melody) {
                    const transposed = note + interval;
                    expect(transposed).toBeGreaterThanOrEqual(21);
                    expect(transposed).toBeLessThanOrEqual(108);
                }
            }
        });
    });

    it('skips tie destination notes in practice queue', () => {
        const b1 = {
            isRest: false,
            notes: [
                { realValue: 60, isTieDestination: false },
                { realValue: 64, isTieDestination: true }
            ]
        };
        const b2 = {
            isRest: false,
            notes: [
                { realValue: 64, isTieDestination: true }
            ]
        };
        const queue = buildPracticeQueue([b1, b2]);

        expect(queue).toHaveLength(1); // b2 should be skipped because all notes are tie destinations
        expect(queue[0].expectedNotes).toEqual([60]); // b1 should only expect 60, since 64 is a tie destination
    });
});

function beat(notes: number[], isRest = false): PracticeBeatSource {
    return {
        isRest,
        notes: notes.map(realValue => ({ realValue }))
    };
}
