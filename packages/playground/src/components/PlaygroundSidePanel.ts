import * as alphaTab from '@coderline/alphatab';
import { SystemsLayoutMode } from '@coderline/alphatab/DisplaySettings';
import { type Mountable, css, html, injectStyles, mount, parseHtml } from '../util/Dom';
import { FontAwesomeIcons } from '../util/Icons';
import { applySuzukiNoteColors, type NoteColorScheme } from '../util/noteColoring';
import { exportGp7 } from './AudioExporter';
import { IconButton } from './primitives/IconButton';
import { TrackList } from './TrackList';

export type PlaygroundSidePanelMode = 'settings' | 'tracks' | null;

injectStyles(
    'PlaygroundSidePanel',
    css`
    .at-side-panel {
        position: absolute;
        top: 1rem;
        right: 1rem;
        bottom: calc(1rem + 40px);
        z-index: -1;
        width: 25vw;
        min-width: 320px;
        max-width: calc(100% - 2rem);
        display: flex;
        flex-direction: column;
        color: var(--at-text);
        background: var(--at-sidebar-bg);
        border: 1px solid var(--at-border);
        border-radius: 6px;
        box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.2),
                    0 4px 5px 0 rgba(0, 0, 0, 0.14),
                    0 1px 10px 0 rgba(0, 0, 0, 0.12);
        overflow-y: auto;
        overflow-x: visible;
        opacity: 0;
        pointer-events: none;
        transform: translateX(50px);
        transition: all 0.2s ease-in-out;
        font-size: 80%;
    }
    .at-side-panel.at-side-panel.open {
        z-index: 1001;
        opacity: 1;
        pointer-events: auto;
        transform: translateX(0) !important;
    }
    .at-side-panel > * {
        padding: 0.5rem;
    }
    .at-side-panel-title {
        margin: 0.2rem 0;
        padding-right: 2.5rem;
        font-size: 1rem;
        font-weight: 700;
    }
    .at-side-panel-close {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        z-index: 1;
        min-width: 2rem;
        min-height: 2rem;
        padding: 0.4rem 0.5rem;
        color: var(--at-text);
        background: transparent;
    }
    .at-side-panel-close:hover:not([disabled]) {
        background: rgba(128, 128, 128, 0.15);
    }
    .at-side-panel-content {
        flex: 1 1 auto;
        overflow: auto;
        min-height: 0;
        padding-top: 0;
    }
    .at-side-panel-section {
        padding: 0.5rem 0;
        border-bottom: 2px dashed var(--at-border);
    }
    .at-side-panel-section > h4 {
        margin: 0 0 8px;
        font-size: 14px;
    }
    .at-panel-view { display: none; }
    .at-panel-view.active { display: block; }
    .at-settings-row {
        display: grid;
        grid-template-columns: minmax(120px, 1fr) minmax(128px, auto);
        align-items: center;
        gap: 10px;
        margin: 8px 0;
        font-size: 13px;
    }
    .at-settings-row > label {
        cursor: pointer;
    }
    .at-settings-control {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
    }
    .at-settings-control > input[type='range'] {
        width: 128px;
    }
    .at-settings-control > input[type='number'],
    .at-settings-control > select {
        width: 128px;
        min-height: 32px;
        padding: 4px 8px;
        border: 1px solid var(--at-border);
        border-radius: 4px;
        background: var(--at-bg);
        color: var(--at-text);
        font: inherit;
    }
    .at-settings-control > output {
        min-width: 42px;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    .at-segmented {
        display: inline-flex;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid var(--at-accent);
    }
    .at-segmented > button {
        min-height: 32px;
        padding: 4px 10px;
        border: 0;
        border-right: 1px solid var(--at-accent);
        background: var(--at-bg);
        color: var(--at-accent);
        cursor: pointer;
        font: inherit;
    }
    .at-segmented > button:last-child {
        border-right: 0;
    }
    .at-segmented > button.active {
        background: var(--at-accent);
        color: #fff;
    }
    .at-panel-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .at-panel-action {
        min-height: 32px;
        padding: 4px 10px;
        border: 1px solid var(--at-accent);
        border-radius: 4px;
        background: var(--at-bg);
        color: var(--at-accent);
        cursor: pointer;
        font: inherit;
    }
    .at-panel-action:hover {
        background: rgba(128, 128, 128, 0.08);
    }
    .at-side-panel .at-track-list {
        padding: 4px 0;
    }
    .at-side-panel .at-track:nth-child(even) {
        background: var(--at-track-active-bg);
    }
    .at-side-panel .at-track {
        padding: 8px 10px;
    }

    @media screen and (max-width: 720px) {
        .at-side-panel {
            top: 8px;
            right: 8px;
            left: 8px;
            bottom: 112px;
            width: auto;
        }
        .at-settings-row {
            grid-template-columns: 1fr;
            gap: 4px;
        }
        .at-settings-control {
            justify-content: flex-start;
        }
    }
`
);

