import { describe, expect, it } from 'vitest';
import { ScoreLoader } from '@coderline/alphatab/importer/ScoreLoader';
import { ByteBuffer } from '@coderline/alphatab/io/ByteBuffer';
import { AlphaSynthMidiFileHandler } from '@coderline/alphatab/midi/AlphaSynthMidiFileHandler';
import { ControllerType } from '@coderline/alphatab/midi/ControllerType';
import {
    type ControlChangeEvent,
    type MidiEvent,
    MidiEventType,
    NoteOnEvent,
    TempoChangeEvent
} from '@coderline/alphatab/midi/MidiEvent';
import { MidiFile } from '@coderline/alphatab/midi/MidiFile';
import { MidiFileGenerator } from '@coderline/alphatab/midi/MidiFileGenerator';
import type { Score } from '@coderline/alphatab/model/Score';
import { Settings } from '@coderline/alphatab/Settings';
import { AlphaSynth } from '@coderline/alphatab/synth/AlphaSynth';
import { AudioExportOptions } from '@coderline/alphatab/synth/IAudioExporter';
import { SynthConstants } from '@coderline/alphatab/synth/SynthConstants';
import { SynthEvent } from '@coderline/alphatab/synth/synthesis/SynthEvent';
import { TinySoundFont } from '@coderline/alphatab/synth/synthesis/TinySoundFont';
import { VorbisFile } from '@coderline/alphatab/synth/vorbis/VorbisFile';
import { TestOutput } from 'test/audio/TestOutput';
import { TestPlatform } from 'test/TestPlatform';

