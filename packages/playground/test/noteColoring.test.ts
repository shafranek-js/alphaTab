import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { applySuzukiNoteColors } from '../src/util/noteColoring';

const noteHead = alphaTab.model.NoteSubElement.StandardNotationNoteHead;
const tabFret = alphaTab.model.NoteSubElement.GuitarTabFretNumber;
const numberedNumber = alphaTab.model.NoteSubElement.NumberedNumber;
const notationEffects = alphaTab.model.NoteSubElement.StandardNotationEffects;

function createScoreWithNotes(notes: alphaTab.model.Note[]): alphaTab.model.Score {
    const score = new alphaTab.model.Score();
    const track = new alphaTab.model.Track();
    const staff = new alphaTab.model.Staff();
    const bar = new alphaTab.model.Bar();
    const voice = new alphaTab.model.Voice();
    const beat = new alphaTab.model.Beat();

    score.addTrack(track);
    track.addStaff(staff);
    staff.addBar(bar);
    bar.addVoice(voice);
    voice.addBeat(beat);
    for (const note of notes) {
        beat.addNote(note);
    }

    return score;
}

function createNote(
    tone: number,
    accidentalMode: alphaTab.model.NoteAccidentalMode = alphaTab.model.NoteAccidentalMode.Default
): alphaTab.model.Note {
    const note = new alphaTab.model.Note();
    note.octave = 4;
    note.tone = tone;
    note.accidentalMode = accidentalMode;
    return note;
}

function colorFor(note: alphaTab.model.Note, target = noteHead): string | undefined | null {
    return note.style?.colors.get(target)?.rgba.toLowerCase();
}

describe('applySuzukiNoteColors', () => {
    it('uses the C color for C, C sharp, and C flat spellings', () => {
        const c = createNote(0);
        const cSharp = createNote(1, alphaTab.model.NoteAccidentalMode.ForceSharp);
        const cFlat = createNote(11, alphaTab.model.NoteAccidentalMode.ForceFlat);
        const score = createScoreWithNotes([c, cSharp, cFlat]);

        applySuzukiNoteColors(score, true);

        expect(colorFor(c)).toBe('#ff0000');
        expect(colorFor(cSharp)).toBe('#ff0000');
        expect(colorFor(cFlat)).toBe('#ff0000');
    });

    it('applies the expected Suzuki palette to all natural note letters and tab/numbered targets', () => {
        const notes = [createNote(0), createNote(2), createNote(4), createNote(5), createNote(7), createNote(9), createNote(11)];
        const score = createScoreWithNotes(notes);
        const expected = ['#ff0000', '#ff9900', '#fff200', '#27e000', '#33d9ff', '#0000cc', '#f000ff'];

        applySuzukiNoteColors(score, true);

        for (let i = 0; i < notes.length; i++) {
            expect(colorFor(notes[i], noteHead)).toBe(expected[i]);
            expect(colorFor(notes[i], tabFret)).toBe(expected[i]);
            expect(colorFor(notes[i], numberedNumber)).toBe(expected[i]);
        }
    });

    it('restores only colors changed by the Suzuki helper', () => {
        const note = createNote(0);
        const originalHead = alphaTab.model.Color.fromJson('#123456')!;
        const unrelatedEffect = alphaTab.model.Color.fromJson('#abcdef')!;
        note.style = new alphaTab.model.NoteStyle();
        note.style.colors.set(noteHead, originalHead);
        note.style.colors.set(notationEffects, unrelatedEffect);
        const score = createScoreWithNotes([note]);

        applySuzukiNoteColors(score, true);
        expect(colorFor(note, noteHead)).toBe('#ff0000');
        expect(colorFor(note, notationEffects)).toBe('#abcdef');

        applySuzukiNoteColors(score, false);
        expect(colorFor(note, noteHead)).toBe('#123456');
        expect(colorFor(note, notationEffects)).toBe('#abcdef');
    });

    it('removes helper-created style state and skips invisible, percussion, or invalid notes', () => {
        const normal = createNote(0);
        const invisible = createNote(2);
        invisible.isVisible = false;
        const percussion = createNote(4);
        percussion.percussionArticulation = 35;
        const invalid = createNote(-1);
        const score = createScoreWithNotes([normal, invisible, percussion, invalid]);

        applySuzukiNoteColors(score, true);

        expect(colorFor(normal)).toBe('#ff0000');
        expect(invisible.style).toBeUndefined();
        expect(percussion.style).toBeUndefined();
        expect(invalid.style).toBeUndefined();

        applySuzukiNoteColors(score, false);
        expect(normal.style).toBeUndefined();
    });
});