export class PlaygroundSidePanel implements Mountable {
    readonly root: HTMLElement;
    readonly trackList: TrackList;
    private titleEl: HTMLElement;
    private settingsView: HTMLElement;
    private tracksView: HTMLElement;
    private closeButton: IconButton;
    private currentMode: PlaygroundSidePanelMode = null;
    private noteColorScheme: NoteColorScheme = 'off';
    private subscriptions: (() => void)[] = [];
    private originalRender?: any;
    private originalRenderScore?: any;
    private originalRenderTracks?: any;

    onModeChange: ((mode: PlaygroundSidePanelMode) => void) | null = null;

    constructor(private api: alphaTab.AlphaTabApi) {
        this.root = parseHtml(html`
            <aside class="at-side-panel" aria-hidden="true">
                <div class="cmp-close"></div>
                <h4 class="at-side-panel-title"></h4>
                <div class="at-side-panel-content">
                    <div class="at-panel-view at-panel-settings"></div>
                    <div class="at-panel-view at-panel-tracks">
                        <div class="cmp-track-list"></div>
                    </div>
                </div>
            </aside>
        `);

        this.titleEl = this.root.querySelector('.at-side-panel-title')!;
        this.settingsView = this.root.querySelector('.at-panel-settings')!;
        this.tracksView = this.root.querySelector('.at-panel-tracks')!;
        this.closeButton = mount(
            this.root,
            '.cmp-close',
            new IconButton({ icon: FontAwesomeIcons.Close, tooltip: 'Close panel' })
        );
        this.closeButton.root.classList.add('at-side-panel-close');
        this.closeButton.onClick = () => this.setMode(null);
        this.trackList = mount(this.root, '.cmp-track-list', new TrackList(api));
        this.buildSettings();
        this.subscriptions.push(
            api.scoreLoaded.on(score => {
                applySuzukiNoteColors(score, this.noteColorScheme === 'suzuki');
                this.buildSettings();
            })
        );

        // Wrap rendering methods to ensure note colors are always applied synchronously
        // before serialization and rendering (especially important for worker-based renderers).
        this.originalRender = api.render;
        api.render = (renderHints?: alphaTab.RenderHints) => {
            if (api.score) {
                applySuzukiNoteColors(api.score, this.noteColorScheme === 'suzuki');
            }
            this.originalRender.call(api, renderHints);
        };

        this.originalRenderScore = api.renderScore;
        api.renderScore = (score: alphaTab.model.Score, trackIndexes?: number[], renderHints?: alphaTab.RenderHints) => {
            applySuzukiNoteColors(score, this.noteColorScheme === 'suzuki');
            this.originalRenderScore.call(api, score, trackIndexes, renderHints);
        };

        this.originalRenderTracks = api.renderTracks;
        api.renderTracks = (tracks: alphaTab.model.Track[], renderHints?: alphaTab.RenderHints) => {
            if (api.score) {
                applySuzukiNoteColors(api.score, this.noteColorScheme === 'suzuki');
            }
            this.originalRenderTracks.call(api, tracks, renderHints);
        };
    }

    setMode(mode: PlaygroundSidePanelMode): void {
        this.currentMode = mode;
        this.root.classList.toggle('open', mode !== null);
        this.root.setAttribute('aria-hidden', String(mode === null));
        this.root.style.zIndex = mode === null ? '-1' : '1001';
        this.root.style.opacity = mode === null ? '0' : '1';
        this.root.style.pointerEvents = mode === null ? 'none' : 'auto';
        this.root.style.transform = mode === null ? 'translateX(50px)' : 'translateX(0)';
        this.settingsView.classList.toggle('active', mode === 'settings');
        this.tracksView.classList.toggle('active', mode === 'tracks');
        this.titleEl.textContent = mode === 'settings' ? 'Settings' : mode === 'tracks' ? 'Tracks' : '';
        this.onModeChange?.(mode);
    }

