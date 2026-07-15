import { ScoreLoader } from '@coderline/alphatab/importer/ScoreLoader';
import {
    EndOfTrackEvent,
    NoteOffEvent,
    NoteOnEvent,
    ProgramChangeEvent,
    TempoChangeEvent,
    TimeSignatureEvent
} from '@coderline/alphatab/midi/MidiEvent';
import { MidiFile, MidiFileFormat } from '@coderline/alphatab/midi/MidiFile';
import { MidiUtils } from '@coderline/alphatab/midi/MidiUtils';
import { Duration } from '@coderline/alphatab/model/Duration';
import { describe, expect, it } from 'vitest';

describe('MidiImporterTest', () => {
    it('loads standard midi files', () => {
        const midi = new MidiFile();
        midi.format = MidiFileFormat.SingleTrackMultiChannel;
        midi.division = MidiUtils.QuarterTime;
        midi.addEvent(new TempoChangeEvent(0, 500000));
        midi.addEvent(new TimeSignatureEvent(0, 0, 3, 2, 24, 8));
        midi.addEvent(new ProgramChangeEvent(0, 0, 0, 24));
        midi.addEvent(new NoteOnEvent(0, 0, 0, 60, 100));
        midi.addEvent(new NoteOffEvent(0, MidiUtils.QuarterTime, 0, 60, 0));
        midi.addEvent(new NoteOnEvent(0, MidiUtils.QuarterTime, 0, 64, 100));
        midi.addEvent(new NoteOffEvent(0, MidiUtils.QuarterTime * 2, 0, 64, 0));
        midi.addEvent(new EndOfTrackEvent(0, MidiUtils.QuarterTime * 3));

        const score = ScoreLoader.loadScoreFromBytes(midi.toBinary());

        expect(score.tracks).toHaveLength(1);
        expect(score.masterBars).toHaveLength(2);
        expect(score.masterBars[0].timeSignatureNumerator).toBe(3);
        expect(score.masterBars[0].timeSignatureDenominator).toBe(4);
        expect(score.masterBars[0].tempoAutomations[0].value).toBe(120);

        const track = score.tracks[0];
        expect(track.playbackInfo.program).toBe(24);
        expect(track.staves[0].showTablature).toBe(false);

        const beats = track.staves[0].bars[0].voices[0].beats;
        expect(beats[0].duration).toBe(Duration.Quarter);
        expect(beats[0].notes[0].realValue).toBe(60);
        expect(beats[1].duration).toBe(Duration.Quarter);
        expect(beats[1].notes[0].realValue).toBe(64);
        expect(beats[2].isRest).toBe(true);
    });
});
