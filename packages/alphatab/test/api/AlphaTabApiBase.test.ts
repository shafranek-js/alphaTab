import { AlphaTabApiBase } from '@coderline/alphatab/AlphaTabApiBase';
import { describe, expect, it } from 'vitest';
import {
    EventEmitter,
    EventEmitterOfT,
    type IEventEmitter,
    type IEventEmitterOfT
} from '@coderline/alphatab/EventEmitter';
import type { MidiFile } from '@coderline/alphatab/midi/MidiFile';
import { ScoreLoader } from '@coderline/alphatab/importer/ScoreLoader';
import { Settings } from '@coderline/alphatab/Settings';
import { LogLevel } from '@coderline/alphatab/LogLevel';
import type { Score } from '@coderline/alphatab/model/Score';
import { PlayerMode } from '@coderline/alphatab/PlayerSettings';
import type { PlaybackRange } from '@coderline/alphatab/synth/PlaybackRange';
import { PlayerState } from '@coderline/alphatab/synth/PlayerState';
import type { ISynthOutput } from '@coderline/alphatab/synth/ISynthOutput';
import type {
    BackingTrackSyncPoint,
    IAlphaSynth
} from '@coderline/alphatab/synth/IAlphaSynth';
import type { MidiEventType } from '@coderline/alphatab/midi/MidiEvent';
import type { PlaybackRangeChangedEventArgs } from '@coderline/alphatab/synth/PlaybackRangeChangedEventArgs';
import type { PlayerStateChangedEventArgs } from '@coderline/alphatab/synth/PlayerStateChangedEventArgs';
import { PositionChangedEventArgs } from '@coderline/alphatab/synth/PositionChangedEventArgs';
import type { MidiEventsPlayedEventArgs } from '@coderline/alphatab/synth/MidiEventsPlayedEventArgs';
import { TestUiFacade } from 'test/visualTests/TestUiFacade';

/** @internal */
class TestPlayer implements IAlphaSynth {
    public isReady: boolean = true;
    public isReadyForPlayback: boolean = false;
    public state: PlayerState = PlayerState.Paused;
    public logLevel: LogLevel = LogLevel.None;
    public masterVolume: number = 1;
    public metronomeVolume: number = 0;
    public playbackSpeed: number = 1;
    public tickPosition: number = 0;
    public timePosition: number = 0;
    public loadedMidiInfo?: PositionChangedEventArgs;
    public currentPosition: PositionChangedEventArgs = new PositionChangedEventArgs(0, 0, 0, 0, false, 120, 120);
    public playbackRange: PlaybackRange | null = null;
    public isLooping: boolean = false;
    public countInVolume: number = 0;
    public silentScorePlayback: boolean = false;
    public midiEventsPlayedFilter: MidiEventType[] = [];
    public output!: ISynthOutput;
    public readonly volumeChanges: number[] = [];

    public destroy(): void {}
    public play(): boolean {
        return true;
    }
    public pause(): void {}
    public playPause(): void {}
    public stop(): void {}
    public playOneTimeMidiFile(_midi: MidiFile): void {}
    public playLiveNote(_channel: number, _noteKey: number, _velocity: number): void {}
    public stopLiveNote(_channel: number, _noteKey: number): void {}
    public loadSoundFont(_data: Uint8Array, _append: boolean): void {}
    public resetSoundFonts(): void {}
    public loadMidiFile(_midi: MidiFile): void {}
    public loadBackingTrack(_score: Score): void {}
    public updateSyncPoints(_syncPoints: BackingTrackSyncPoint[]): void {}
    public applyTranspositionPitches(_transpositionPitches: Map<number, number>): void {}
    public setChannelTranspositionPitch(_channel: number, _semitones: number): void {}
    public setChannelProgram(_channel: number, _program: number, _percussion: boolean): void {}
    public setChannelMute(_channel: number, _mute: boolean): void {}
    public resetChannelStates(): void {}
    public setChannelSolo(_channel: number, _solo: boolean): void {}
    public setChannelVolume(_channel: number, volume: number): void {
        this.volumeChanges.push(volume);
    }

    public readonly ready: IEventEmitter = new EventEmitter(() => this.isReady);
    public readonly readyForPlayback: IEventEmitter = new EventEmitter(() => this.isReadyForPlayback);
    public readonly finished: IEventEmitter = new EventEmitter();
    public readonly soundFontLoaded: IEventEmitter = new EventEmitter();
    public readonly soundFontLoadFailed: IEventEmitterOfT<Error> = new EventEmitterOfT<Error>();
    public readonly midiLoaded: IEventEmitterOfT<PositionChangedEventArgs> =
        new EventEmitterOfT<PositionChangedEventArgs>();
    public readonly midiLoadFailed: IEventEmitterOfT<Error> = new EventEmitterOfT<Error>();
    public readonly stateChanged: IEventEmitterOfT<PlayerStateChangedEventArgs> =
        new EventEmitterOfT<PlayerStateChangedEventArgs>();
    public readonly positionChanged: IEventEmitterOfT<PositionChangedEventArgs> =
        new EventEmitterOfT<PositionChangedEventArgs>();
    public readonly midiEventsPlayed: IEventEmitterOfT<MidiEventsPlayedEventArgs> =
        new EventEmitterOfT<MidiEventsPlayedEventArgs>();
    public readonly playbackRangeChanged: IEventEmitterOfT<PlaybackRangeChangedEventArgs> =
        new EventEmitterOfT<PlaybackRangeChangedEventArgs>();

    public triggerReadyForPlayback(): void {
        this.isReadyForPlayback = true;
        (this.readyForPlayback as EventEmitter).trigger();
    }
}

describe('AlphaTabApiBase', () => {
    it('does not apply track playback volume twice when the player becomes ready', async () => {
        const settings = new Settings();
        settings.player.playerMode = PlayerMode.EnabledSynthesizer;
        settings.core.engine = 'svg';
        const player = new TestPlayer();
        const facade = new TestUiFacade(player);
        facade.rootContainer.width = 1300;
        const api = new AlphaTabApiBase<unknown>(facade, settings);
        const score = ScoreLoader.loadAlphaTex('\\track "T1" { volume 8 } C4');

        const promise = new Promise<void>((resolve, reject) => {
            api.postRenderFinished.on(() => resolve());
            api.error.on(e => reject(e));
        });
        api.renderScore(score, [0]);

        await promise;
        player.triggerReadyForPlayback();

        expect(player.volumeChanges.length).toBe(0);
    });
});