    getMode(): PlaygroundSidePanelMode {
        return this.currentMode;
    }

    private buildSettings(): void {
        this.settingsView.replaceChildren(
            this.section('Display ▸ General', [
                this.themeRow(),
                this.engineRow(),
                this.rangeRow('Scale', 0.25, 2, 0.25, this.api.settings.display.scale, value => {
                    this.api.settings.display.scale = value;
                    this.render();
                }, value => `${Math.round(value * 100)}%`),
                this.rangeRow('Stretch', 0.25, 2, 0.25, this.api.settings.display.stretchForce, value => {
                    this.api.settings.display.stretchForce = value;
                    this.render();
                }, value => value.toFixed(2)),
                this.selectRow(
                    'Layout',
                    [
                        { value: String(alphaTab.LayoutMode.Page), label: 'Page' },
                        { value: String(alphaTab.LayoutMode.Horizontal), label: 'Horizontal' },
                        { value: String(alphaTab.LayoutMode.Parchment), label: 'Parchment' }
                    ],
                    String(this.api.settings.display.layoutMode),
                    value => {
                        this.api.settings.display.layoutMode = Number(value) as alphaTab.LayoutMode;
                        this.render();
                    }
                ),
                this.numberRow('Bars per System', this.api.settings.display.barsPerRow, value => {
                    this.api.settings.display.barsPerRow = value;
                    this.render();
                }),
                this.numberRow('Start Bar', this.api.settings.display.startBar, value => {
                    this.api.settings.display.startBar = Math.max(1, value);
                    this.render();
                }),
                this.numberRow('Bar Count', this.api.settings.display.barCount, value => {
                    this.api.settings.display.barCount = value;
                    this.render();
                }),
                this.toggleRow('Justify Last System', this.api.settings.display.justifyLastSystem, value => {
                    this.api.settings.display.justifyLastSystem = value;
                    this.render();
                }),
                this.selectRow(
                    'Systems Layout Mode',
                    [
                        { value: String(SystemsLayoutMode.Automatic), label: 'Automatic' },
                        { value: String(SystemsLayoutMode.UseModelLayout), label: 'Use Model Layout' }
                    ],
                    String(this.api.settings.display.systemsLayoutMode),
                    value => {
                        this.api.settings.display.systemsLayoutMode = Number(value) as SystemsLayoutMode;
                        this.render();
                    }
                )
            ]),
            this.section('Display ▸ Colors', [
                this.noteColorRow(),
                this.colorRow('Staff Line', 'display.resources.staffLineColor'),
                this.colorRow('Bar Separator', 'display.resources.barSeparatorColor'),
                this.colorRow('Bar Number', 'display.resources.barNumberColor'),
                this.colorRow('Main Glyphs', 'display.resources.mainGlyphColor'),
                this.colorRow('Secondary Glyphs', 'display.resources.secondaryGlyphColor'),
                this.colorRow('Score Info', 'display.resources.scoreInfoColor')
            ]),
            this.section('Display ▸ Fonts', [
                this.fontRow('Copyright', 'display.resources.copyrightFont'),
                this.fontRow('Title', 'display.resources.titleFont'),
                this.fontRow('Subtitle', 'display.resources.subTitleFont'),
                this.fontRow('Words', 'display.resources.wordsFont'),
                this.fontRow('Effects', 'display.resources.effectFont'),
                this.fontRow('Timer', 'display.resources.timerFont'),
                this.fontRow('Directions', 'display.resources.directionsFont'),
                this.fontRow('Fretboard Numbers', 'display.resources.fretboardNumberFont'),
                this.fontRow('Numbered Notation', 'display.resources.numberedNotationFont'),
                this.fontRow('Guitar Tabs', 'display.resources.tablatureFont'),
                this.fontRow('Grace Notes', 'display.resources.graceFont'),
                this.fontRow('Bar Numbers', 'display.resources.barNumberFont'),
                this.fontRow('Inline Fingering', 'display.resources.inlineFingeringFont'),
                this.fontRow('Markers', 'display.resources.markerFont')
            ]),
            this.section('Display ▸ Paddings', [
                this.paddingRow('Horizontal', 0),
                this.paddingRow('Vertical', 1),
                this.settingsNumberRow('First System Top', 'display.firstSystemPaddingTop', 0),
                this.settingsNumberRow('Other Systems Top', 'display.systemPaddingTop', 0),
                this.settingsNumberRow('Last System Bottom', 'display.lastSystemPaddingBottom', 0),
                this.settingsNumberRow('Other Systems Bottom', 'display.systemPaddingBottom', 0),
                this.settingsNumberRow('System Label Left', 'display.systemLabelPaddingLeft', 0),
                this.settingsNumberRow('System Label Right', 'display.systemLabelPaddingRight', 0),
                this.settingsNumberRow('Accolade Bar Right', 'display.accoladeBarPaddingRight', 0),
                this.settingsNumberRow('Notation Staff Top', 'display.notationStaffPaddingTop', 0),
                this.settingsNumberRow('Notation Staff Bottom', 'display.notationStaffPaddingBottom', 0),
                this.settingsNumberRow('Effect Staff Top', 'display.effectStaffPaddingTop', 0),
                this.settingsNumberRow('Effect Staff Bottom', 'display.effectStaffPaddingBottom', 0),
                this.settingsNumberRow('First Staff Left', 'display.firstStaffPaddingLeft', 0),
                this.settingsNumberRow('Other Staves Left', 'display.staffPaddingLeft', 0)
            ]),
            this.section('Notation', [
                this.enumRow('Fingering', 'notation.fingeringMode', alphaTab.FingeringMode),
                this.enumRow('Tab Rhythm Stems', 'notation.rhythmMode', alphaTab.TabRhythmMode),
                this.settingsNumberRow('Rhythm Height', 'notation.rhythmHeight', 1),
                this.settingsToggleRow('Small Grace Notes in Tabs', 'notation.smallGraceTabNotes'),
                this.settingsToggleRow('Extend Bend Arrows on Tied Notes', 'notation.extendBendArrowsOnTiedNotes'),
                this.settingsToggleRow('Extend Line Effects to Beat End', 'notation.extendLineEffectsToBeatEnd'),
                this.settingsNumberRow('Slur Height', 'notation.slurHeight', 1)
            ]),
            this.section('Player', [
                this.apiRangeRow('Volume', 'masterVolume', 0, 1, 0.1),
                this.apiRangeRow('Metronome Volume', 'metronomeVolume', 0, 1, 0.1),
                this.apiRangeRow('Count-In Volume', 'countInVolume', 0, 1, 0.1),
                this.apiRangeRow('Playback Speed', 'playbackSpeed', 0.1, 3, 0.1),
                this.apiToggleRow('Looping', 'isLooping'),
                this.enumRow('Player Mode', 'player.playerMode', alphaTab.PlayerMode, false),
                this.settingsToggleRow('Show Cursors', 'player.enableCursor', false),
                this.settingsToggleRow('Animated Beat Cursor', 'player.enableAnimatedBeatCursor', false),
                this.settingsToggleRow('Highlight Notes', 'player.enableElementHighlighting', false),
                this.settingsToggleRow('Enable User Interaction', 'player.enableUserInteraction', false),
                this.settingsNumberRow('Scroll Offset X', 'player.scrollOffsetX', undefined, false),
                this.settingsNumberRow('Scroll Offset Y', 'player.scrollOffsetY', undefined, false),
                this.enumRow('Scroll Mode', 'player.scrollMode', alphaTab.ScrollMode, false),
                this.settingsToggleRow('Play Swing', 'player.playTripletFeel', false, () => this.api.loadMidiForScore())
            ]),
            this.section('Stylesheet', [
                this.stylesheetToggleRow('Hide Dynamics', 'hideDynamics'),
                this.stylesheetEnumRow('Bracket Extend Mode', 'bracketExtendMode', alphaTab.model.BracketExtendMode),
                this.stylesheetToggleRow('System Sign Separator', 'useSystemSignSeparator'),
                this.stylesheetToggleRow('Show Guitar Tuning', 'globalDisplayTuning'),
                this.stylesheetToggleRow('Show Chord Diagrams', 'globalDisplayChordDiagramsOnTop'),
                this.stylesheetEnumRow('Single-Track Name Policy', 'singleTrackTrackNamePolicy', alphaTab.model.TrackNamePolicy),
                this.stylesheetEnumRow('Multi-Track Name Policy', 'multiTrackTrackNamePolicy', alphaTab.model.TrackNamePolicy),
                this.stylesheetEnumRow('First System Track Name Format', 'firstSystemTrackNameMode', alphaTab.model.TrackNameMode),
                this.stylesheetEnumRow('First System Track Name Orientation', 'firstSystemTrackNameOrientation', alphaTab.model.TrackNameOrientation),
                this.stylesheetEnumRow('Other Systems Track Name Format', 'otherSystemsTrackNameMode', alphaTab.model.TrackNameMode),
                this.stylesheetEnumRow('Other Systems Track Name Orientation', 'otherSystemsTrackNameOrientation', alphaTab.model.TrackNameOrientation),
                this.stylesheetToggleRow('Multi-Bar Rests', 'multiTrackMultiBarRest')
            ]),
            this.section('Export', [
                this.actionsRow([
                    { label: 'Export MIDI', action: () => this.api.downloadMidi() },
                    { label: 'Export Guitar Pro', action: () => exportGp7(this.api) },
                    { label: 'Print', action: () => this.api.print() }
                ])
            ])
        );
    }

