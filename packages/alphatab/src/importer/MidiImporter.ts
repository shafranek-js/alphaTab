import { ScoreImporter } from '@coderline/alphatab/importer/ScoreImporter';
import { UnsupportedFormatError } from '@coderline/alphatab/importer/UnsupportedFormatError';
import { IOHelper } from '@coderline/alphatab/io/IOHelper';
import type { IReadable } from '@coderline/alphatab/io/IReadable';
import { MidiUtils } from '@coderline/alphatab/midi/MidiUtils';
import { Automation } from '@coderline/alphatab/model/Automation';
import { Bar } from '@coderline/alphatab/model/Bar';
import { Beat } from '@coderline/alphatab/model/Beat';
import { Duration } from '@coderline/alphatab/model/Duration';
import { MasterBar } from '@coderline/alphatab/model/MasterBar';
import { Note } from '@coderline/alphatab/model/Note';
import { Score } from '@coderline/alphatab/model/Score';
import { Staff } from '@coderline/alphatab/model/Staff';
import { Track } from '@coderline/alphatab/model/Track';
import { Voice } from '@coderline/alphatab/model/Voice';

/** @internal */
interface MidiTempoChange {
    tick: number;
    beatsPerMinute: number;
}

/** @internal */
interface MidiTimeSignatureChange {
    tick: number;
    numerator: number;
    denominator: number;
}

/** @internal */
interface MidiProgramChange {
    tick: number;
    track: number;
    channel: number;
    program: number;
}

/** @internal */
interface MidiTrackName {
    track: number;
    name: string;
}

/** @internal */
interface MidiNoteSegment {
    sourceTrack: number;
    channel: number;
    key: number;
    velocity: number;
    start: number;
    end: number;
}

/** @internal */
interface ImportedMidi {
    division: number;
    notes: MidiNoteSegment[];
    tempoChanges: MidiTempoChange[];
    timeSignatureChanges: MidiTimeSignatureChange[];
    programChanges: MidiProgramChange[];
    trackNames: MidiTrackName[];
}

/** @internal */
interface ActiveMidiNote {
    sourceTrack: number;
    channel: number;
    key: number;
    velocity: number;
    start: number;
}

/** @internal */
interface ScoreTrackInfo {
    key: string;
    sourceTrack: number;
    channel: number;
    name: string;
    program: number;
    notes: MidiNoteSegment[];
    previousSplitNotes: Map<number, Note>;
}

/** @internal */
interface BarInfo {
    start: number;
    end: number;
    numerator: number;
    denominator: number;
}

/** @internal */
interface BeatDurationInfo {
    duration: Duration;
    dots: number;
    ticks: number;
}

/**
 * Imports Standard MIDI Files (SMF .mid/.midi) into a notation score.
 *
 * MIDI does not contain complete notation data, so the importer creates a
 * best-effort staff notation view from note on/off events.
 * @public
 */
export class MidiImporter extends ScoreImporter {
    private static readonly _midiHeader = 'MThd';
    private static readonly _midiTrack = 'MTrk';
    private static readonly _defaultTempo = 120;
    private static readonly _defaultTimeSignatureNumerator = 4;
    private static readonly _defaultTimeSignatureDenominator = 4;

    public get name(): string {
        return 'MidiImporter';
    }

    public override readScore(): Score {
        const midi = this._readMidiFile();
        const score = this._buildScore(midi);
        score.finish(this.settings);
        return score;
    }

