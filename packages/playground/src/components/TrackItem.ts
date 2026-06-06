import type * as alphaTab from '@coderline/alphatab';
import { type Mountable, css, html, injectStyles, parseHtml } from '../util/Dom';
import { FontAwesomeIcons, fontAwesomeIcon } from '../util/Icons';

injectStyles(
    'TrackItem',
    css`
    .track-item {
        padding: 0.5rem;
    }
    .track-item > .settings-item:not(.track-item-info) {
        padding-left: 0.5rem;
    }
    .track-item-info > .settings-item-label {
        font-weight: 700;
    }
    .settings-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.2rem;
    }
    .settings-item-label {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        cursor: pointer;
        font-size: 90%;
    }
    .settings-item-label label,
    .settings-item-label input {
        cursor: pointer;
    }
    .settings-item-control {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    .settings-item-control input[type='range'] {
        width: 8rem;
    }
    .settings-item-control.button-group {
        gap: 0;
    }
    .settings-item-control.button-group > *:not(:first-child):not(:last-child) {
        border-radius: 0;
    }
    .settings-item-control.button-group > *:not(:last-child) {
        border-right: 1px solid rgba(255, 255, 255, 0.5);
    }
    .settings-item-control.button-group > *:first-child {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }
    .settings-item-control.button-group > *:last-child {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }
    .track-item .button,
    .track-button {
        min-width: 1.8rem;
        min-height: 1.7rem;
        padding: 0.2rem 0.4rem;
        border: 1px solid #dadde1;
        border-radius: 4px;
        background: #fff;
        color: #1c1e21;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .track-item .button--sm {
        min-width: 1.5rem;
        min-height: 1.5rem;
        font-size: 0.875rem;
    }
    .track-item .icon-button {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
    }
    .track-item .button--primary {
        background: var(--at-accent);
        border-color: var(--at-accent);
        color: #fff;
    }
    .track-item .button--secondary {
        background: #ebedf0;
        border-color: #dadde1;
        color: #1c1e21;
    }
    .track-item .button--outline {
        background: #fff;
    }
    .track-item .button[disabled] {
        opacity: 0.45;
        cursor: default;
    }
    .track-button > svg {
        width: 0.9rem;
        height: 0.9rem;
    }
    .track-button.success.active {
        background: #198754;
        border-color: #198754;
        color: #fff;
    }
    .track-button.danger.active {
        background: #dc3545;
        border-color: #dc3545;
        color: #fff;
    }
`
);

type StaffOption = 'showStandardNotation' | 'showTablature' | 'showSlash' | 'showNumbered';

export class TrackItem implements Mountable {
    readonly root: HTMLElement;
    readonly track: alphaTab.model.Track;

    private selected: HTMLInputElement;
    private muteBtn: HTMLButtonElement;
    private soloBtn: HTMLButtonElement;
    private volume: HTMLInputElement;
    private transposeFull: HTMLInputElement;
    private transposeAudio: HTMLInputElement;

    constructor(
        private api: alphaTab.AlphaTabApi,
        track: alphaTab.model.Track
    ) {
        this.track = track;
        this.root = parseHtml(html`
            <div class="track-item">
                <div class="settings-item track-item-info">
                    <div class="settings-item-label">
                        <input type="checkbox" id="t-${track.index}" />
                        <label for="t-${track.index}">${track.name}</label>
                    </div>
                    <div class="settings-item-control">
                        <button type="button" class="track-button success" title="Solo" aria-label="Solo"></button>
                        <button type="button" class="track-button danger" title="Mute" aria-label="Mute"></button>
                    </div>
                </div>
                <div class="settings-item">
                    <div class="settings-item-label">Volume</div>
                    <div class="settings-item-control">
                        <input class="track-volume" type="range" min="0" max="16" value="${track.playbackInfo.volume}" />
                    </div>
                </div>
                <div class="settings-item">
                    <div class="settings-item-label" title="Fully transposes the track (audio and notation)">Transpose Full</div>
                    <div class="settings-item-control">
                        <input class="track-transpose-full" type="range" min="-12" max="12" step="1" value="0" />
                    </div>
                </div>
                <div class="settings-item">
                    <div class="settings-item-label" title="Transposes the audio playback of the track">Transpose Audio</div>
                    <div class="settings-item-control">
                        <input class="track-transpose-audio" type="range" min="-12" max="12" step="1" value="0" />
                    </div>
                </div>
                <div class="track-staves"></div>
            </div>
        `);

        this.selected = this.root.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        this.soloBtn = this.root.querySelector<HTMLButtonElement>('.track-button.success')!;
        this.muteBtn = this.root.querySelector<HTMLButtonElement>('.track-button.danger')!;
        this.volume = this.root.querySelector<HTMLInputElement>('.track-volume')!;
        this.transposeFull = this.root.querySelector<HTMLInputElement>('.track-transpose-full')!;
        this.transposeAudio = this.root.querySelector<HTMLInputElement>('.track-transpose-audio')!;

        this.soloBtn.appendChild(fontAwesomeIcon(FontAwesomeIcons.Solo));
        this.muteBtn.appendChild(fontAwesomeIcon(FontAwesomeIcons.Mute));
        this.soloBtn.classList.toggle('active', track.playbackInfo.isSolo);
        this.muteBtn.classList.toggle('active', track.playbackInfo.isMute);

        this.selected.addEventListener('change', () => this.onTrackSelect(this.selected.checked));
        this.soloBtn.addEventListener('click', e => {
            e.stopPropagation();
            const active = !this.soloBtn.classList.contains('active');
            this.soloBtn.classList.toggle('active', active);
            this.track.playbackInfo.isSolo = active;
            this.api.changeTrackSolo([this.track], active);
        });
        this.muteBtn.addEventListener('click', e => {
            e.stopPropagation();
            const active = !this.muteBtn.classList.contains('active');
            this.muteBtn.classList.toggle('active', active);
            this.track.playbackInfo.isMute = active;
            this.api.changeTrackMute([this.track], active);
        });
        this.volume.addEventListener('input', e => {
            e.stopPropagation();
            this.api.changeTrackVolume([this.track], this.volume.valueAsNumber / Math.max(1, this.track.playbackInfo.volume));
        });
        this.transposeAudio.addEventListener('input', e => {
            e.stopPropagation();
            this.api.changeTrackTranspositionPitch([this.track], this.transposeAudio.valueAsNumber);
        });
        this.transposeFull.addEventListener('input', e => {
            e.stopPropagation();
            const pitches = this.api.settings.notation.transpositionPitches;
            while (pitches.length < this.track.index + 1) {
                pitches.push(0);
            }
            pitches[this.track.index] = this.transposeFull.valueAsNumber;
            this.api.updateSettings();
            this.api.render();
        });

        this.buildStaves();
    }