    private section(title: string, children: HTMLElement[]): HTMLElement {
        const section = parseHtml(html`<section class="at-side-panel-section"><h4>${title}</h4></section>`);
        section.append(...children);
        return section;
    }

    private themeRow(): HTMLElement {
        const row = this.row('App Theme');
        const control = row.querySelector('.at-settings-control')!;
        const group = parseHtml(html`
            <div class="at-segmented" role="group" aria-label="App theme">
                <button type="button" data-theme="light">Light</button>
                <button type="button" data-theme="dark">Dark</button>
            </div>
        `);
        const currentTheme = document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light';
        for (const button of group.querySelectorAll<HTMLButtonElement>('button')) {
            button.classList.toggle('active', button.dataset.theme === currentTheme);
            button.addEventListener('click', () => {
                for (const b of group.querySelectorAll('button')) {
                    b.classList.toggle('active', b === button);
                }
                const isDark = button.dataset.theme === 'dark';
                document.documentElement.classList.toggle('dark-theme', isDark);

                // Update alphaTab rendering colors to match the theme
                this.applyThemeToScore(isDark);
                this.buildSettings(); // Rebuild panel settings to sync color pickers
            });
        }
        control.appendChild(group);
        return row;
    }

    private applyThemeToScore(isDark: boolean): void {
        const resources = this.api.settings.display.resources;
        if (isDark) {
            resources.staffLineColor = new alphaTab.model.Color(200, 200, 200, 100);
            resources.barSeparatorColor = new alphaTab.model.Color(200, 200, 200, 150);
            resources.barNumberColor = new alphaTab.model.Color(150, 150, 150, 255);
            resources.mainGlyphColor = new alphaTab.model.Color(240, 240, 240, 255);
            resources.secondaryGlyphColor = new alphaTab.model.Color(180, 180, 180, 255);
            resources.scoreInfoColor = new alphaTab.model.Color(240, 240, 240, 255);
        } else {
            // Restore default light colors
            resources.staffLineColor = new alphaTab.model.Color(0, 0, 0, 60);
            resources.barSeparatorColor = new alphaTab.model.Color(0, 0, 0, 128);
            resources.barNumberColor = new alphaTab.model.Color(0, 0, 0, 255);
            resources.mainGlyphColor = new alphaTab.model.Color(0, 0, 0, 255);
            resources.secondaryGlyphColor = new alphaTab.model.Color(0, 0, 0, 255);
            resources.scoreInfoColor = new alphaTab.model.Color(0, 0, 0, 255);
        }
        this.api.updateSettings();
        this.api.render();
    }

