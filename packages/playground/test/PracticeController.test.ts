import { describe, expect, it } from 'vitest';
import {
    buildPracticeQueue,
    defaultPerformSettings,
    filterPracticeQueueByRange,
    findBestPianoTransposeIntervals,
    type PerformExpectedItem,
    PerformSession,
    type PracticeBeatSource,
    PracticeSession,
    selectTempoCursorItem
} from '../src/components/practice/PracticeController';

describe('PracticeController', () => {
    it('builds a queue from playable beats and skips rests', () => {
        const rest = beat([], true);
        const playable = beatAt([60], 100, 120);
        const queue = buildPracticeQueue([rest, playable]);

        expect(queue).toHaveLength(1);
        expect(queue[0].beat).toBe(playable);
        expect(queue[0].expectedNotes).toEqual([60]);
        expect(queue[0].endTick).toBe(220);
    });

    it('requires exact pitch by default', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60])]));
        session.start();

        expect(session.handleMidiNote(72).type).toBe('wrong');
        expect(session.getState().wrongCount).toBe(1);
        expect(session.handleMidiNote(60).type).toBe('wrong');
        expect(session.getState().wrongCount).toBe(1);
        expect(session.handleMidiNoteOff(72).type).toBe('complete');
    });

    it('does not count the same held wrong note twice', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60])]));
        session.start();

        expect(session.handleMidiNote(72).type).toBe('wrong');
        expect(session.handleMidiNote(72).type).toBe('wrong');
        expect(session.getState().wrongCount).toBe(1);
        expect(session.handleMidiNoteOff(72).type).toBe('partial');
        expect(session.handleMidiNote(60).type).toBe('complete');
    });

    it('can ignore octave when matching notes', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60])]));
        session.setIgnoreOctave(true);
        session.start();

        expect(session.handleMidiNote(72).type).toBe('complete');
    });

    it('uses normalized note counts when ignoring octave', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60, 72])]));
        session.setIgnoreOctave(true);
        session.start();

        const partial = session.handleMidiNote(60);
        expect(partial.type).toBe('partial');
        expect(partial.state.matchedNotes).toEqual([60]);

        const complete = session.handleMidiNote(84);
        expect(complete.type).toBe('complete');
    });

    it('penalizes ignore-octave input when a normalized count exceeds expected', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60, 64])]));
        session.setIgnoreOctave(true);
        session.start();

        expect(session.handleMidiNote(60).type).toBe('partial');
        const wrong = session.handleMidiNote(72);

        expect(wrong.type).toBe('wrong');
        expect(wrong.state.wrongCount).toBe(1);
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

    it('returns to partial when an expected chord note is released before completion', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60, 64, 67])]));
        session.start();

        expect(session.handleMidiNote(60).type).toBe('partial');
        expect(session.handleMidiNote(64).type).toBe('partial');
        const released = session.handleMidiNoteOff(64);

        expect(released.type).toBe('partial');
        expect(released.state.matchedNotes).toEqual([60]);
        expect(session.handleMidiNote(67).type).toBe('partial');
    });

    it('does not advance a chord when the input is wrong', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60, 64])]));
        session.start();

        expect(session.handleMidiNote(60).type).toBe('partial');
        const wrong = session.handleMidiNote(61);

        expect(wrong.type).toBe('wrong');
        expect(wrong.state.currentIndex).toBe(0);
        expect(wrong.state.matchedNotes).toEqual([60]);
        expect(wrong.state.wrongCount).toBe(1);
        expect(session.handleMidiNoteOff(61).type).toBe('partial');
        expect(session.handleMidiNote(64).type).toBe('complete');
    });

    it('keeps held notes across successful advance and lets noteOff complete the next item', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60]), beat([62])]));
        session.start();

        const first = session.handleMidiNote(60);
        expect(first.type).toBe('correct');
        expect(first.state.pressedNotes).toEqual([60]);

        const wrongCarry = session.handleMidiNote(62);
        expect(wrongCarry.type).toBe('wrong');
        expect(wrongCarry.state.wrongCount).toBe(0);
        expect(new Set(wrongCarry.state.pressedNotes)).toEqual(new Set([60, 62]));

        const fixed = session.handleMidiNoteOff(60);
        expect(fixed.type).toBe('complete');
    });

    it('allows a sustained note across the next item until its end tick', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beatAt([60], 100, 200), beatAt([62], 200, 100)]));
        session.start();

        const first = session.handleMidiNote(60);
        expect(first.type).toBe('correct');
        expect(first.state.requiredNotes).toEqual([
            { note: 60, endTick: 300, fresh: false },
            { note: 62, endTick: 300, fresh: true }
        ]);

        const second = session.handleMidiNote(62);
        expect(second.type).toBe('complete');
        expect(second.state.wrongCount).toBe(0);
    });

    it('treats an expired held note as extra without increasing wrongCount for the new expected note', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beatAt([60], 100, 50), beatAt([62], 200, 100)]));
        session.start();

        expect(session.handleMidiNote(60).type).toBe('correct');
        const wrong = session.handleMidiNote(62);

        expect(wrong.type).toBe('wrong');
        expect(wrong.state.wrongCount).toBe(0);
        expect(session.handleMidiNoteOff(60).type).toBe('complete');
    });

    it('does not require a sustained note to keep being held after it was accepted', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beatAt([60], 100, 200), beatAt([62], 200, 100)]));
        session.start();

        expect(session.handleMidiNote(60).type).toBe('correct');
        const released = session.handleMidiNoteOff(60);
        expect(released.type).toBe('partial');

        expect(session.handleMidiNote(62).type).toBe('complete');
    });

    it('requires a fresh attack when the same pitch repeats on the next item', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beatAt([60], 100, 200), beatAt([60], 200, 100)]));
        session.start();

        expect(session.handleMidiNote(60).type).toBe('correct');

        const staleRepeat = session.handleMidiNote(60);
        expect(staleRepeat.type).toBe('partial');
        expect(staleRepeat.state.matchedNotes).toEqual([]);

        expect(session.handleMidiNoteOff(60).type).toBe('partial');
        expect(session.handleMidiNote(60).type).toBe('complete');
    });

    it('extends sustained allowed notes through a tie destination without requiring a new attack', () => {
        const tieDestination = { realValue: 60, isTieDestination: true } as PracticeBeatSource['notes'][number];
        const origin = { realValue: 60, tieDestination };
        const firstBeat = beatAt([], 100, 100, [origin]);
        const tiedBeat = beatAt([], 200, 100, [tieDestination]);
        const nextBeat = beatAt([64], 250, 100);
        tieDestination.beat = tiedBeat;

        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([firstBeat, tiedBeat, nextBeat]));
        session.start();

        const first = session.handleMidiNote(60);
        expect(first.type).toBe('correct');
        expect(first.state.requiredNotes).toEqual([
            { note: 60, endTick: 300, fresh: false },
            { note: 64, endTick: 350, fresh: true }
        ]);

        expect(session.handleMidiNote(64).type).toBe('complete');
    });

    it('uses active required counts when ignoring octave across sustained notes', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beatAt([60], 100, 300), beatAt([72, 76], 200, 100)]));
        session.setIgnoreOctave(true);
        session.start();

        expect(session.handleMidiNote(60).type).toBe('correct');
        expect(session.handleMidiNote(72).type).toBe('partial');

        const wrong = session.handleMidiNote(84);
        expect(wrong.type).toBe('wrong');
        expect(wrong.state.wrongCount).toBe(1);
    });

    it('can advance on noteOff after an extra note blocked already matched fresh notes', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60, 64])]));
        session.start();

        expect(session.handleMidiNote(60).type).toBe('partial');
        expect(session.handleMidiNote(61).type).toBe('wrong');
        expect(session.handleMidiNote(64).type).toBe('wrong');
        expect(session.handleMidiNoteOff(61).type).toBe('complete');
    });

    it('removes held notes after complete when noteOff arrives while inactive', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60])]));
        session.start();

        expect(session.handleMidiNote(60).type).toBe('complete');
        expect(session.getState().pressedNotes).toEqual([60]);

        const released = session.handleMidiNoteOff(60);
        expect(released.type).toBe('ignored');
        expect(released.state.pressedNotes).toEqual([]);
    });

    it('clears held state when ignore-octave changes or pressed notes are cleared', () => {
        const session = new PracticeSession();
        session.setQueue(buildPracticeQueue([beat([60])]));
        session.start();

        expect(session.handleMidiNote(61).type).toBe('wrong');
        expect(session.getState().pressedNotes).toEqual([61]);

        session.setIgnoreOctave(true);
        expect(session.getState().pressedNotes).toEqual([]);

        expect(session.handleMidiNote(61).type).toBe('wrong');
        session.clearPressedNotes();
        expect(session.getState().pressedNotes).toEqual([]);
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

    describe('step practice loop', () => {
        it('filters a queue to playable notes inside the playback range', () => {
            const b1 = beatAt([60], 100);
            const b2 = beatAt([62], 200);
            const b3 = beatAt([64], 300);
            const queue = buildPracticeQueue([b1, b2, b3]);

            const filtered = filterPracticeQueueByRange(queue, { startTick: 150, endTick: 250 });

            expect(filtered.map(item => item.expectedNotes)).toEqual([[62]]);
        });

        it('keeps the full queue when no range is selected', () => {
            const queue = buildPracticeQueue([beatAt([60], 100), beatAt([62], 200)]);

            expect(filterPracticeQueueByRange(queue, null)).toEqual(queue);
        });

        it('loops back to the first item instead of completing', () => {
            const firstBeat = beatAt([60], 100);
            const lastBeat = beatAt([62], 200);
            const session = new PracticeSession();
            session.setQueue(buildPracticeQueue([firstBeat, lastBeat]));
            session.setLoopEnabled(true);
            session.start();

            expect(session.handleMidiNote(60).type).toBe('correct');
            expect(session.handleMidiNoteOff(60).type).toBe('partial');
            const looped = session.handleMidiNote(62);

            if (looped.type !== 'looped') {
                throw new Error(`Expected looped result, got ${looped.type}`);
            }
            expect(looped.state.running).toBe(true);
            expect(looped.state.complete).toBe(false);
            expect(looped.state.currentIndex).toBe(0);
            expect(looped.state.currentItem?.beat).toBe(firstBeat);
            expect(looped.state.currentItem?.startTick).toBe(100);
            expect(looped.item.beat).toBe(lastBeat);
            expect(looped.state.currentPass).toBe(2);
        });

        it('increments clean streak after a clean loop pass', () => {
            const session = new PracticeSession();
            session.setQueue(buildPracticeQueue([beatAt([60], 100)]));
            session.setLoopEnabled(true);
            session.start();

            const result = session.handleMidiNote(60);

            expect(result.type).toBe('looped');
            expect(result.state.cleanPassStreak).toBe(1);
            expect(result.state.lastPassWrongCount).toBe(0);
        });

        it('resets clean streak after a loop pass with a wrong note', () => {
            const session = new PracticeSession();
            session.setQueue(buildPracticeQueue([beatAt([60], 100)]));
            session.setLoopEnabled(true);
            session.start();

            session.handleMidiNote(60);
            expect(session.getState().cleanPassStreak).toBe(1);

            expect(session.handleMidiNote(61).type).toBe('wrong');
            expect(session.handleMidiNoteOff(61).type).toBe('partial');
            expect(session.handleMidiNoteOff(60).type).toBe('partial');
            const result = session.handleMidiNote(60);

            expect(result.type).toBe('looped');
            expect(result.state.cleanPassStreak).toBe(0);
            expect(result.state.lastPassWrongCount).toBe(1);
        });

        it('keeps chord matching behavior in loop mode', () => {
            const session = new PracticeSession();
            session.setQueue(buildPracticeQueue([beatAt([60, 64], 100)]));
            session.setLoopEnabled(true);
            session.start();

            expect(session.handleMidiNote(64).type).toBe('partial');
            const result = session.handleMidiNote(60);

            expect(result.type).toBe('looped');
            expect(result.state.currentIndex).toBe(0);
        });
    });

    describe('perform session', () => {
        it('selects a tempo cursor item from playback ticks', () => {
            const b1 = beatAt([60], 100);
            const b2 = beatAt([62], 200);
            const b3 = beatAt([64], 300);
            const queue = buildPracticeQueue([b1, b2, b3]);

            expect(selectTempoCursorItem(queue, 50)).toBeNull();
            expect(selectTempoCursorItem(queue, 100)?.beat).toBe(b1);
            expect(selectTempoCursorItem(queue, 250)?.beat).toBe(b2);
            expect(selectTempoCursorItem(queue, 350)?.beat).toBe(b3);
            expect(selectTempoCursorItem(queue, 350, true)).toBeNull();
        });

        it('moves the tempo cursor back to the start after a loop wrap', () => {
            const b1 = beatAt([60], 100);
            const b2 = beatAt([62], 200);
            const queue = buildPracticeQueue([b1, b2]);

            expect(selectTempoCursorItem(queue, 220)?.beat).toBe(b2);
            expect(selectTempoCursorItem(queue, 100)?.beat).toBe(b1);
        });

        it('ignores scoring before expected wall timestamps are ready', () => {
            const session = performSession([performItem(60, 100)]);

            const result = session.handleNoteOn(60, 1000);

            expect(result.type).toBe('ignored');
            expect(result.state.scoringReady).toBe(false);
        });

        it('matches a correct note once within the wall-clock timing window', () => {
            const session = performSession([performItem(60, 100, 1000)]);

            const matched = session.handleNoteOn(60, 1080);
            const duplicate = session.handleNoteOn(60, 1085);

            expect(matched.type).toBe('matched');
            expect(duplicate.type).toBe('ignored');
            expect(session.getState().correctCount).toBe(1);
        });

        it('scores notes with known timestamps before future items are projected', () => {
            const session = performSession([performItem(60, 100, 1000), performItem(62, 200)]);

            const matched = session.handleNoteOn(60, 1000);
            const future = session.handleNoteOn(62, 1000);

            expect(matched.type).toBe('matched');
            expect(future.type).toBe('ignored');
            expect(session.getState().correctCount).toBe(1);
        });

        it('tracks early and late timing from input timestamp minus expected wall timestamp', () => {
            const session = performSession([performItem(60, 100, 1000), performItem(62, 200, 2000)]);

            session.handleNoteOn(60, 950);
            session.handleNoteOn(62, 2040);

            expect(session.getState().earlyCount).toBe(1);
            expect(session.getState().lateCount).toBe(1);
        });

        it('supports ignore octave in perform matching', () => {
            const session = performSession([performItem(60, 100, 1000)], { ignoreOctave: true });

            expect(session.handleNoteOn(72, 1000).type).toBe('matched');
        });

        it('matches repeated same pitch to the earliest overdue item first', () => {
            const session = performSession([performItem(60, 100, 1000), performItem(60, 200, 1080)]);

            const first = session.handleNoteOn(60, 1060);
            const second = session.handleNoteOn(60, 1085);

            expect(first.type).toBe('matched');
            if (first.type === 'matched') {
                expect(first.item.startTick).toBe(100);
            }
            expect(second.type).toBe('matched');
            if (second.type === 'matched') {
                expect(second.item.startTick).toBe(200);
            }
        });

        it('marks missed notes during advancePosition', () => {
            const session = performSession([performItem(60, 100, 1000)]);

            const result = session.advancePosition(200, 1201);

            expect(result.type).toBe('missed');
            expect(session.getState().missedCount).toBe(1);
        });

        it('raises speed after three clean loop passes and caps at target speed', () => {
            const session = performSession([performItem(60, 100, 1000)], {
                startSpeed: 0.7,
                targetSpeed: 0.8
            });

            for (let i = 0; i < 3; i++) {
                session.handleNoteOn(60, 1000);
                session.completePass(i + 1);
            }

            expect(session.getState().speed).toBe(0.8);
            expect(session.getState().cleanPassStreak).toBe(0);
        });

        it('keeps completed pass statistics after resetting counters for the next pass', () => {
            const session = performSession([performItem(60, 100, 1000), performItem(62, 200, 2000)]);

            session.handleNoteOn(60, 980);
            session.handleNoteOn(62, 2040);
            const pass = session.completePass(1);

            expect(pass?.stats.correctCount).toBe(2);
            expect(pass?.stats.earlyCount).toBe(1);
            expect(pass?.stats.lateCount).toBe(1);
            expect(session.getState().correctCount).toBe(0);
            expect(session.getState().lastPass?.correctCount).toBe(2);
        });
    });
});

