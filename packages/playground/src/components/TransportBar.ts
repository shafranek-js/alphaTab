import * as alphaTab from '@coderline/alphatab';
import { type Mountable, css, html, injectStyles, mount, parseHtml } from '../util/Dom';
import { FontAwesomeIcons, Icons, icon } from '../util/Icons';
import { loadScoreFile } from './DragDrop';
import type { PlaygroundSidePanelMode } from './PlaygroundSidePanel';
import { IconButton } from './primitives/IconButton';
import { LoadingProgress } from './primitives/LoadingProgress';

export type PlaygroundBottomPanelMode = 'media-sync' | 'practice' | null;

injectStyles(
    'TransportBar',
    css`
    .at-transport {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--at-footer-bg);
        color: var(--at-footer-fg);
        border-top: 0;
    }
    .at-transport-left,
    .at-transport-right {
        display: flex;
        align-items: center;
        min-width: 0;
    }
    .at-transport-center {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        flex: 1 1 auto;
        padding: 0 1rem;
    }
    .at-transport-center .at-control-item {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        white-space: nowrap;
    }
    .at-transport-center .at-control-item .at-icon {
        display: flex;
        align-items: center;
    }
    .at-transport-center .at-control-item .at-icon > svg {
        width: 1rem;
        height: 1rem;
        fill: currentColor;
    }
    .at-transport-center .at-control-item span:last-child {
        font-weight: 700;
        min-width: 2.2rem;
        text-align: right;
    }
    .at-transport-center .at-control-item input[type="range"] {
        width: 5rem;
        cursor: pointer;
        height: 4px;
        accent-color: #fff;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        outline: none;
        -webkit-appearance: none;
    }
    .at-transport-center .at-control-item input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
    }
    .at-transport-center .at-control-item input[type="range"]::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border: 0;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
    }
    .at-transport-left > *,
    .at-transport-right > * {
        margin-right: 4px;
    }
    .at-transport-left {
        flex: 1 1 auto;
    }
    .at-transport-right {
        flex: 0 0 auto;
    }
    .at-transport .at-icon-btn {
        min-height: 40px;
        height: auto;
        padding: 0.8rem;
        border-radius: 0;
        gap: 0.35rem;
        font-size: initial;
        font-weight: 700;
    }
    .at-transport .at-icon-btn .at-icon-btn-icon {
        line-height: 0;
    }
    .at-transport .at-icon-btn .at-icon-btn-icon > svg {
        width: 1rem;
        height: 1rem;
    }
    .at-transport.at-transport .at-icon-btn:hover:not([disabled]),
    .at-transport.at-transport .at-icon-btn.active,
    .at-transport.at-transport .at-icon-btn.at-active {
        background: var(--at-accent-hover) !important;
        color: #fff !important;
    }
    .at-transport-primary {
        color: #fff;
    }
    .at-song-details {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        max-width: min(32vw, 420px);
        line-height: 1;
        font-weight: 700;
    }
    .at-song-title,
    .at-song-artist {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .at-song-title {
        font-weight: 700;
    }
    .at-song-artist {
        color: inherit;
        font-size: inherit;
    }
    .at-song-separator {
        margin: 0 0.25rem;
    }
    .at-time-position {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .at-loading-slot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
    }
    .at-loading-slot.hidden {
        display: none;
    }
    .at-file-input {
        display: none;
    }

    @media screen and (max-width: 920px) {
        .at-transport {
            flex-wrap: wrap;
        }
        .at-transport-left,
        .at-transport-right {
            width: 100%;
        }
        .at-transport-right {
            justify-content: flex-end;
            border-top: 1px solid var(--at-divider);
        }
        .at-song-details {
            max-width: none;
            flex: 1 1 auto;
        }
    }
    @media screen and (max-width: 560px) {
        .at-transport .at-icon-btn {
            min-width: 40px;
            padding: 0.8rem;
        }
        .at-transport-right .at-icon-btn .at-icon-btn-label {
            display: none;
        }
        .at-time-position {
            padding: 0 8px;
            font-size: 12px;
        }
    }
`
);