    private engineRow(): HTMLElement {
        const row = this.row('Render Engine');
        const control = row.querySelector('.at-settings-control')!;
        const group = parseHtml(html`
            <div class="at-segmented" role="group" aria-label="Render engine">
                <button type="button" data-engine="svg">SVG</button>
                <button type="button" data-engine="html5">HTML5</button>
            </div>
        `);
        const currentEngine = String(this.api.settings.core.engine ?? 'svg').toLowerCase();
        for (const button of group.querySelectorAll<HTMLButtonElement>('button')) {
            button.classList.toggle('active', button.dataset.engine === currentEngine);
            button.addEventListener('click', () => {
                for (const b of group.querySelectorAll('button')) {
                    b.classList.toggle('active', b === button);
                }
                this.api.settings.core.engine = button.dataset.engine!;
                this.render();
            });
        }
        control.appendChild(group);
        return row;
    }

    private rangeRow(
        label: string,
        min: number,
        max: number,
        step: number,
        initialValue: number,
        onChange: (value: number) => void,
        format: (value: number) => string
    ): HTMLElement {
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const input = parseHtml(html`
            <input type="range" min="${min}" max="${max}" step="${step}" value="${initialValue}" />
        `) as HTMLInputElement;
        const output = parseHtml(html`<output>${format(initialValue)}</output>`);
        input.addEventListener('input', () => {
            output.textContent = format(input.valueAsNumber);
            onChange(input.valueAsNumber);
        });
        control.append(input, output);
        return row;
    }

