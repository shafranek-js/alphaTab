import * as alphaTab from '@coderline/alphatab';
import { type Mountable, css, html, injectStyles, mount, parseHtml } from '../util/Dom';
import { TimeSlider } from './TimeSlider';
import {
    type PlaygroundBottomPanelMode,
    TransportBar,
    type TransportBarOptions
} from './TransportBar';
import type { TrackList } from './TrackList';
import { FontAwesomeIcons, fontAwesomeIcon } from '../util/Icons';
import { Waveform } from './Waveform';
import { PracticePanel } from './practice/PracticePanel';

injectStyles(
    'Footer',
    css`
    .at-footer {
        flex: 0 0 auto;
        background: #fff;
        color: #1f2328;
    }
    .at-footer a { color: inherit; text-decoration: none; }
    .at-footer .at-progress-bar,
    .at-footer .at-progress-bar:hover {
        height: 4px;
        background: #d9d9d9;
    }
    .at-footer .at-progress-bar > .at-progress-bar-fill {
        background: #6ba5e4;
    }
    .at-footer-media-sync {
        display: none;
        height: 20vh;
        min-height: 118px;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
        background: #fff;
    }
    .at-footer-media-sync.open {
        display: flex;
        flex-direction: column;
    }
    .at-media-sync-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        zoom: 0.8;
        padding: 0.2rem;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        font-size: 13px;
    }
    .at-media-sync-toolbar-group,
    .at-media-sync-toolbar .button-group {
        display: flex;
        align-items: center;
        gap: 0;
    }
    .at-footer .button {
        min-height: 36px;
        padding: 0.45rem 0.8rem;
        border: 1px solid transparent;
        border-radius: 4px;
        color: #1c1e21;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.3rem;
        white-space: nowrap;
    }
    .at-media-sync-toolbar .button-group .button {
        border-radius: 0;
        margin-left: -1px;
    }
    .at-media-sync-toolbar .button-group .button:first-child {
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
        margin-left: 0;
    }
    .at-media-sync-toolbar .button-group .button:last-child {
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
    }
    .at-footer .button--primary {
        border-color: var(--at-accent);
        color: #fff;
        background: var(--at-accent);
    }
    .at-footer .button--secondary {
        border-color: #dadde1;
        color: #1c1e21;
        background: #ebedf0;
    }
    .at-footer .button--secondary:hover:not([disabled]) {
        background: #d9dce1;
    }
    .at-footer .button--outline {
        background: #fff;
    }
    .at-media-sync-toolbar .at-icon-only {
        width: 42px;
        padding-left: 0;
        padding-right: 0;
    }
    .at-footer .button[disabled] {
        opacity: 0.45;
        cursor: default;
    }
    .at-media-sync-toolbar .button > svg,
    .at-media-sync-modal-actions .button > svg {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
    }
    .at-media-sync-menu-wrap {
        position: relative;
    }
    .at-media-sync-menu {
        position: absolute;
        left: 0;
        top: calc(100% + 2px);
        z-index: 1200;
        min-width: 260px;
        display: none;
        padding: 4px 0;
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 4px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.14);
    }
    .at-media-sync-menu.open {
        display: block;
    }
    .at-media-sync-menu button {
        width: 100%;
        padding: 0.45rem 0.8rem;
        border: 0;
        background: transparent;
        color: #1c1e21;
        text-align: left;
        cursor: pointer;
        font: inherit;
    }
    .at-media-sync-menu button:hover {
        background: rgba(0, 0, 0, 0.06);
    }
    .at-media-sync-modal {
        position: absolute;
        inset: 0;
        z-index: 1300;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
    }
    .at-media-sync-modal.open {
        display: flex;
    }
    .at-media-sync-modal-body {
        width: min(420px, calc(100% - 2rem));
        max-height: 80vh;
        overflow: auto;
        padding: 1rem;
        background: #fff;
        border-radius: 6px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
    }
    .at-media-sync-modal-body label {
        display: block;
        font-weight: 700;
    }
    .at-media-sync-modal-body input {
        width: 100%;
        margin: 0.5rem 0 1rem;
        padding: 0.45rem 0.6rem;
        border: 1px solid #dadde1;
        border-radius: 4px;
        font: inherit;
    }
    .at-media-sync-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
    }
    .at-media-sync-body {
        flex: 1 1 auto;
        position: relative;
        padding: 12px;
        color: #5f6874;
        background:
            repeating-linear-gradient(
                90deg,
                rgba(0, 0, 0, 0.15) 0,
                rgba(0, 0, 0, 0.15) 1px,
                transparent 1px,
                transparent 48px
            ),
            repeating-linear-gradient(
                0deg,
                transparent 0,
                transparent 31px,
                rgba(73, 114, 161, 0.35) 32px,
                transparent 33px
            );
    }
    .at-media-sync-track {
        position: absolute;
        left: 12px;
        right: 12px;
        top: 50%;
        height: 2px;
        background: rgba(73, 114, 161, 0.35);
    }
    .at-media-sync-marker {
        position: absolute;
        top: calc(50% - 18px);
        width: 2px;
        height: 36px;
        background: var(--at-accent);
    }
    .at-media-sync-marker:nth-child(2) { left: 18%; }
    .at-media-sync-marker:nth-child(3) { left: 42%; }
    .at-media-sync-marker:nth-child(4) { left: 73%; }
`
);