    private _readMidiFile(): ImportedMidi {
        const header = MidiImporter._readFourCc(this.data);
        if (header !== MidiImporter._midiHeader) {
            throw new UnsupportedFormatError('Unsupported format');
        }

        const headerLength = IOHelper.readUInt32BE(this.data);
        if (headerLength < 6) {
            throw new UnsupportedFormatError('Invalid MIDI header');
        }

        const format = IOHelper.readUInt16BE(this.data);
        const trackCount = IOHelper.readUInt16BE(this.data);
        const division = IOHelper.readUInt16BE(this.data);
        if (format < 0 || format > 1 || division <= 0 || (division & 0x8000) !== 0) {
            throw new UnsupportedFormatError('Unsupported MIDI file');
        }
        if (headerLength > 6) {
            this.data.skip(headerLength - 6);
        }

        const midi: ImportedMidi = {
            division,
            notes: [],
            tempoChanges: [{ tick: 0, beatsPerMinute: MidiImporter._defaultTempo }],
            timeSignatureChanges: [
                {
                    tick: 0,
                    numerator: MidiImporter._defaultTimeSignatureNumerator,
                    denominator: MidiImporter._defaultTimeSignatureDenominator
                }
            ],
            programChanges: [],
            trackNames: []
        };

        for (let trackIndex = 0; trackIndex < trackCount && this.data.position < this.data.length; trackIndex++) {
            const chunkId = MidiImporter._readFourCc(this.data);
            const chunkLength = IOHelper.readUInt32BE(this.data);
            const chunkEnd = this.data.position + chunkLength;
            if (chunkId === MidiImporter._midiTrack) {
                this._readTrack(trackIndex, chunkEnd, midi);
            }
            this.data.position = chunkEnd;
        }

        midi.notes.sort((a, b) => a.start - b.start || a.sourceTrack - b.sourceTrack || a.channel - b.channel);
        midi.tempoChanges.sort((a, b) => a.tick - b.tick);
        midi.timeSignatureChanges.sort((a, b) => a.tick - b.tick);
        return midi;
    }

    private _readTrack(trackIndex: number, chunkEnd: number, midi: ImportedMidi): void {
        let tick = 0;
        let runningStatus = -1;
        const activeNotes = new Map<string, ActiveMidiNote[]>();

        while (this.data.position < chunkEnd) {
            tick += MidiImporter._readVariableInt(this.data);
            let status = this.data.readByte();
            if (status < 0x80) {
                if (runningStatus < 0) {
                    throw new UnsupportedFormatError('Invalid MIDI running status');
                }
                this.data.position--;
                status = runningStatus;
            } else if (status < 0xf0) {
                runningStatus = status;
            }

            if (status === 0xff) {
                const metaType = this.data.readByte();
                const length = MidiImporter._readVariableInt(this.data);
                this._readMetaEvent(trackIndex, tick, metaType, length, midi);
                if (metaType === 0x2f) {
                    break;
                }
                continue;
            }

            if (status === 0xf0 || status === 0xf7) {
                const length = MidiImporter._readVariableInt(this.data);
                this.data.skip(length);
                continue;
            }

            const command = status & 0xf0;
            const channel = status & 0x0f;
            switch (command) {
                case 0x80:
                    this._closeNote(
                        trackIndex,
                        channel,
                        this.data.readByte(),
                        this.data.readByte(),
                        tick,
                        activeNotes,
                        midi
                    );
                    break;
                case 0x90: {
                    const key = this.data.readByte();
                    const velocity = this.data.readByte();
                    if (velocity === 0) {
                        this._closeNote(trackIndex, channel, key, velocity, tick, activeNotes, midi);
                    } else {
                        const activeKey = MidiImporter._activeNoteKey(channel, key);
                        let notes = activeNotes.get(activeKey);
                        if (!notes) {
                            notes = [];
                            activeNotes.set(activeKey, notes);
                        }
                        notes.push({ sourceTrack: trackIndex, channel, key, velocity, start: tick });
                    }
                    break;
                }
                case 0xa0:
                case 0xb0:
                case 0xe0:
                    this.data.skip(2);
                    break;
                case 0xc0:
                    midi.programChanges.push({
                        tick,
                        track: trackIndex,
                        channel,
                        program: this.data.readByte()
                    });
                    break;
                case 0xd0:
                    this.data.skip(1);
                    break;
                default:
                    throw new UnsupportedFormatError('Unsupported MIDI event');
            }
        }

        for (const notes of activeNotes.values()) {
            for (const note of notes) {
                if (tick > note.start) {
                    midi.notes.push({
                        sourceTrack: note.sourceTrack,
                        channel: note.channel,
                        key: note.key,
                        velocity: note.velocity,
                        start: note.start,
                        end: tick
                    });
                }
            }
        }
    }