    private numberRow(label: string, initialValue: number, onChange: (value: number) => void): HTMLElement {
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const input = parseHtml(html`
            <input type="number" step="1" value="${initialValue}" />
        `) as HTMLInputElement;
        input.addEventListener('change', () => {
            onChange(input.valueAsNumber);
            input.value = String(input.valueAsNumber);
        });
        control.appendChild(input);
        return row;
    }

    private settingsNumberRow(
        label: string,
        path: string,
        min?: number,
        render = true,
        afterUpdate?: () => void
    ): HTMLElement {
        return this.numberRow(label, Number(this.getPath(this.api.settings, path) ?? 0), value => {
            this.setPath(this.api.settings, path, value);
            this.update(render);
            afterUpdate?.();
        });
    }

    private paddingRow(label: string, index: number): HTMLElement {
        return this.numberRow(label, this.api.settings.display.padding[index], value => {
            this.api.settings.display.padding[index] = value;
            this.render();
        });
    }

    private noteColorRow(): HTMLElement {
        return this.selectRow(
            'Color Notes',
            [
                { value: 'off', label: 'Off' },
                { value: 'suzuki', label: 'Suzuki Color Spectrum' }
            ],
            this.noteColorScheme,
            value => {
                this.noteColorScheme = value as NoteColorScheme;
                if (this.api.score) {
                    applySuzukiNoteColors(this.api.score, this.noteColorScheme === 'suzuki');
                    this.api.render();
                }
            }
        );
    }

    private colorRow(label: string, path: string): HTMLElement {
        const value = this.getPath(this.api.settings, path);
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const input = parseHtml(html`
            <input type="text" value="${value?.rgba ?? String(value ?? '')}" />
        `) as HTMLInputElement;
        input.addEventListener('change', () => {
            const parsed = this.parseColor(input.value);
            if (parsed) {
                this.setPath(this.api.settings, path, parsed);
                this.render();
            }
        });
        control.appendChild(input);
        return row;
    }

    private fontRow(label: string, path: string): HTMLElement {
        const font = this.getPath(this.api.settings, path);
        const initial = Array.isArray(font?.families) ? font.families.join(', ') : '';
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const input = parseHtml(html`<input type="text" value="${initial}" />`) as HTMLInputElement;
        input.addEventListener('change', () => {
            const target = this.getPath(this.api.settings, path);
            if (target?.families) {
                target.families = input.value.split(',').map(v => v.trim()).filter(Boolean);
                this.render();
            }
        });
        control.appendChild(input);
        return row;
    }

    private enumRow(
        label: string,
        path: string,
        enumType: Record<string | number, string | number>,
        render = true
    ): HTMLElement {
        return this.selectRow(label, this.enumItems(enumType), String(this.getPath(this.api.settings, path)), value => {
            this.setPath(this.api.settings, path, Number(value));
            this.update(render);
        });
    }

    private settingsToggleRow(label: string, path: string, render = true, afterUpdate?: () => void): HTMLElement {
        return this.toggleRow(label, Boolean(this.getPath(this.api.settings, path)), value => {
            this.setPath(this.api.settings, path, value);
            this.update(render);
            afterUpdate?.();
        });
    }

    private apiRangeRow(label: string, path: string, min: number, max: number, step: number): HTMLElement {
        return this.rangeRow(label, min, max, step, Number((this.api as any)[path] ?? 0), value => {
            (this.api as any)[path] = value;
        }, value => value.toFixed(1));
    }

