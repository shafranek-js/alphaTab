import type * as alphaTab from '@coderline/alphatab';
import { type Mountable, css, html, injectStyles, parseHtml } from '../util/Dom';
import { TrackItem } from './TrackItem';

injectStyles(
    'TrackList',
    css`
    .at-track-list {
        display: flex;
        flex-direction: column;
    }
`
);

export class TrackList implements Mountable {
    readonly root: HTMLElement;
    private items: TrackItem[] = [];
    private selection = new Map<number, alphaTab.model.Track>();
    private unsubScoreLoaded: () => void;
    private unsubRenderStarted: () => void;
    private unsubMidiLoaded: () => void;

    constructor(private api: alphaTab.AlphaTabApi) {
        this.root = parseHtml(html`<div class="at-track-list"></div>`);

        this.unsubScoreLoaded = api.scoreLoaded.on(score => this.rebuild(score));
        this.unsubRenderStarted = api.renderStarted.on(() => this.refreshActive());
        this.unsubMidiLoaded = api.midiLoaded.on(() => this.applyPlaybackStates());
    }

    private rebuild(score: alphaTab.model.Score): void {
        const key = `${score.title}::${score.artist}`;
        const savedSettingsStr = typeof localStorage !== 'undefined' ? localStorage.getItem('at-playground-track-settings') : null;
        let savedSettings: any = null;
        if (savedSettingsStr) {
            try {
                const allSettings = JSON.parse(savedSettingsStr);
                savedSettings = allSettings[key];
            } catch {}
        }

        let settingsChanged = false;
        if (savedSettings && savedSettings.tracks) {
            for (const savedTrack of savedSettings.tracks) {
                const track = score.tracks.find(t => t.index === savedTrack.index);
                if (track) {
                    track.playbackInfo.volume = savedTrack.volume;
                    if (savedTrack.balance !== undefined) {
                        track.playbackInfo.balance = savedTrack.balance;
                    }
                    track.playbackInfo.isMute = savedTrack.isMute === true;
                    track.playbackInfo.isSolo = savedTrack.isSolo === true;
                    track.playbackInfo.program = savedTrack.program;

                    // Synchronize beat automations for instrument and balance changes
                    for (const staff of track.staves) {
                        for (const bar of staff.bars) {
                            for (const voice of bar.voices) {
                                for (const beat of voice.beats) {
                                    for (const automation of beat.automations) {
                                        if (automation.type === 2) { // AutomationType.Instrument
                                            automation.value = savedTrack.program;
                                        } else if (automation.type === 3 && savedTrack.balance !== undefined) { // AutomationType.Balance
                                            automation.value = savedTrack.balance;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (savedTrack.transpositionPitch !== undefined) {
                        this.api.changeTrackTranspositionPitch([track], savedTrack.transpositionPitch);
                    }
                    if (savedTrack.transposeFull !== undefined) {
                        const pitches = this.api.settings.notation.transpositionPitches;
                        while (pitches.length < track.index + 1) {
                            pitches.push(0);
                        }
                        pitches[track.index] = savedTrack.transposeFull;
                        settingsChanged = true;
                    }
                    if (savedTrack.staves) {
                        for (const savedStaff of savedTrack.staves) {
                            const staff = track.staves.find(s => s.index === savedStaff.index);
                            if (staff) {
                                staff.showStandardNotation = savedStaff.showStandardNotation;
                                staff.showTablature = savedStaff.showTablature;
                                staff.showSlash = savedStaff.showSlash;
                                staff.showNumbered = savedStaff.showNumbered;
                            }
                        }
                    }
                }
            }
        }

        if (settingsChanged) {
            this.api.updateSettings();
        }

        if (savedSettings && savedSettings.tracks) {
            this.api.loadMidiForScore();
        }

        if (savedSettings && savedSettings.activeTracks && savedSettings.activeTracks.length > 0) {
            const activeTracks: alphaTab.model.Track[] = [];
            for (const idx of savedSettings.activeTracks) {
                const track = score.tracks.find(t => t.index === idx);
                if (track) {
                    activeTracks.push(track);
                }
            }
            if (activeTracks.length > 0) {
                (this.api as any)._tracks = activeTracks;
                (this.api as any)._trackIndexes = activeTracks.map(t => t.index);
                (this.api as any)._trackIndexLookup = new Set(activeTracks.map(t => t.index));
            }
        }

        for (const item of this.items) {
            item.dispose();
        }
        this.items = [];
        this.root.replaceChildren();
        this.selection.clear();

        for (const track of score.tracks) {
            const item = new TrackItem(this.api, track);
            this.items.push(item);
            this.root.appendChild(item.root);
        }
        this.refreshActive();
        this.applyPlaybackStates();
    }

    private refreshActive(): void {
        const active = new Set<number>();
        for (const t of this.api.tracks) {
            active.add(t.index);
        }
        for (const item of this.items) {
            item.setActive(active.has(item.track.index));
        }
    }

    private applyPlaybackStates(): void {
        if (!this.api.score) {
            return;
        }
        for (const track of this.api.score.tracks) {
            this.api.changeTrackMute([track], track.playbackInfo.isMute);
            this.api.changeTrackSolo([track], track.playbackInfo.isSolo);
        }
    }

    /** All TrackItem instances, in score order. */
    getItems(): readonly TrackItem[] {
        return this.items;
    }

    dispose(): void {
        this.unsubScoreLoaded();
        this.unsubRenderStarted();
        this.unsubMidiLoaded();
        for (const item of this.items) {
            item.dispose();
        }
        this.items = [];
        this.root.remove();
    }
}
