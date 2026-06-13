import { describe, expect, it } from 'vitest';
import { ScoreLoader } from '@coderline/alphatab/importer/ScoreLoader';
import { MidiFile } from '@coderline/alphatab/midi/MidiFile';
import { AlphaSynthMidiFileHandler } from '@coderline/alphatab/midi/AlphaSynthMidiFileHandler';
import { MidiFileGenerator } from '@coderline/alphatab/midi/MidiFileGenerator';
import { ControllerType } from '@coderline/alphatab/midi/ControllerType';
import { ControlChangeEvent } from '@coderline/alphatab/midi/MidiEvent';
import { TinySoundFont } from '@coderline/alphatab/synth/synthesis/TinySoundFont';
import { Settings } from '@coderline/alphatab/Settings';

describe('Panning tests', () => {
    it('generates correct MIDI pan events and synthesizes them correctly', () => {
        const score = ScoreLoader.loadAlphaTex('C4');
        const settings = new Settings();

        const expectPan = (balance: number, expectedMidiPan: number) => {
            score.tracks[0].playbackInfo.balance = balance;
            const midiFile = new MidiFile();
            const handler = new AlphaSynthMidiFileHandler(midiFile, true);
            const generator = new MidiFileGenerator(score, settings, handler);
            generator.generate();

            const panEvents = midiFile.events.filter(
                e => e instanceof ControlChangeEvent && e.controller === ControllerType.PanCoarse
            ) as ControlChangeEvent[];

            expect(panEvents.length).toBeGreaterThan(0);
            expect(panEvents[0].value).toBe(expectedMidiPan);

            const synth = new TinySoundFont(44100);
            for (const e of midiFile.events) {
                synth.processMidiMessage(e);
            }
            expect(synth.channelGetPan(0)).toBeCloseTo((expectedMidiPan << 7) / 16383, 5);
        };

        expectPan(8, 64);
        expectPan(16, 127);
        expectPan(0, 0);
    });
});
