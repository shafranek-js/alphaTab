import { describe, expect, it } from 'vitest';
import {
    buildLoopTrainerQueue,
    buildPracticeQueue,
    findBestPianoTransposeIntervals,
    LoopTrainerSession,
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

    describe('LoopTrainerSession', () => {
        it('builds a queue only from playable notes inside the playback range', () => {
            const b1 = beatAt([60], 100);
            const b2 = beatAt([62], 200);
            const b3 = beatAt([64], 300);

            const queue = buildLoopTrainerQueue([b1, b2, b3], null, { startTick: 150, endTick: 250 });

            expect(queue.map(item => item.pitch)).toEqual([62]);
        });

        it('builds a full queue when no range is selected', () => {
            const queue = buildLoopTrainerQueue([beatAt([60], 100), beatAt([62], 200)], null, null);

            expect(queue.map(item => item.pitch)).toEqual([60, 62]);
        });

        it('matches a correct MIDI note once and ignores duplicates', () => {
            const session = new LoopTrainerSession();
            session.start(buildLoopTrainerQueue([beatAt([60], 100)], null, null));

            expect(session.handleMidiNote(60, 100).type).toBe('matched');
            expect(session.handleMidiNote(60, 100).type).toBe('duplicate');

            session.updateTick(100);
            const pass = session.updateTick(0);
            expect(pass?.stats.matchedCount).toBe(1);
            expect(pass?.stats.wrongCount).toBe(0);
        });

        it('counts wrong pitch and missed notes at pass boundary', () => {
            const session = new LoopTrainerSession();
            session.start(buildLoopTrainerQueue([beatAt([60], 100)], null, null));

            expect(session.handleMidiNote(61, 100).type).toBe('wrong');
            session.updateTick(100);
            const pass = session.updateTick(0);

            expect(pass?.stats.wrongCount).toBe(1);
            expect(pass?.stats.missedCount).toBe(1);
            expect(pass?.stats.clean).toBe(false);
        });

        it('matches chord notes in any order', () => {
            const session = new LoopTrainerSession();
            session.start(buildLoopTrainerQueue([beatAt([60, 64], 100)], null, null));

            expect(session.handleMidiNote(64, 100).type).toBe('matched');
            expect(session.handleMidiNote(60, 100).type).toBe('matched');
            session.updateTick(100);
            const pass = session.updateTick(0);

            expect(pass?.stats.matchedCount).toBe(2);
            expect(pass?.stats.clean).toBe(true);
        });

        it('resets clean streak after a pass with mistakes', () => {
            const session = new LoopTrainerSession();
            session.start(buildLoopTrainerQueue([beatAt([60], 100)], null, null));

            completeCleanPass(session);
            expect(session.getState().cleanPassStreak).toBe(1);

            session.handleMidiNote(61, 100);
            session.updateTick(100);
            session.updateTick(0);

            expect(session.getState().cleanPassStreak).toBe(0);
        });

        it('increases speed after three clean passes, rounded and capped at target speed', () => {
            const session = new LoopTrainerSession({
                startSpeed: 0.7,
                targetSpeed: 1,
                speedIncrement: 0.1,
                cleanPassesRequired: 3
            });
            session.start(buildLoopTrainerQueue([beatAt([60], 100)], null, null));

            completeCleanPass(session);
            completeCleanPass(session);
            const pass = completeCleanPass(session);

            expect(pass?.speedChanged).toBe(true);
            expect(session.getState().speed).toBe(0.8);

            for (let i = 0; i < 9; i++) {
                completeCleanPass(session);
            }
            expect(session.getState().speed).toBe(1);
        });
    });
});

function beat(notes: number[], isRest = false): PracticeBeatSource {
    return {
        isRest,
        notes: notes.map(realValue => ({ realValue }))
    };
}

function beatAt(notes: number[], startTick: number): PracticeBeatSource {
    const b = beat(notes);
    (b as any).absolutePlaybackStart = startTick;
    return b;
}

function completeCleanPass(session: LoopTrainerSession): ReturnType<LoopTrainerSession['updateTick']> {
    session.updateTick(100);
    session.handleMidiNote(60, 100);
    return session.updateTick(0);
}