describe('AlphaSynthTests', () => {
    it('pcm-generation', async () => {
        const data = await TestPlatform.loadFile('test-data/audio/default.sf2');
        const tex: string =
            '\\tempo 102 \\tuning E4 B3 G3 D3 A2 E2 \\instrument 25 . r.8 (0.4 0.3 ).8 ' +
            '(-.3 -.4 ).2 {d } | (0.4 0.3 ).8 r.8 (3.3 3.4 ).8 r.8 (5.4 5.3 ).4 r.8 (0.4 0.3 ).8 |' +
            ' r.8 (3.4 3.3 ).8 r.8 (6.3 6.4 ).8 (5.4 5.3 ).4 {d }r.8 |' +
            ' (0.4 0.3).8 r.8(3.4 3.3).8 r.8(5.4 5.3).4 r.8(3.4 3.3).8 | ' +
            'r.8(0.4 0.3).8(-.3 - .4).2 { d } | ';
        const score = ScoreLoader.loadAlphaTex(tex);
        const midi = new MidiFile();
        const gen = new MidiFileGenerator(score, null, new AlphaSynthMidiFileHandler(midi));
        gen.generate();
        const testOutput = new TestOutput();
        const synth = new AlphaSynth(testOutput, 500);
        synth.loadSoundFont(data, false);
        synth.loadMidiFile(midi);
        synth.play();
        let finished: boolean = false;
        synth.finished.on(() => {
            finished = true;
        });
        while (!finished) {
            testOutput.next();
        }
    });

    it('only-used-instruments-decoded-sf2', async () => {
        const data = await TestPlatform.loadFile('test-data/audio/default.sf2');
        const tex: string = `
            \\tempo 120
            .
            \\track "T01"
            \\ts 1 4
            \\instrument 24
            4.4.4*4
            \\track "T02"
            \\instrument 30
            4.4.4*4`;
        const score = ScoreLoader.loadAlphaTex(tex);
        const midi = new MidiFile();
        const gen = new MidiFileGenerator(score, null, new AlphaSynthMidiFileHandler(midi));
        gen.generate();
        const testOutput = new TestOutput();
        const synth = new AlphaSynth(testOutput, 500);
        synth.loadSoundFont(data, false);
        synth.loadMidiFile(midi);

        expect(synth.isReadyForPlayback).toBe(true);
        expect(synth.hasSamplesForProgram(24)).toBe(true);
        expect(synth.hasSamplesForProgram(30)).toBe(true);
        expect(synth.hasSamplesForProgram(1)).toBe(false);
        expect(synth.hasSamplesForProgram(35)).toBe(false);
        expect(synth.hasSamplesForPercussion(SynthConstants.MetronomeKey)).toBe(true);
    });

    it('only-used-instruments-decoded-sf3', async () => {
        const data = await TestPlatform.loadFile('test-data/audio/default.sf3');

        const tex: string = `
            \\tempo 120
            .
            \\track "T01"
            \\ts 1 4
            \\instrument 24
            4.4.4*4
            \\track "T02"
            \\instrument 30
            4.4.4*4`;
        const score = ScoreLoader.loadAlphaTex(tex);
        const midi = new MidiFile();
        const gen = new MidiFileGenerator(score, null, new AlphaSynthMidiFileHandler(midi));
        gen.generate();
        const testOutput = new TestOutput();
        const synth = new AlphaSynth(testOutput, 500);
        synth.loadSoundFont(data, false);
        synth.loadMidiFile(midi);

        expect(synth.isReadyForPlayback).toBe(true);
        expect(synth.hasSamplesForProgram(24)).toBe(true);
        expect(synth.hasSamplesForProgram(30)).toBe(true);
        expect(synth.hasSamplesForProgram(1)).toBe(false);
        expect(synth.hasSamplesForProgram(35)).toBe(false);
        expect(synth.hasSamplesForPercussion(SynthConstants.MetronomeKey)).toBe(true);
    });

    async function testVorbisFile(name: string) {
        const data = await TestPlatform.loadFile(`test-data/audio/${name}.ogg`);
        const vorbis = new VorbisFile(ByteBuffer.fromBuffer(data));

        expect(vorbis.streams.length).toBe(1);
        expect(vorbis.streams[0].audioChannels).toBe(2);
        expect(vorbis.streams[0].audioSampleRate).toBe(44100);
        expect(vorbis.streams[0].samples.length).toBeGreaterThan(44100 * 0.05);

        const generated = vorbis.streams[0].samples;
        const reference = new DataView((await TestPlatform.loadFile(`test-data/audio/${name}_alphaTab.pcm`)).buffer);
        try {
            expect(generated.length).toBe(reference.buffer.byteLength / 4);

            for (let i = 0; i < generated.length; i++) {
                expect(generated[i], `Difference at index ${i}`).toBe(reference.getFloat32(i * 4, true));
            }
        } catch (e) {
            await TestPlatform.saveFile(
                `test-data/audio/${name}_alphaTab_new.pcm`,
                new Uint8Array(vorbis.streams[0].samples.buffer)
            );

            throw e;
        }
    }

    it('ogg-vorbis-short', async () => {
        await testVorbisFile('Short');
    });

    it('ogg-vorbis-example', { timeout: 30000 }, async () => {
        await testVorbisFile('Example');
    });

    async function testAudioExport(
        score: Score,
        fileName: string,
        prepareOptions: (options: AudioExportOptions) => void
    ) {
        // add a fake sync point to get time range (if there are not already sync points)
        const syncPoints = score.exportFlatSyncPoints();
        if (syncPoints.length === 0) {
            score.applyFlatSyncPoints([
                {
                    barIndex: 0,
                    barOccurence: 0,
                    barPosition: 0,
                    millisecondOffset: 0
                }
            ]);
        }

        const soundFont = await TestPlatform.loadFile('test-data/audio/default.sf2');
        const synth = new AlphaSynth(new TestOutput(), 500);

        const midi: MidiFile = new MidiFile();
        const generator: MidiFileGenerator = new MidiFileGenerator(
            score,
            new Settings(),
            new AlphaSynthMidiFileHandler(midi)
        );
        generator.applyTranspositionPitches = false;
        generator.generate();

        const exportOptions = new AudioExportOptions();
        exportOptions.masterVolume = 1;
        exportOptions.metronomeVolume = 0;
        exportOptions.sampleRate = 44100;
        exportOptions.soundFonts = [soundFont];
        prepareOptions(exportOptions);

        const exporter = synth.exportAudio(exportOptions, midi, generator.syncPoints, generator.transpositionPitches);

        let generated: Float32Array = new Float32Array(
            exportOptions.sampleRate *
                (generator.syncPoints[generator.syncPoints.length - 1].syncTime / 1000) *
                SynthConstants.AudioChannels
        );

        let totalSamples = 0;
        while (true) {
            const chunk = exporter.render(300);
            if (chunk === undefined) {
                break;
            }

            const neededSize = totalSamples + chunk.samples.length;
            if (generated.length < neededSize) {
                const needed = neededSize - generated.length;
                const newBuffer = new Float32Array(generated.length + needed);
                newBuffer.set(generated, 0);
                generated = newBuffer;
            }

            generated.set(chunk.samples, totalSamples);
            totalSamples += chunk.samples.length;
        }

        if (totalSamples < generated.length) {
            generated = generated.subarray(0, totalSamples);
        }

        try {
            const reference = new DataView((await TestPlatform.loadFile(`test-data/audio/${fileName}.pcm`)).buffer);
            expect(generated.length).toBe(reference.buffer.byteLength / 4);

            for (let i = 0; i < generated.length; i++) {
                const expected = reference.getFloat32(i * 4, true);
                if (generated[i] !== expected) {
                    // custom check, chai assertion has quite huge overhead if called that often
                    expect(generated[i], `Difference at index ${i}`).toBe(expected);
                }
            }
        } catch (e) {
            await TestPlatform.saveFile(
                `test-data/audio/${fileName}-new.pcm`,
                new Uint8Array(generated.buffer, generated.byteOffset, generated.byteLength)
            );

            throw e;
        }
    }

    it('export-test', async () => {
        const tex: string = `
            \\tempo 120
            .
            \\ts 4 4
            :8 C4 * 8
        `;
        const settings = new Settings();
        const score = ScoreLoader.loadAlphaTex(tex, settings);

        await testAudioExport(score, 'export-test', _options => {
            // no settings
        });
    });

    it('export-silent-with-metronome', async () => {
        const tex: string = `
            \\tempo 120
            .
            \\ts 4 4
            :8 C4 * 8
        `;
        const settings = new Settings();
        const score = ScoreLoader.loadAlphaTex(tex, settings);

        await testAudioExport(score, 'export-silent-with-metronome', options => {
            options.metronomeVolume = 1;
            for (const t of score.tracks) {
                options.trackVolume.set(t.index, 0.5);
            }
        });
    });

    it('export-sync-points', async () => {
        const data = await TestPlatform.loadFile('test-data/audio/syncpoints-testfile.gp');
        const score = ScoreLoader.loadScoreFromBytes(data, new Settings());

        await testAudioExport(score, 'export-sync-points', options => {
            options.useSyncPoints = true;
        });
    });

    it('midi-bank', () => {
        const score = ScoreLoader.loadAlphaTex(`
            \\track "T1" { instrument 25 bank 77 }
                C4 D4 E4 F4 | C4 { instrument 27 bank 1000 } D4 E4 F4

            \\track "T1" { instrument 25 bank 50 }
                C4 D4 E4 F4 | C4 D4 E4 { instrument 27 bank 4000 } F4
        `);

        const midi: MidiFile = new MidiFile();
        const generator: MidiFileGenerator = new MidiFileGenerator(
            score,
            new Settings(),
            new AlphaSynthMidiFileHandler(midi)
        );
        generator.applyTranspositionPitches = false;
        generator.generate();

        const bankChanges: ControlChangeEvent[] = [];
        for (const e of midi.events) {
            if (
                e.type === MidiEventType.ControlChange &&
                ((e as ControlChangeEvent).controller === ControllerType.BankSelectCoarse ||
                    (e as ControlChangeEvent).controller === ControllerType.BankSelectFine)
            ) {
                bankChanges.push(e as ControlChangeEvent);
            }
        }

        expect(bankChanges).toMatchSnapshot();

        const synth = new TinySoundFont(44100);

        let i = 0;
        function playTo(ticks: number) {
            while (i < bankChanges.length) {
                const nextEvent = bankChanges[i];
                if (nextEvent.tick <= ticks) {
                    synth.processMidiMessage(nextEvent);
                    i++;
                } else {
                    break;
                }
            }
        }

        playTo(0);
        expect(synth.channelGetPresetBank(0)).toBe(77);
        expect(synth.channelGetPresetBank(1)).toBe(77);
        expect(synth.channelGetPresetBank(2)).toBe(50);
        expect(synth.channelGetPresetBank(3)).toBe(50);

        playTo(3840);
        expect(synth.channelGetPresetBank(0)).toBe(1000);
        expect(synth.channelGetPresetBank(1)).toBe(1000);
        expect(synth.channelGetPresetBank(2)).toBe(50);
        expect(synth.channelGetPresetBank(3)).toBe(50);

        playTo(3840 * 2);
        expect(synth.channelGetPresetBank(0)).toBe(1000);
        expect(synth.channelGetPresetBank(1)).toBe(1000);
        expect(synth.channelGetPresetBank(2)).toBe(4000);
        expect(synth.channelGetPresetBank(3)).toBe(4000);
    });

    async function testPlaythrough(midi: MidiFile) {
        const testOutput = new TestOutput(false);
        const synth = new AlphaSynth(testOutput, 500);
        const soundFont = await TestPlatform.loadFile('test-data/audio/default.sf2');
        synth.loadSoundFont(soundFont, false);
        synth.loadMidiFile(midi);
        synth.play();
        let finished = false;
        synth.finished.on(() => {
            finished = true;
        });

        const start = Date.now();

        while (!finished) {
            const now = Date.now();
            if (now - start > 2000) {
                throw new Error(`play did not complete after ${2000}ms`);
            }
            testOutput.next();
        }
    }

    it('small-tempos', async () => {
        const score = ScoreLoader.loadScoreFromBytes(await TestPlatform.loadFile('test-data/audio/small-tempo.xml'));

        expect(score.masterBars[0].tempoAutomations[0].value).toBe(0.111);

        const midi = new MidiFile();
        const handler = new AlphaSynthMidiFileHandler(midi);
        const generator = new MidiFileGenerator(score, null, handler);
        generator.generate();

        const tempoChange: MidiEvent[] = midi.events.filter(e => e instanceof TempoChangeEvent);
        expect(tempoChange.length).toBe(1);
        expect((tempoChange[0] as TempoChangeEvent).beatsPerMinute).toBe(0.111);

        await testPlaythrough(midi);
    });

    it('zero-tempo', async () => {
        const score = ScoreLoader.loadScoreFromBytes(await TestPlatform.loadFile('test-data/audio/small-tempo.xml'));

        expect(score.masterBars[0].tempoAutomations[0].value).toBe(0.111);
        score.masterBars[0].tempoAutomations[0].value = 0;

        const midi = new MidiFile();
        const handler = new AlphaSynthMidiFileHandler(midi);
        const generator = new MidiFileGenerator(score, null, handler);
        generator.generate();

        const tempoChange: MidiEvent[] = midi.events.filter(e => e instanceof TempoChangeEvent);
        expect(tempoChange.length).toBe(1);
        expect((tempoChange[0] as TempoChangeEvent).beatsPerMinute).toBe(0);

        await testPlaythrough(midi);
    });

    it('live-notes-not-killed-by-seek', async () => {
        const data = await TestPlatform.loadFile('test-data/audio/default.sf2');
        const tex = '\\tempo 102 \\tuning E4 B3 G3 D3 A2 E2 \\instrument 25 . r.8 (0.4 0.3 ).8';
        const score = ScoreLoader.loadAlphaTex(tex);
        const midi = new MidiFile();
        const gen = new MidiFileGenerator(score, null, new AlphaSynthMidiFileHandler(midi));
        gen.generate();

        const testOutput = new TestOutput();
        const synth = new AlphaSynth(testOutput, 500);
        synth.loadSoundFont(data, false);
        synth.loadMidiFile(midi);

        // 1. Perform a seek to initialize the channels and presets
        synth.timePosition = 1000;

        // 2. Play live note 60 (channel 0)
        synth.playLiveNote(0, 60, 100);
        testOutput.next();
        
        // Let's verify active voices count > 0
        const tsf = (synth as any).synthesizer;
        expect(tsf.activeVoiceCount).toBeGreaterThan(0);

        // 3. Perform another seek (timePosition = 2000)
        synth.timePosition = 2000;

        // We expect live notes NOT to be killed by the seek!
        expect(tsf.activeVoiceCount).toBeGreaterThan(0);

        // 4. Send song noteOff event (non-live) for note 60
        tsf.channelNoteOff(0, 60, false);
        testOutput.next();

        // The live note (which has isLive = true) should still be playing!
        expect(tsf.activeVoiceCount).toBeGreaterThan(0);

        // 5. Send live noteOff event (isLive = true) for note 60
        synth.stopLiveNote(0, 60);

        let limit = 100;
        while (tsf.activeVoiceCount > 0 && limit > 0) {
            testOutput.next();
            limit--;
        }
        
        // Now the active voice count should drop to 0
        expect(tsf.activeVoiceCount).toBe(0);
    });

    it('repeated-live-notes-step-practice', async () => {
        const data = await TestPlatform.loadFile('test-data/audio/default.sf2');
        const tex = '\\tempo 102 \\tuning E4 B3 G3 D3 A2 E2 \\instrument 25 . (0.4 0.3 ).8 (0.4 0.3 ).8';
        const score = ScoreLoader.loadAlphaTex(tex);
        const midi = new MidiFile();
        const gen = new MidiFileGenerator(score, null, new AlphaSynthMidiFileHandler(midi));
        gen.generate();

        const testOutput = new TestOutput();
        const synth = new AlphaSynth(testOutput, 500);
        synth.loadSoundFont(data, false);
        synth.loadMidiFile(midi);

        const tsf = (synth as any).synthesizer;

        // 0. Perform a seek to initialize the channels and presets
        synth.timePosition = 100;

        // 1. Play first live note 60
        synth.playLiveNote(0, 60, 100);
        testOutput.next();
        expect(tsf.activeVoiceCount).toBeGreaterThan(0);

        // 2. First note matched -> Seek to second note (1000ms)
        synth.timePosition = 1000;
        testOutput.next();
        expect(tsf.activeVoiceCount).toBeGreaterThan(0);

        // 3. User releases first note
        synth.stopLiveNote(0, 60);
        testOutput.next();
        expect(tsf.activeVoiceCount).toBeGreaterThan(0);

        // 4. User plays second note
        synth.playLiveNote(0, 60, 100);
        testOutput.next();
        expect(tsf.activeVoiceCount).toBeGreaterThan(1); // Voice 1 (fading) + Voice 2 (active)

        // 5. Second note matched -> Seek to third note/end (2000ms)
        synth.timePosition = 2000;
        testOutput.next();
        expect(tsf.activeVoiceCount).toBeGreaterThan(0);

        // 6. User releases second note
        synth.stopLiveNote(0, 60);
        testOutput.next();

        // 7. Wait for all voices to fade out
        let limit = 100;
        while (tsf.activeVoiceCount > 0 && limit > 0) {
            testOutput.next();
            limit--;
        }

        expect(tsf.activeVoiceCount).toBe(0);
    });

    it('silent-score-playback-keeps-live-notes-audible', async () => {
        const synth = await createReadySynth();
        const output = synth.output as TestOutput;
        const tsf = (synth as any).synthesizer as TinySoundFont;

        synth.silentScorePlayback = true;
        tsf.dispatchEvent(new SynthEvent(0, new NoteOnEvent(0, 0, 0, 60, 127)));
        renderBuffers(output, 4);
        const scoreOnlyEnergy = sampleEnergy(output);
        const scoreOnlyVoices = tsf.activeVoiceCount;

        output.samples = [];
        synth.setChannelMute(0, true);
        synth.playLiveNote(0, 60, 100);
        renderBuffers(output, 4);
        const liveEnergy = sampleEnergy(output);

        expect(scoreOnlyEnergy).toBe(0);
        expect(scoreOnlyVoices).toBe(0);
        expect(liveEnergy).toBeGreaterThan(0);
    });

    it('regular-channel-mute-still-mutes-live-notes', async () => {
        const synth = await createReadySynth();
        const output = synth.output as TestOutput;

        synth.setChannelMute(0, true);
        synth.playLiveNote(0, 60, 100);
        output.next();

        expect(sampleEnergy(output)).toBe(0);
    });
});

async function createReadySynth(): Promise<AlphaSynth> {
    const data = await TestPlatform.loadFile('test-data/audio/default.sf2');
    const score = ScoreLoader.loadAlphaTex('\\tempo 120 \\instrument 25 . 0.4.4');
    const midi = new MidiFile();
    const gen = new MidiFileGenerator(score, null, new AlphaSynthMidiFileHandler(midi));
    gen.generate();

    const synth = new AlphaSynth(new TestOutput(), 500);
    synth.loadSoundFont(data, false);
    synth.loadMidiFile(midi);
    synth.timePosition = 100;
    return synth;
}

function renderBuffers(output: TestOutput, count: number): void {
    for (let i = 0; i < count; i++) {
        output.next();
    }
}

function sampleEnergy(output: TestOutput): number {
    let energy = 0;
    for (const samples of output.samples) {
        for (const sample of samples) {
            energy += Math.abs(sample);
        }
    }
    return energy;
}