    private _readMetaEvent(
        trackIndex: number,
        tick: number,
        metaType: number,
        length: number,
        midi: ImportedMidi
    ): void {
        switch (metaType) {
            case 0x03: {
                const name = IOHelper.toString(IOHelper.readByteArray(this.data, length), 'utf-8').trim();
                if (name.length > 0) {
                    midi.trackNames.push({ track: trackIndex, name });
                }
                break;
            }
            case 0x51:
                if (length === 3) {
                    const microSecondsPerQuarterNote =
                        (this.data.readByte() << 16) | (this.data.readByte() << 8) | this.data.readByte();
                    if (microSecondsPerQuarterNote > 0) {
                        midi.tempoChanges.push({
                            tick,
                            beatsPerMinute: 60000000 / microSecondsPerQuarterNote
                        });
                    }
                } else {
                    this.data.skip(length);
                }
                break;
            case 0x58:
                if (length >= 2) {
                    const numerator = this.data.readByte();
                    const denominator = 1 << this.data.readByte();
                    if (numerator > 0 && denominator > 0) {
                        midi.timeSignatureChanges.push({ tick, numerator, denominator });
                    }
                    if (length > 2) {
                        this.data.skip(length - 2);
                    }
                } else {
                    this.data.skip(length);
                }
                break;
            default:
                this.data.skip(length);
                break;
        }
    }

    private _closeNote(
        _trackIndex: number,
        channel: number,
        key: number,
        _velocity: number,
        tick: number,
        activeNotes: Map<string, ActiveMidiNote[]>,
        midi: ImportedMidi
    ): void {
        const activeKey = MidiImporter._activeNoteKey(channel, key);
        const notes = activeNotes.get(activeKey);
        if (!notes || notes.length === 0) {
            return;
        }

        const note = notes.shift()!;
        if (tick > note.start) {
            midi.notes.push({
                sourceTrack: note.sourceTrack,
                channel,
                key,
                velocity: note.velocity,
                start: note.start,
                end: tick
            });
        }
        if (notes.length === 0) {
            activeNotes.delete(activeKey);
        }
    }

    private _buildScore(midi: ImportedMidi): Score {
        const score = new Score();
        score.title = 'Imported MIDI';

        const tickScale = MidiUtils.QuarterTime / midi.division;
        const notes = midi.notes.map(n => ({
            sourceTrack: n.sourceTrack,
            channel: n.channel,
            key: n.key,
            velocity: n.velocity,
            start: Math.max(0, Math.round(n.start * tickScale)),
            end: Math.max(0, Math.round(n.end * tickScale))
        }));
        const tempoChanges = midi.tempoChanges.map(t => ({
            tick: Math.max(0, Math.round(t.tick * tickScale)),
            beatsPerMinute: t.beatsPerMinute
        }));
        const timeSignatureChanges = midi.timeSignatureChanges.map(t => ({
            tick: Math.max(0, Math.round(t.tick * tickScale)),
            numerator: t.numerator,
            denominator: t.denominator
        }));
        const programChanges = midi.programChanges.map(p => ({
            tick: Math.max(0, Math.round(p.tick * tickScale)),
            track: p.track,
            channel: p.channel,
            program: p.program
        }));

        const maxEnd = Math.max(MidiUtils.QuarterTime * 4, ...notes.map(n => n.end));
        const bars = this._createMasterBars(score, maxEnd, timeSignatureChanges, tempoChanges);
        const tracks = this._createTracks(notes, programChanges, midi.trackNames);

        if (tracks.length === 0) {
            tracks.push({
                key: '0:0',
                sourceTrack: 0,
                channel: 0,
                name: 'Track 1',
                program: 0,
                notes: [],
                previousSplitNotes: new Map<number, Note>()
            });
        }

        for (const trackInfo of tracks) {
            const track = new Track();
            track.name = trackInfo.name;
            track.shortName = trackInfo.name;
            track.playbackInfo.primaryChannel = trackInfo.channel;
            track.playbackInfo.secondaryChannel = trackInfo.channel;
            track.playbackInfo.program = trackInfo.program;

            const staff = new Staff();
            staff.showTablature = false;
            staff.showStandardNotation = true;
            staff.isPercussion = trackInfo.channel === 9;
            track.addStaff(staff);
            score.addTrack(track);

            this._createBarsForTrack(staff, bars, trackInfo);
        }

        return score;
    }