export interface FooterOptions extends TransportBarOptions {
    trackList?: TrackList;
    showWaveform?: boolean;
    practiceOverlayHost?: HTMLElement;
}

export class Footer implements Mountable {
    readonly root: HTMLElement;
    readonly waveform: Waveform | null;
    readonly timeSlider: TimeSlider;
    readonly transport: TransportBar;
    readonly practicePanel: PracticePanel | null;
    private mediaSyncPanel: HTMLElement;
    private mediaMode: 'synth' | 'audio' | 'youtube' = 'synth';
    private zoom = 1;

    constructor(
        private api: alphaTab.AlphaTabApi,
        options: FooterOptions = {}
    ) {
        this.root = parseHtml(html`
            <div class="at-footer">
                <div class="at-footer-media-sync">
                    <div class="at-media-sync-modal">
                        <div class="at-media-sync-modal-body">
                            <label for="newYoutubeUrl">YouTube URL:</label>
                            <input id="newYoutubeUrl" type="text" />
                            <div class="at-media-sync-modal-actions">
                                <button type="button" class="button button--secondary button--outline at-youtube-cancel">Cancel</button>
                                <button type="button" class="button button--primary at-youtube-load">Load</button>
                            </div>
                        </div>
                    </div>
                    <div class="at-media-sync-toolbar">
                        <div class="at-media-sync-toolbar-group">
                            <div class="button-group">
                                <button type="button" class="button button--primary" data-icon="synth">Synthesizer</button>
                                <button type="button" class="button button--secondary" data-icon="audio">Audio Track</button>
                                <button type="button" class="button button--secondary" data-icon="youtube">Youtube Video</button>
                            </div>
                            <span class="at-media-sync-menu-wrap">
                                <button type="button" class="button button--secondary at-icon-only" data-icon="pin" aria-label="Sync point actions"></button>
                                <span class="at-media-sync-menu">
                                    <button type="button" data-sync-action="reset">Reset Sync Points</button>
                                    <button type="button" data-sync-action="auto">Automatic Sync with Tempo Changes and Audio</button>
                                </span>
                            </span>
                            <button type="button" class="button button--secondary at-icon-only" data-icon="zoom-out" aria-label="Zoom Out"></button>
                            <button type="button" class="button button--secondary button--outline" data-zoom-label="true">100.0%</button>
                            <button type="button" class="button button--secondary at-icon-only" data-icon="zoom-in" aria-label="Zoom In"></button>
                            <button type="button" class="button button--secondary at-icon-only" data-icon="undo" aria-label="Undo" disabled></button>
                            <button type="button" class="button button--secondary at-icon-only" data-icon="redo" aria-label="Redo" disabled></button>
                        </div>
                        <div class="at-media-sync-toolbar-group"></div>
                    </div>
                    <div class="at-media-sync-body">
                        <div class="at-media-sync-track"></div>
                        <div class="at-media-sync-marker"></div>
                        <div class="at-media-sync-marker"></div>
                        <div class="at-media-sync-marker"></div>
                    </div>
                </div>
                <div class="cmp-practice-panel"></div>
                <div class="cmp-waveform"></div>
                <div class="cmp-time-slider"></div>
                <div class="cmp-transport"></div>
            </div>
        `);
        this.mediaSyncPanel = this.root.querySelector('.at-footer-media-sync')!;
        this.setupMediaSyncToolbar();
        if (options.practiceOverlayHost) {
            this.practicePanel = mount(
                this.root,
                '.cmp-practice-panel',
                new PracticePanel(api, options.practiceOverlayHost)
            );
        } else {
            this.root.querySelector('.cmp-practice-panel')!.remove();
            this.practicePanel = null;
        }
        if (options.showWaveform ?? true) {
            this.waveform = mount(this.root, '.cmp-waveform', new Waveform(api));
        } else {
            this.root.querySelector('.cmp-waveform')!.remove();
            this.waveform = null;
        }
        this.timeSlider = mount(this.root, '.cmp-time-slider', new TimeSlider(api));
        this.transport = mount(
            this.root,
            '.cmp-transport',
            new TransportBar(api, {
                ...options,
                onBottomPanelModeChange: mode => {
                    this.setBottomPanelMode(mode);
                    options.onBottomPanelModeChange?.(mode);
                }
            })
        );
        this.setBottomPanelMode(options.bottomPanelMode ?? null);
    }