    setActive(active: boolean): void {
        this.selected.checked = active;
    }

    isMuted(): boolean {
        return this.muteBtn.classList.contains('active');
    }

    isSoloed(): boolean {
        return this.soloBtn.classList.contains('active');
    }

    getVolume(): number {
        return this.volume.valueAsNumber;
    }

    dispose(): void {
        this.root.remove();
    }

    private onTrackSelect(selected: boolean): void {
        let tracks: alphaTab.model.Track[];
        if (selected) {
            tracks = this.api.tracks.includes(this.track) ? [...this.api.tracks] : [...this.api.tracks, this.track];
        } else {
            tracks = this.api.tracks.filter(t => t !== this.track);
            if (tracks.length === 0) {
                this.selected.checked = true;
                return;
            }
        }
        tracks.sort((a, b) => a.index - b.index);
        this.api.renderTracks(tracks);
    }

    private buildStaves(): void {
        const staves = this.root.querySelector('.track-staves')!;
        for (const staff of this.track.staves) {
            staves.appendChild(this.buildStaff(staff));
        }
    }

    private buildStaff(staff: alphaTab.model.Staff): HTMLElement {
        const root = parseHtml(html`
                <div class="settings-item">
                <div class="settings-item-label">Staff ${staff.index + 1}</div>
                <div class="settings-item-control button-group">
                    <button type="button" class="button icon-button button--sm staff-button" data-option="showStandardNotation" title="Standard Notation">&#119135;</button>
                    <button type="button" class="button icon-button button--sm staff-button" data-option="showTablature" title="Guitar Tabs">5&#10548;</button>
                    <button type="button" class="button icon-button button--sm staff-button" data-option="showSlash" title="Slash Notation">&#119053;</button>
                    <button type="button" class="button icon-button button--sm staff-button" data-option="showNumbered" title="Numbered Notation">&#818;2&#818;</button>
                </div>
            </div>
        `);
        for (const button of root.querySelectorAll<HTMLButtonElement>('.staff-button')) {
            const option = button.dataset.option as StaffOption;
            this.setStaffButtonState(button, Boolean(staff[option]));
            if (staff.isPercussion && (option === 'showStandardNotation' || option === 'showTablature')) {
                button.disabled = true;
            }
            button.addEventListener('click', e => {
                e.stopPropagation();
                if (button.disabled) {
                    return;
                }
                const activeOptions = ['showStandardNotation', 'showTablature', 'showSlash', 'showNumbered']
                    .filter(o => o !== option)
                    .some(o => Boolean(staff[o as StaffOption]));
                if (staff[option] && !activeOptions) {
                    return;
                }
                staff[option] = !staff[option];
                this.setStaffButtonState(button, Boolean(staff[option]));
                this.api.render();
            });
        }
        return root;
    }

    private setStaffButtonState(button: HTMLButtonElement, active: boolean): void {
        button.classList.toggle('active', active);
        button.classList.toggle('button--primary', active);
        button.classList.toggle('button--secondary', !active);
        button.classList.toggle('button--outline', !active);
    }
}