function beat(notes: number[], isRest = false, noteSources?: PracticeBeatSource['notes']): PracticeBeatSource {
    const b: PracticeBeatSource = {
        isRest,
        notes: noteSources ?? notes.map(realValue => ({ realValue }))
    };
    for (const note of b.notes) {
        (note as any).beat = b;
    }
    return b;
}

function beatAt(
    notes: number[],
    startTick: number,
    playbackDuration = 1,
    noteSources?: PracticeBeatSource['notes']
): PracticeBeatSource {
    const b = beat(notes, false, noteSources);
    b.absolutePlaybackStart = startTick;
    b.playbackDuration = playbackDuration;
    for (const note of b.notes) {
        (note as any).beat = b;
    }
    return b;
}

function performItem(pitch: number, startTick: number, expectedWallTimestampMs?: number): PerformExpectedItem<PracticeBeatSource> {
    return {
        beat: beatAt([pitch], startTick),
        pitch,
        startTick,
        expectedWallTimestampMs,
        matched: false
    };
}

function performSession(
    items: PerformExpectedItem<PracticeBeatSource>[],
    settings: Partial<typeof defaultPerformSettings> = {}
): PerformSession<PracticeBeatSource> {
    const session = new PerformSession<PracticeBeatSource>();
    session.configure({ ...defaultPerformSettings, ...settings });
    session.start(items);
    return session;
}