    private apiToggleRow(label: string, path: string): HTMLElement {
        return this.toggleRow(label, Boolean((this.api as any)[path]), value => {
            (this.api as any)[path] = value;
        });
    }

    private stylesheetToggleRow(label: string, path: string): HTMLElement {
        if (!this.api.score) {
            return this.disabledRow(label);
        }
        return this.toggleRow(label, Boolean((this.api.score.stylesheet as any)[path]), value => {
            (this.api.score!.stylesheet as any)[path] = value;
            this.api.render();
        });
    }

    private stylesheetEnumRow(
        label: string,
        path: string,
        enumType: Record<string | number, string | number>
    ): HTMLElement {
        if (!this.api.score) {
            return this.disabledRow(label);
        }
        return this.selectRow(
            label,
            this.enumItems(enumType),
            String((this.api.score.stylesheet as any)[path]),
            value => {
                (this.api.score!.stylesheet as any)[path] = Number(value);
                this.api.render();
            }
        );
    }

    private disabledRow(label: string): HTMLElement {
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const input = parseHtml(html`<input type="text" value="Score not loaded" disabled />`);
        control.appendChild(input);
        return row;
    }

    private selectRow(
        label: string,
        items: { value: string; label: string }[],
        initialValue: string,
        onChange: (value: string) => void
    ): HTMLElement {
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const select = parseHtml(html`<select></select>`) as HTMLSelectElement;
        for (const item of items) {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            option.selected = item.value === initialValue;
            select.appendChild(option);
        }
        select.addEventListener('change', () => onChange(select.value));
        control.appendChild(select);
        return row;
    }

    private toggleRow(label: string, initialValue: boolean, onChange: (value: boolean) => void): HTMLElement {
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const input = parseHtml(html`<input type="checkbox" />`) as HTMLInputElement;
        input.checked = initialValue;
        input.addEventListener('change', () => onChange(input.checked));
        control.appendChild(input);
        return row;
    }

    private actionsRow(actions: { label: string; action: () => void }[]): HTMLElement {
        const row = parseHtml(html`<div class="at-panel-actions"></div>`);
        for (const item of actions) {
            const button = parseHtml(html`<button type="button" class="at-panel-action">${item.label}</button>`);
            button.addEventListener('click', item.action);
            row.appendChild(button);
        }
        return row;
    }

    private row(label: string): HTMLElement {
        return parseHtml(html`
            <div class="at-settings-row">
                <label>${label}</label>
                <div class="at-settings-control"></div>
            </div>
        `);
    }

    private render(): void {
        this.api.updateSettings();
        this.api.render();
    }

    private update(render: boolean): void {
        this.api.updateSettings();
        if (render) {
            this.api.render();
        }
    }

    private getPath(root: unknown, path: string): any {
        let current: any = root;
        for (const part of path.split('.')) {
            current = current?.[part];
        }
        return current;
    }

    private setPath(root: unknown, path: string, value: unknown): void {
        const parts = path.split('.');
        let current: any = root;
        for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }

    private enumItems(enumType: Record<string | number, string | number>): { value: string; label: string }[] {
        const items: { value: string; label: string }[] = [];
        for (const value of Object.values(enumType)) {
            if (typeof value === 'string') {
                const enumValue = enumType[value];
                if (typeof enumValue === 'number') {
                    items.push({ value: String(enumValue), label: value });
                }
            }
        }
        return items;
    }

    private parseColor(value: string): alphaTab.model.Color | null {
        const match = value.trim().match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/i);
        if (!match) {
            return null;
        }
        return new alphaTab.model.Color(
            Number(match[1]),
            Number(match[2]),
            Number(match[3]),
            match[4] ? Number(match[4]) * 255 : 255
        );
    }

    dispose(): void {
        for (const unsubscribe of this.subscriptions) {
            unsubscribe();
        }
        this.subscriptions = [];
        this.closeButton.dispose();
        this.trackList.dispose();
        this.root.remove();

        // Restore original render methods
        if (this.originalRender) {
            this.api.render = this.originalRender;
        }
        if (this.originalRenderScore) {
            this.api.renderScore = this.originalRenderScore;
        }
        if (this.originalRenderTracks) {
            this.api.renderTracks = this.originalRenderTracks;
        }
    }
}