    private _createMasterBars(
        score: Score,
        maxEnd: number,
        timeSignatureChanges: MidiTimeSignatureChange[],
        tempoChanges: MidiTempoChange[]
    ): BarInfo[] {
        const bars: BarInfo[] = [];
        let tick = 0;
        while (tick <= maxEnd || bars.length === 0) {
            const timeSignature = MidiImporter._findTimeSignatureAt(timeSignatureChanges, tick);
            const barDuration = timeSignature.numerator * MidiUtils.valueToTicks(timeSignature.denominator);
            const masterBar = new MasterBar();
            masterBar.timeSignatureNumerator = timeSignature.numerator;
            masterBar.timeSignatureDenominator = timeSignature.denominator;
            score.addMasterBar(masterBar);

            bars.push({
                start: tick,
                end: tick + barDuration,
                numerator: timeSignature.numerator,
                denominator: timeSignature.denominator
            });

            for (const tempo of tempoChanges) {
                if (tempo.tick >= tick && tempo.tick < tick + barDuration) {
                    masterBar.tempoAutomations.push(
                        Automation.buildTempoAutomation(
                            false,
                            barDuration > 0 ? (tempo.tick - tick) / barDuration : 0,
                            tempo.beatsPerMinute,
                            2
                        )
                    );
                }
            }
            if (masterBar.index === 0 && masterBar.tempoAutomations.length === 0) {
                masterBar.tempoAutomations.push(
                    Automation.buildTempoAutomation(false, 0, MidiImporter._defaultTempo, 2)
                );
            }

            tick += barDuration;
        }
        return bars;
    }

    private _createTracks(
        notes: MidiNoteSegment[],
        programChanges: MidiProgramChange[],
        trackNames: MidiTrackName[]
    ): ScoreTrackInfo[] {
        const tracks = new Map<string, ScoreTrackInfo>();
        for (const note of notes) {
            const key = `${note.sourceTrack}:${note.channel}`;
            let trackInfo = tracks.get(key);
            if (!trackInfo) {
                const program = MidiImporter._findProgramAt(programChanges, note.sourceTrack, note.channel, note.start);
                trackInfo = {
                    key,
                    sourceTrack: note.sourceTrack,
                    channel: note.channel,
                    name: this._getTrackName(trackNames, note.sourceTrack, note.channel, tracks.size),
                    program,
                    notes: [],
                    previousSplitNotes: new Map<number, Note>()
                };
                tracks.set(key, trackInfo);
            }
            trackInfo.notes.push(note);
        }

        const result = Array.from(tracks.values());
        result.sort((a, b) => a.sourceTrack - b.sourceTrack || a.channel - b.channel);
        return result;
    }

    private _createBarsForTrack(staff: Staff, bars: BarInfo[], trackInfo: ScoreTrackInfo): void {
        const notes = trackInfo.notes.slice();
        notes.sort((a, b) => a.start - b.start || a.key - b.key);

        for (const barInfo of bars) {
            const bar = new Bar();
            const voice = new Voice();
            bar.addVoice(voice);
            staff.addBar(bar);

            const notesInBar = notes.filter(n => n.start < barInfo.end && n.end > barInfo.start);
            this._createBeatsForBar(voice, barInfo, notesInBar, trackInfo);
        }
    }

    private _createBeatsForBar(
        voice: Voice,
        barInfo: BarInfo,
        notesInBar: MidiNoteSegment[],
        trackInfo: ScoreTrackInfo
    ): void {
        let cursor = barInfo.start;
        const groupedNotes = new Map<number, MidiNoteSegment[]>();
        for (const note of notesInBar) {
            const start = Math.max(barInfo.start, note.start);
            let group = groupedNotes.get(start);
            if (!group) {
                group = [];
                groupedNotes.set(start, group);
            }
            group.push(note);
        }

        const starts = Array.from(groupedNotes.keys()).sort((a, b) => a - b);
        for (const start of starts) {
            if (start > cursor) {
                this._addBeat(voice, start - cursor, []);
            }

            const group = groupedNotes.get(start)!;
            const end = Math.min(barInfo.end, ...group.map(n => n.end));
            const duration = Math.max(1, end - start);
            const beat = this._addBeat(voice, duration, group);
            for (const noteSegment of group) {
                const note = beat.notes.find(n => n.realValue === noteSegment.key);
                if (!note) {
                    continue;
                }

                const previous = trackInfo.previousSplitNotes.get(noteSegment.key);
                if (noteSegment.start < barInfo.start && previous) {
                    note.isTieDestination = true;
                    note.tieOrigin = previous;
                    previous.tieDestination = note;
                }

                if (noteSegment.end > barInfo.end) {
                    trackInfo.previousSplitNotes.set(noteSegment.key, note);
                } else {
                    trackInfo.previousSplitNotes.delete(noteSegment.key);
                }
            }
            cursor = start + duration;
        }

        if (cursor < barInfo.end) {
            this._addBeat(voice, barInfo.end - cursor, []);
        }
        if (voice.beats.length === 0) {
            this._addBeat(voice, barInfo.end - barInfo.start, []);
        }
    }