    setBottomPanelMode(mode: PlaygroundBottomPanelMode): void {
        this.mediaSyncPanel.classList.toggle('open', mode === 'media-sync');
        this.practicePanel?.setOpen(mode === 'practice');
        this.transport.setBottomPanelMode(mode);
    }

    dispose(): void {
        document.removeEventListener('click', this.closeMediaMenu);
        this.waveform?.dispose();
        this.practicePanel?.dispose();
        this.timeSlider.dispose();
        this.transport.dispose();
        this.root.remove();
    }

    private setupMediaSyncToolbar(): void {
        const icons = new Map<string, (typeof FontAwesomeIcons)[keyof typeof FontAwesomeIcons]>([
            ['synth', FontAwesomeIcons.Synthesizer],
            ['audio', FontAwesomeIcons.AudioTrack],
            ['youtube', FontAwesomeIcons.YoutubeVideo],
            ['pin', FontAwesomeIcons.MapPin],
            ['zoom-out', FontAwesomeIcons.ZoomOut],
            ['zoom-in', FontAwesomeIcons.ZoomIn],
            ['undo', FontAwesomeIcons.Undo],
            ['redo', FontAwesomeIcons.Redo]
        ]);
        for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-icon]')) {
            const icon = icons.get(button.dataset.icon ?? '');
            if (icon) {
                button.prepend(fontAwesomeIcon(icon));
            }
        }

        this.root.querySelector<HTMLButtonElement>('[data-icon="synth"]')!.addEventListener('click', () => {
            this.setMediaMode('synth');
        });
        this.root.querySelector<HTMLButtonElement>('[data-icon="audio"]')!.addEventListener('click', () => {
            this.loadAudioTrack();
        });
        this.root.querySelector<HTMLButtonElement>('[data-icon="youtube"]')!.addEventListener('click', () => {
            this.root.querySelector('.at-media-sync-modal')!.classList.add('open');
        });
        this.root.querySelector<HTMLButtonElement>('[data-icon="pin"]')!.addEventListener('click', e => {
            e.stopPropagation();
            this.root.querySelector('.at-media-sync-menu')!.classList.toggle('open');
        });
        this.root.querySelector<HTMLButtonElement>('[data-icon="zoom-out"]')!.addEventListener('click', () => {
            this.setZoom(this.zoom / 1.2);
        });
        this.root.querySelector<HTMLButtonElement>('[data-icon="zoom-in"]')!.addEventListener('click', () => {
            this.setZoom(this.zoom * 1.2);
        });
        this.root.querySelector<HTMLButtonElement>('[data-zoom-label]')!.addEventListener('click', () => {
            this.setZoom(1);
        });
        this.root.querySelector<HTMLButtonElement>('.at-youtube-cancel')!.addEventListener('click', () => {
            this.root.querySelector('.at-media-sync-modal')!.classList.remove('open');
        });
        this.root.querySelector<HTMLButtonElement>('.at-youtube-load')!.addEventListener('click', () => {
            this.setMediaMode('youtube');
            this.root.querySelector('.at-media-sync-modal')!.classList.remove('open');
        });
        for (const item of this.root.querySelectorAll<HTMLButtonElement>('[data-sync-action]')) {
            item.addEventListener('click', () => {
                this.root.querySelector('.at-media-sync-menu')!.classList.remove('open');
                this.flashSyncMarkers();
            });
        }
        document.addEventListener('click', this.closeMediaMenu);
    }

    private closeMediaMenu = (e: MouseEvent): void => {
        if (!this.root.contains(e.target as Node)) {
            return;
        }
        if (!(e.target as HTMLElement).closest('.at-media-sync-menu-wrap')) {
            this.root.querySelector('.at-media-sync-menu')?.classList.remove('open');
        }
    };

    private setMediaMode(mode: 'synth' | 'audio' | 'youtube'): void {
        if (this.mediaMode === mode) {
            return;
        }
        this.mediaMode = mode;
        for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-icon="synth"], [data-icon="audio"], [data-icon="youtube"]')) {
            const active = button.dataset.icon === mode;
            button.classList.toggle('button--primary', active);
            button.classList.toggle('button--secondary', !active);
        }
        try {
            switch (mode) {
                case 'synth':
                    this.api.settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
                    break;
                case 'audio':
                    this.api.settings.player.playerMode = alphaTab.PlayerMode.EnabledBackingTrack;
                    break;
                case 'youtube':
                    this.api.settings.player.playerMode = alphaTab.PlayerMode.EnabledExternalMedia;
                    break;
            }
            this.api.updateSettings();
        } catch (e) {
            console.warn('Media Sync mode switch failed', e);
        }
    }

    private loadAudioTrack(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mp3,.ogg,.wav,.flac,.aac,.mp4,.mkv,.avi,.webm';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file || !this.api.score) {
                return;
            }
            const reader = new FileReader();
            reader.onload = e => {
                this.api.score!.backingTrack = new alphaTab.model.BackingTrack();
                this.api.score!.backingTrack.rawAudioFile = new Uint8Array(e.target!.result as ArrayBuffer);
                this.setMediaMode('audio');
            };
            reader.readAsArrayBuffer(file);
        };
        input.click();
    }

    private setZoom(value: number): void {
        this.zoom = Math.max(0.1, Math.min(8, value));
        const label = this.root.querySelector<HTMLButtonElement>('[data-zoom-label]')!;
        label.textContent = `${(this.zoom * 100).toFixed(1)}%`;
        const body = this.root.querySelector<HTMLElement>('.at-media-sync-body')!;
        body.style.backgroundSize = `${48 * this.zoom}px auto`;
    }

    private flashSyncMarkers(): void {
        for (const marker of this.root.querySelectorAll<HTMLElement>('.at-media-sync-marker')) {
            marker.animate([{ backgroundColor: '#4972a1' }, { backgroundColor: '#c80000' }, { backgroundColor: '#4972a1' }], {
                duration: 350,
                iterations: 1
            });
        }
    }
}