export interface TransportBarOptions {
    sidePanelMode?: PlaygroundSidePanelMode;
    bottomPanelMode?: PlaygroundBottomPanelMode;
    onSidePanelModeChange?: (mode: PlaygroundSidePanelMode) => void;
    onBottomPanelModeChange?: (mode: PlaygroundBottomPanelMode) => void;
}

export class TransportBar implements Mountable {
    readonly root: HTMLElement;
    private playPause: IconButton;
    private mediaSync: IconButton;
    private practice: IconButton;
    private tracks: IconButton;
    private settings: IconButton;
    private looping: IconButton;
    private loadingProgress: LoadingProgress;
    private loadingSlot: HTMLElement;
    private titleEl: HTMLElement;
    private artistEl: HTMLElement;
    private timePositionEl: HTMLElement;
    private sidePanelMode: PlaygroundSidePanelMode;
    private bottomPanelMode: PlaygroundBottomPanelMode;
    private subscriptions: (() => void)[] = [];
    private previousTime = -1;

    constructor(
        api: alphaTab.AlphaTabApi,
        private options: TransportBarOptions = {}
    ) {
        this.sidePanelMode = options.sidePanelMode ?? null;
        this.bottomPanelMode = options.bottomPanelMode ?? null;
        this.root = parseHtml(html`
            <div class="at-transport">
                <div class="at-transport-left">
                    <div class="cmp-open-file"></div>
                    <input class="at-file-input" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.musicxml,.mxml,.xml,.capx" />
                    <div class="cmp-play-pause"></div>
                    <div class="at-loading-slot hidden">
                        <div class="cmp-loading"></div>
                    </div>
                    <div class="at-song-details">
                        <span class="at-song-title"></span>
                        <span class="at-song-separator">-</span>
                        <span class="at-song-artist"></span>
                    </div>
                    <div class="at-time-position">00:00 / 00:00</div>
                </div>

                <div class="at-transport-center">
                    <div class="at-control-item" title="Metronome Volume">
                        <span class="at-icon at-metronome-icon"></span>
                        <input class="at-metronome-volume" type="range" min="0" max="1" step="0.1" value="0" />
                        <span class="at-metronome-volume-value">0%</span>
                    </div>
                    <div class="at-control-item" title="Count-In Volume">
                        <span class="at-icon at-count-in-icon"></span>
                        <input class="at-count-in-volume" type="range" min="0" max="1" step="0.1" value="0" />
                        <span class="at-count-in-volume-value">0%</span>
                    </div>
                    <div class="at-control-item" title="Playback Speed">
                        <span class="at-icon at-speed-icon"></span>
                        <input class="at-playback-speed" type="range" min="0.1" max="3" step="0.1" value="1" />
                        <span class="at-playback-speed-value">1.0x</span>
                    </div>
                    <div class="cmp-looping"></div>
                </div>

                <div class="at-transport-right">
                    <div class="cmp-media-sync"></div>
                    <div class="cmp-practice"></div>
                    <div class="cmp-tracks"></div>
                    <div class="cmp-settings"></div>
                </div>
            </div>
        `);
        this.titleEl = this.root.querySelector('.at-song-title')!;
        this.artistEl = this.root.querySelector('.at-song-artist')!;
        this.timePositionEl = this.root.querySelector('.at-time-position')!;
        this.loadingSlot = this.root.querySelector('.at-loading-slot')!;

        this.root.querySelector('.at-metronome-icon')!.replaceChildren(icon(Icons.Metronome));
        this.root.querySelector('.at-count-in-icon')!.replaceChildren(icon(Icons.Volume));
        this.root.querySelector('.at-speed-icon')!.replaceChildren(icon(Icons.CountIn));

        const fileInput = this.root.querySelector<HTMLInputElement>('.at-file-input')!;
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (file) {
                loadScoreFile(api, file);
                fileInput.value = '';
            }
        });

        const openFile = mount(
            this.root,
            '.cmp-open-file',
            new IconButton({ icon: FontAwesomeIcons.OpenFile, tooltip: 'Open file', ariaLabel: 'Open file' })
        );
        openFile.onClick = () => fileInput.click();

        this.playPause = mount(
            this.root,
            '.cmp-play-pause',
            new IconButton({ icon: FontAwesomeIcons.Play, tooltip: 'Play/Pause', ariaLabel: 'Play/Pause' })
        );
        this.playPause.root.classList.add('at-transport-primary');
        this.playPause.setEnabled(false);
        this.playPause.onClick = () => api.playPause();

        this.loadingProgress = mount(this.loadingSlot, '.cmp-loading', new LoadingProgress());

        this.mediaSync = mount(
            this.root,
            '.cmp-media-sync',
            new IconButton({ icon: FontAwesomeIcons.MediaSync, label: 'Media Sync', tooltip: 'Media Sync' })
        );
        this.mediaSync.onClick = () => {
            const next = this.bottomPanelMode === 'media-sync' ? null : 'media-sync';
            this.setBottomPanelMode(next);
            this.options.onBottomPanelModeChange?.(next);
        };

        this.practice = mount(
            this.root,
            '.cmp-practice',
            new IconButton({ icon: Icons.TrackPiano, label: 'Practice', tooltip: 'Practice' })
        );
        this.practice.onClick = () => {
            const next = this.bottomPanelMode === 'practice' ? null : 'practice';
            this.setBottomPanelMode(next);
            this.options.onBottomPanelModeChange?.(next);
        };

        this.tracks = mount(
            this.root,
            '.cmp-tracks',
            new IconButton({ icon: FontAwesomeIcons.Tracks, label: 'Tracks', tooltip: 'Tracks' })
        );
        this.tracks.onClick = () => {
            const next = this.sidePanelMode === 'tracks' ? null : 'tracks';
            this.setSidePanelMode(next);
            this.options.onSidePanelModeChange?.(next);
        };

        this.settings = mount(
            this.root,
            '.cmp-settings',
            new IconButton({ icon: FontAwesomeIcons.Settings, label: 'Settings', tooltip: 'Settings' })
        );
        this.settings.onClick = () => {
            const next = this.sidePanelMode === 'settings' ? null : 'settings';
            this.setSidePanelMode(next);
            this.options.onSidePanelModeChange?.(next);
        };

        this.refreshActiveButtons();

        this.looping = mount(
            this.root,
            '.cmp-looping',
            new IconButton({ icon: Icons.Loop, tooltip: 'Looping', ariaLabel: 'Looping' })
        );
        this.looping.onClick = () => {
            const next = !api.isLooping;
            api.isLooping = next;
            this.looping.root.classList.toggle('active', next);
        };

        const metronomeInput = this.root.querySelector<HTMLInputElement>('.at-metronome-volume')!;
        metronomeInput.addEventListener('input', () => {
            const val = metronomeInput.valueAsNumber;
            api.metronomeVolume = val;
            const label = this.root.querySelector('.at-metronome-volume-value')!;
            label.textContent = `${(val * 100).toFixed(0)}%`;
        });

        const countInInput = this.root.querySelector<HTMLInputElement>('.at-count-in-volume')!;
        countInInput.addEventListener('input', () => {
            const val = countInInput.valueAsNumber;
            api.countInVolume = val;
            const label = this.root.querySelector('.at-count-in-volume-value')!;
            label.textContent = `${(val * 100).toFixed(0)}%`;
        });

        const speedInput = this.root.querySelector<HTMLInputElement>('.at-playback-speed')!;
        speedInput.addEventListener('input', () => {
            const val = speedInput.valueAsNumber;
            api.playbackSpeed = val;
            const label = this.root.querySelector('.at-playback-speed-value')!;
            label.textContent = `${val.toFixed(1)}x`;
        });

        this.subscriptions.push(
            api.scoreLoaded.on(() => this.syncControls(api))
        );
        this.subscriptions.push(
            api.playerPositionChanged.on(() => {
                this.syncControls(api);
            })
        );

        this.subscriptions.push(
            api.scoreLoaded.on(score => {
                this.titleEl.textContent = score.title || 'Untitled';
                this.artistEl.textContent = score.artist || score.album || '';
            })
        );
        this.subscriptions.push(
            api.playerStateChanged.on(args => {
                this.playPause.setIcon(
                    args.state === alphaTab.synth.PlayerState.Playing ? FontAwesomeIcons.Pause : FontAwesomeIcons.Play
                );
            })
        );
        this.subscriptions.push(
            api.playerPositionChanged.on(args => {
                const sec = (args.currentTime / 1000) | 0;
                if (sec === this.previousTime) {
                    return;
                }
                this.previousTime = sec;
                this.timePositionEl.textContent = `${formatDuration(args.currentTime)} / ${formatDuration(args.endTime)}`;
            })
        );
        this.subscriptions.push(
            api.soundFontLoad.on(args => {
                this.loadingSlot.classList.remove('hidden');
                this.loadingProgress.setValue(args.loaded / Math.max(1, args.total));
            })
        );
        this.subscriptions.push(
            api.soundFontLoaded.on(() => {
                this.loadingSlot.classList.add('hidden');
            })
        );
        this.subscriptions.push(
            api.playerReady.on(() => {
                this.playPause.setEnabled(true);
            })
        );
    }

    setSidePanelMode(mode: PlaygroundSidePanelMode): void {
        this.sidePanelMode = mode;
        this.refreshActiveButtons();
    }

    setBottomPanelMode(mode: PlaygroundBottomPanelMode): void {
        this.bottomPanelMode = mode;
        this.refreshActiveButtons();
    }

    private refreshActiveButtons(): void {
        this.setActiveButton(this.tracks, this.sidePanelMode === 'tracks');
        this.setActiveButton(this.settings, this.sidePanelMode === 'settings');
        this.setActiveButton(this.mediaSync, this.bottomPanelMode === 'media-sync');
        this.setActiveButton(this.practice, this.bottomPanelMode === 'practice');
    }

    private setActiveButton(button: IconButton, active: boolean): void {
        button.root.classList.toggle('at-active', active);
        button.root.classList.toggle('active', active);
        button.root.style.backgroundColor = active ? 'var(--at-accent-hover)' : '';
        button.root.style.color = active ? '#fff' : '';
    }

    private syncControls(api: alphaTab.AlphaTabApi): void {
        const metronomeVal = api.metronomeVolume;
        const countInVal = api.countInVolume;
        const speedVal = api.playbackSpeed;
        const loopVal = api.isLooping;

        const metronomeInput = this.root.querySelector<HTMLInputElement>('.at-metronome-volume');
        if (metronomeInput && metronomeInput.valueAsNumber !== metronomeVal) {
            metronomeInput.value = String(metronomeVal);
            const label = this.root.querySelector('.at-metronome-volume-value');
            if (label) label.textContent = `${(metronomeVal * 100).toFixed(0)}%`;
        }

        const countInInput = this.root.querySelector<HTMLInputElement>('.at-count-in-volume');
        if (countInInput && countInInput.valueAsNumber !== countInVal) {
            countInInput.value = String(countInVal);
            const label = this.root.querySelector('.at-count-in-volume-value');
            if (label) label.textContent = `${(countInVal * 100).toFixed(0)}%`;
        }

        const speedInput = this.root.querySelector<HTMLInputElement>('.at-playback-speed');
        if (speedInput && speedInput.valueAsNumber !== speedVal) {
            speedInput.value = String(speedVal);
            const label = this.root.querySelector('.at-playback-speed-value');
            if (label) label.textContent = `${speedVal.toFixed(1)}x`;
        }

        if (this.looping) {
            this.looping.root.classList.toggle('active', loopVal);
        }
    }

    dispose(): void {
        for (const u of this.subscriptions) {
            u();
        }
        this.subscriptions = [];
        this.root.remove();
    }
}

function formatDuration(milliseconds: number): string {
    let seconds = milliseconds / 1000;
    const minutes = (seconds / 60) | 0;
    seconds = (seconds - minutes * 60) | 0;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