    private _addBeat(voice: Voice, ticks: number, notes: MidiNoteSegment[]): Beat {
        const duration = MidiImporter._toBeatDuration(ticks);
        const beat = new Beat();
        beat.duration = duration.duration;
        beat.dots = duration.dots;
        if (duration.ticks !== ticks) {
            beat.overrideDisplayDuration = ticks;
        }

        for (const noteSegment of notes) {
            const note = new Note();
            if (noteSegment.channel === 9) {
                note.percussionArticulation = noteSegment.key;
            } else {
                note.octave = (noteSegment.key / 12) | 0;
                note.tone = noteSegment.key % 12;
            }
            beat.addNote(note);
        }

        voice.addBeat(beat);
        return beat;
    }

    private _getTrackName(trackNames: MidiTrackName[], sourceTrack: number, channel: number, index: number): string {
        const trackName = trackNames.find(t => t.track === sourceTrack);
        if (trackName) {
            if (channel === 9) {
                return `${trackName.name} Drums`;
            }
            return trackName.name;
        }
        return channel === 9 ? 'Drums' : `Track ${index + 1}`;
    }

    private static _findProgramAt(
        programChanges: MidiProgramChange[],
        sourceTrack: number,
        channel: number,
        tick: number
    ): number {
        let program = 0;
        for (const change of programChanges) {
            if (change.track === sourceTrack && change.channel === channel && change.tick <= tick) {
                program = change.program;
            }
        }
        return program;
    }

    private static _findTimeSignatureAt(
        timeSignatureChanges: MidiTimeSignatureChange[],
        tick: number
    ): MidiTimeSignatureChange {
        let timeSignature = timeSignatureChanges[0];
        for (const change of timeSignatureChanges) {
            if (change.tick <= tick) {
                timeSignature = change;
            } else {
                break;
            }
        }
        return timeSignature;
    }

    private static _toBeatDuration(ticks: number): BeatDurationInfo {
        const candidates: BeatDurationInfo[] = [];
        const durations = [
            Duration.Whole,
            Duration.Half,
            Duration.Quarter,
            Duration.Eighth,
            Duration.Sixteenth,
            Duration.ThirtySecond,
            Duration.SixtyFourth,
            Duration.OneHundredTwentyEighth,
            Duration.TwoHundredFiftySixth
        ];
        for (const duration of durations) {
            const baseTicks = MidiUtils.toTicks(duration);
            candidates.push({ duration, dots: 0, ticks: baseTicks });
            candidates.push({ duration, dots: 1, ticks: MidiUtils.applyDot(baseTicks, false) });
            candidates.push({ duration, dots: 2, ticks: MidiUtils.applyDot(baseTicks, true) });
        }

        let best = candidates[0];
        let bestDistance = Math.abs(ticks - best.ticks);
        for (let i = 1; i < candidates.length; i++) {
            const candidate = candidates[i];
            const distance = Math.abs(ticks - candidate.ticks);
            if (distance < bestDistance) {
                best = candidate;
                bestDistance = distance;
            }
        }
        return best;
    }

    private static _readFourCc(data: IReadable): string {
        return String.fromCharCode(data.readByte(), data.readByte(), data.readByte(), data.readByte());
    }

    private static _readVariableInt(data: IReadable): number {
        let value = 0;
        let b = 0;
        do {
            b = data.readByte();
            value = (value << 7) | (b & 0x7f);
        } while ((b & 0x80) !== 0);
        return value;
    }

    private static _activeNoteKey(channel: number, key: number): string {
        return `${channel}:${key}`;
    }
}
