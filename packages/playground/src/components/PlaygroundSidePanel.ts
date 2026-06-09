import * as alphaTab from '@coderline/alphatab';
import { SystemsLayoutMode } from '@coderline/alphatab/DisplaySettings';
import { css, html, injectStyles, type Mountable, mount, parseHtml } from '../util/Dom';
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
    .at-settings-control > input[type='color'] {
        width: 128px;
        min-height: 32px;
        height: 32px;
        padding: 2px;
        border: 1px solid var(--at-border);
        border-radius: 4px;
        background: var(--at-bg);
        cursor: pointer;
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
    private barCursorColor: string = '#ffff00';
    private barCursorOpacity: number = 0.25;
    private barCursorPosition: 'above' | 'below' = 'above';
    private cursorStyleEl?: HTMLStyleElement;
    private lightThemeBgColor: string = '#ffffff';
    private darkThemeBgColor: string = '#0f172a';

    onModeChange: ((mode: PlaygroundSidePanelMode) => void) | null = null;

    constructor(private api: alphaTab.AlphaTabApi) {
        this.loadSavedSettings();

        if (!localStorage.getItem('at-playground-settings')) {
            this.barCursorColor = localStorage.getItem('at-playground-bar-cursor-color') ?? '#ffff00';
            this.barCursorOpacity = Number(localStorage.getItem('at-playground-bar-cursor-opacity') ?? '0.25');
            this.barCursorPosition =
                (localStorage.getItem('at-playground-bar-cursor-position') as 'above' | 'below') ?? 'above';
        }

        const savedTheme = this.getSavedCustomSetting('theme');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark-theme');
        } else if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark-theme');
        }
        this.applyBackgroundColors();

        this.updateCursorStyles(this.barCursorColor, this.barCursorOpacity, this.barCursorPosition);
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
        this.saveAllSettings();
        this.subscriptions.push(
            api.scoreLoaded.on(score => {
                this.applySavedStylesheetSettings(score);
                applySuzukiNoteColors(score, this.noteColorScheme === 'suzuki');
                this.buildSettings();
                this.saveAllSettings();
            })
        );

        // Wrap rendering methods to ensure note colors are always applied synchronously
        // before serialization and rendering (especially important for worker-based renderers).
        this.originalRender = api.render;
        api.render = (renderHints?: alphaTab.rendering.RenderHints) => {
            if (api.score) {
                applySuzukiNoteColors(api.score, this.noteColorScheme === 'suzuki');
            }
            this.originalRender.call(api, renderHints);
        };

        this.originalRenderScore = api.renderScore;
        api.renderScore = (
            score: alphaTab.model.Score,
            trackIndexes?: number[],
            renderHints?: alphaTab.rendering.RenderHints
        ) => {
            applySuzukiNoteColors(score, this.noteColorScheme === 'suzuki');
            this.originalRenderScore.call(api, score, trackIndexes, renderHints);
        };

        this.originalRenderTracks = api.renderTracks;
        api.renderTracks = (tracks: alphaTab.model.Track[], renderHints?: alphaTab.rendering.RenderHints) => {
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
                this.rangeRow(
                    'Scale',
                    0.25,
                    2,
                    0.25,
                    this.api.settings.display.scale,
                    value => {
                        this.api.settings.display.scale = value;
                        this.saveUserSetting('settings', 'display.scale', value);
                        this.render();
                    },
                    value => `${Math.round(value * 100)}%`
                ),
                this.rangeRow(
                    'Stretch',
                    0.25,
                    2,
                    0.25,
                    this.api.settings.display.stretchForce,
                    value => {
                        this.api.settings.display.stretchForce = value;
                        this.saveUserSetting('settings', 'display.stretchForce', value);
                        this.render();
                    },
                    value => value.toFixed(2)
                ),
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
                        this.saveUserSetting('settings', 'display.layoutMode', Number(value));
                        this.render();
                    }
                ),
                this.numberRow('Bars per System', this.api.settings.display.barsPerRow, value => {
                    this.api.settings.display.barsPerRow = value;
                    this.saveUserSetting('settings', 'display.barsPerRow', value);
                    this.render();
                }),
                this.numberRow('Start Bar', this.api.settings.display.startBar, value => {
                    const val = Math.max(1, value);
                    this.api.settings.display.startBar = val;
                    this.saveUserSetting('settings', 'display.startBar', val);
                    this.render();
                }),
                this.numberRow('Bar Count', this.api.settings.display.barCount, value => {
                    this.api.settings.display.barCount = value;
                    this.saveUserSetting('settings', 'display.barCount', value);
                    this.render();
                }),
                this.toggleRow('Justify Last System', this.api.settings.display.justifyLastSystem, value => {
                    this.api.settings.display.justifyLastSystem = value;
                    this.saveUserSetting('settings', 'display.justifyLastSystem', value);
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
                        this.saveUserSetting('settings', 'display.systemsLayoutMode', Number(value));
                        this.render();
                    }
                )
            ]),
            this.section('Display ▸ Colors', [
                this.noteColorRow(),
                this.barCursorColorRow(),
                this.backgroundColorRow('Light Theme Background', 'light'),
                this.backgroundColorRow('Dark Theme Background', 'dark'),
                this.rangeRow(
                    'Bar Cursor Opacity',
                    0,
                    1,
                    0.05,
                    this.barCursorOpacity,
                    value => {
                        this.barCursorOpacity = value;
                        this.saveUserSetting('custom', 'barCursorOpacity', value);
                        this.updateCursorStyles(this.barCursorColor, this.barCursorOpacity, this.barCursorPosition);
                    },
                    value => `${Math.round(value * 100)}%`
                ),
                this.selectRow(
                    'Bar Cursor Layer',
                    [
                        { value: 'above', label: 'Above Score' },
                        { value: 'below', label: 'Behind Score' }
                    ],
                    this.barCursorPosition,
                    value => {
                        this.barCursorPosition = value as 'above' | 'below';
                        this.saveUserSetting('custom', 'barCursorPosition', value);
                        this.updateCursorStyles(this.barCursorColor, this.barCursorOpacity, this.barCursorPosition);
                    }
                ),
                this.colorRow('Staff Line', 'display.resources.staffLineColor'),
                this.colorRow('Bar Separator', 'display.resources.barSeparatorColor'),
                this.colorRow('Bar Number', 'display.resources.barNumberColor'),
                this.colorRow('Main Glyphs', 'display.resources.mainGlyphColor'),
                this.colorRow('Secondary Glyphs', 'display.resources.secondaryGlyphColor'),
                this.colorRow('Score Info', 'display.resources.scoreInfoColor'),
                this.colorRow('Watermark', 'display.resources.watermarkColor')
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
                this.fontRow('Markers', 'display.resources.markerFont'),
                this.fontRow('Watermark', 'display.resources.watermarkFont')
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
                this.settingsNumberRow('Slur Height', 'notation.slurHeight', 1),
                this.notationElementToggleRow('Show Lyrics', alphaTab.NotationElement.EffectLyrics)
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
                this.stylesheetEnumRow(
                    'Single-Track Name Policy',
                    'singleTrackTrackNamePolicy',
                    alphaTab.model.TrackNamePolicy
                ),
                this.stylesheetEnumRow(
                    'Multi-Track Name Policy',
                    'multiTrackTrackNamePolicy',
                    alphaTab.model.TrackNamePolicy
                ),
                this.stylesheetEnumRow(
                    'First System Track Name Format',
                    'firstSystemTrackNameMode',
                    alphaTab.model.TrackNameMode
                ),
                this.stylesheetEnumRow(
                    'First System Track Name Orientation',
                    'firstSystemTrackNameOrientation',
                    alphaTab.model.TrackNameOrientation
                ),
                this.stylesheetEnumRow(
                    'Other Systems Track Name Format',
                    'otherSystemsTrackNameMode',
                    alphaTab.model.TrackNameMode
                ),
                this.stylesheetEnumRow(
                    'Other Systems Track Name Orientation',
                    'otherSystemsTrackNameOrientation',
                    alphaTab.model.TrackNameMode
                ),
                this.stylesheetToggleRow('Multi-Bar Rests', 'multiTrackMultiBarRest')
            ]),
            this.section('Export', [
                this.actionsRow([
                    { label: 'Export MIDI', action: () => this.api.downloadMidi() },
                    { label: 'Export Guitar Pro', action: () => exportGp7(this.api) },
                    { label: 'Print', action: () => this.api.print() }
                ])
            ]),
            this.section('Settings Control', [
                this.actionsRow([
                    {
                        label: 'Export Settings',
                        action: () => this.exportSettings()
                    },
                    {
                        label: 'Import Settings',
                        action: () => this.importSettings()
                    },
                    {
                        label: 'Reset Settings',
                        action: () => {
                            if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
                                this.resetSettings();
                            }
                        }
                    }
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
                this.applyBackgroundColors();

                // Update alphaTab rendering colors to match the theme
                this.applyThemeToScore(isDark);
                this.saveUserSetting('custom', 'theme', button.dataset.theme);
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
                this.saveUserSetting('settings', 'core.engine', button.dataset.engine!);
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
            this.saveUserSetting('settings', path, value);
            this.update(render);
            afterUpdate?.();
        });
    }

    private paddingRow(label: string, index: number): HTMLElement {
        return this.numberRow(label, this.api.settings.display.padding[index], value => {
            this.api.settings.display.padding[index] = value;
            this.saveUserSetting('settings', 'display.padding', this.api.settings.display.padding);
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
                this.saveUserSetting('custom', 'noteColorScheme', this.noteColorScheme);
                if (this.api.score) {
                    applySuzukiNoteColors(this.api.score, this.noteColorScheme === 'suzuki');
                    this.api.render();
                }
            }
        );
    }

    private colorRow(label: string, path: string): HTMLElement {
        const value = this.getPath(this.api.settings, path) as alphaTab.model.Color | null;
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const hex = this.colorToHex(value);
        const input = parseHtml(html`
            <input type="color" value="${hex}" />
        `) as HTMLInputElement;
        input.addEventListener('change', () => {
            const currentAlpha = value ? value.a : 255;
            const parsed = this.hexToColor(input.value, currentAlpha);
            this.setPath(this.api.settings, path, parsed);
            this.saveUserSetting('settings', path, parsed);
            this.render();
        });
        control.appendChild(input);
        return row;
    }

    private backgroundColorRow(label: string, theme: 'light' | 'dark'): HTMLElement {
        const row = this.row(label);
        const control = row.querySelector('.at-settings-control')!;
        const value = theme === 'light' ? this.lightThemeBgColor : this.darkThemeBgColor;
        const input = parseHtml(html`
            <input type="color" value="${value}" />
        `) as HTMLInputElement;
        input.addEventListener('change', () => {
            if (theme === 'light') {
                this.lightThemeBgColor = input.value;
                this.saveUserSetting('custom', 'lightThemeBgColor', this.lightThemeBgColor);
            } else {
                this.darkThemeBgColor = input.value;
                this.saveUserSetting('custom', 'darkThemeBgColor', this.darkThemeBgColor);
            }
            this.applyBackgroundColors();
        });
        control.appendChild(input);
        return row;
    }

    private applyBackgroundColors(): void {
        const isDark = document.documentElement.classList.contains('dark-theme');
        const color = isDark ? this.darkThemeBgColor : this.lightThemeBgColor;
        document.documentElement.style.setProperty('--at-bg', color);
    }

    private colorToHex(color: alphaTab.model.Color | null | undefined): string {
        if (!color) {
            return '#000000';
        }
        const r = color.r.toString(16).padStart(2, '0');
        const g = color.g.toString(16).padStart(2, '0');
        const b = color.b.toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    private hexToColor(hex: string, alpha = 255): alphaTab.model.Color {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return new alphaTab.model.Color(r, g, b, alpha);
    }

    private cssColorToHex(colorStr: string): string {
        if (colorStr.startsWith('#')) {
            return colorStr;
        }
        if (colorStr.startsWith('rgb')) {
            const matches = colorStr.match(/\d+/g);
            if (matches && matches.length >= 3) {
                const r = Number(matches[0]).toString(16).padStart(2, '0');
                const g = Number(matches[1]).toString(16).padStart(2, '0');
                const b = Number(matches[2]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
        }
        if (colorStr === 'yellow') {
            return '#ffff00';
        }
        if (colorStr === 'red') {
            return '#ff0000';
        }
        if (colorStr === 'blue') {
            return '#0000ff';
        }
        if (colorStr === 'green') {
            return '#008000';
        }
        return '#fff200';
    }

    private fontRow(label: string, path: string): HTMLElement {
        const font = this.getPath(this.api.settings, path);
        const initialFamilies = Array.isArray(font?.families) ? font.families.join(', ') : '';
        const initialSize = typeof font?.size === 'number' ? font.size : 12;

        const row = this.row(label);
        const control = row.querySelector('.at-settings-control') as HTMLElement;
        if (control) {
            const familyInput = parseHtml(
                html`<input type="text" value="${initialFamilies}" style="flex: 1; min-width: 0;" placeholder="Families" />`
            ) as HTMLInputElement;
            familyInput.addEventListener('change', () => {
                const target = this.getPath(this.api.settings, path);
                if (target?.families) {
                    target.families = familyInput.value
                        .split(',')
                        .map(v => v.trim())
                        .filter(Boolean);
                    this.saveUserSetting('settings', path, target);
                    this.render();
                }
            });

            const sizeInput = parseHtml(
                html`<input type="number" value="${initialSize}" style="width: 50px; text-align: center;" min="1" max="100" />`
            ) as HTMLInputElement;
            sizeInput.addEventListener('change', () => {
                const target = this.getPath(this.api.settings, path);
                if (target) {
                    target.size = Number(sizeInput.value);
                    this.saveUserSetting('settings', path, target);
                    this.render();
                }
            });

            control.style.display = 'flex';
            control.style.gap = '8px';
            control.appendChild(familyInput);
            control.appendChild(sizeInput);
        }
        return row;
    }

    private enumRow(
        label: string,
        path: string,
        enumType: Record<string | number, string | number>,
        render = true
    ): HTMLElement {
        return this.selectRow(label, this.enumItems(enumType), String(this.getPath(this.api.settings, path)), value => {
            const numValue = Number(value);
            this.setPath(this.api.settings, path, numValue);
            this.saveUserSetting('settings', path, numValue);
            this.update(render);
        });
    }

    private settingsToggleRow(label: string, path: string, render = true, afterUpdate?: () => void): HTMLElement {
        return this.toggleRow(label, Boolean(this.getPath(this.api.settings, path)), value => {
            this.setPath(this.api.settings, path, value);
            this.saveUserSetting('settings', path, value);
            this.update(render);
            afterUpdate?.();
        });
    }

    private notationElementToggleRow(label: string, element: alphaTab.NotationElement): HTMLElement {
        const initialValue = this.api.settings.notation.isNotationElementVisible(element);
        return this.toggleRow(label, initialValue, value => {
            this.api.settings.notation.elements.set(element, value);
            this.saveAllSettings();
            this.update(true);
        });
    }

    private apiRangeRow(label: string, path: string, min: number, max: number, step: number): HTMLElement {
        return this.rangeRow(
            label,
            min,
            max,
            step,
            Number((this.api as any)[path] ?? 0),
            value => {
                (this.api as any)[path] = value;
                this.saveUserSetting('api', path, value);
            },
            value => value.toFixed(1)
        );
    }

    private apiToggleRow(label: string, path: string): HTMLElement {
        return this.toggleRow(label, Boolean((this.api as any)[path]), value => {
            (this.api as any)[path] = value;
            this.saveUserSetting('api', path, value);
        });
    }

    private stylesheetToggleRow(label: string, path: string): HTMLElement {
        if (!this.api.score) {
            return this.disabledRow(label);
        }
        return this.toggleRow(label, Boolean((this.api.score.stylesheet as any)[path]), value => {
            (this.api.score!.stylesheet as any)[path] = value;
            this.saveUserSetting('stylesheet', path, value);
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
                const numValue = Number(value);
                (this.api.score!.stylesheet as any)[path] = numValue;
                this.saveUserSetting('stylesheet', path, numValue);
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

    private barCursorColorRow(): HTMLElement {
        const row = this.row('Bar Cursor Color');
        const control = row.querySelector('.at-settings-control')!;
        const hex = this.cssColorToHex(this.barCursorColor);
        const input = parseHtml(html`
            <input type="color" value="${hex}" />
        `) as HTMLInputElement;
        input.addEventListener('change', () => {
            this.barCursorColor = input.value;
            this.saveUserSetting('custom', 'barCursorColor', this.barCursorColor);
            this.updateCursorStyles(this.barCursorColor, this.barCursorOpacity, this.barCursorPosition);
        });
        control.appendChild(input);
        return row;
    }

    private updateCursorStyles(color: string, opacity: number, position: 'above' | 'below'): void {
        if (!this.cursorStyleEl) {
            this.cursorStyleEl = document.createElement('style');
            this.cursorStyleEl.id = 'at-custom-cursor-styles';
            document.head.appendChild(this.cursorStyleEl);
        }

        let zIndexStyle = '';
        if (position === 'below') {
            zIndexStyle = `
                .at-cursors {
                    z-index: 1 !important;
                }
                .at-cursors ~ svg, .at-cursors ~ canvas {
                    position: relative !important;
                    z-index: 2 !important;
                }
            `;
        }

        this.cursorStyleEl.textContent = `
            .at-cursor-bar {
                background: ${color} !important;
                opacity: ${opacity} !important;
            }
            ${zIndexStyle}
        `;
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

        // Clean up injected styles
        if (this.cursorStyleEl) {
            this.cursorStyleEl.remove();
        }
    }

    private loadSavedSettings(): void {
        const dataStr = localStorage.getItem('at-playground-settings');
        if (!dataStr) {
            return;
        }
        try {
            const data = JSON.parse(dataStr);
            if (!data) {
                return;
            }

            // 1. Apply Settings Json
            if (data.settings) {
                for (const key of Object.keys(data.settings)) {
                    const savedValue = data.settings[key];
                    this.applySettingValue(this.api.settings, key, savedValue);
                }
            }

            // 2. Apply Api Properties
            if (data.api) {
                for (const key of Object.keys(data.api)) {
                    const savedValue = data.api[key];
                    if (key in this.api) {
                        (this.api as any)[key] = savedValue;
                    }
                }
            }

            // 3. Apply Custom properties
            if (data.custom) {
                if (data.custom.noteColorScheme) {
                    this.noteColorScheme = data.custom.noteColorScheme as NoteColorScheme;
                }
                if (data.custom.barCursorColor) {
                    this.barCursorColor = data.custom.barCursorColor;
                }
                if (data.custom.barCursorOpacity !== undefined) {
                    this.barCursorOpacity = Number(data.custom.barCursorOpacity);
                }
                if (data.custom.barCursorPosition) {
                    this.barCursorPosition = data.custom.barCursorPosition as 'above' | 'below';
                }
                if (data.custom.notationElements) {
                    for (const key of Object.keys(data.custom.notationElements)) {
                        const elemId = Number(key);
                        const val = data.custom.notationElements[key];
                        this.api.settings.notation.elements.set(elemId, val);
                    }
                }
                if (data.custom.lightThemeBgColor) {
                    this.lightThemeBgColor = data.custom.lightThemeBgColor;
                }
                if (data.custom.darkThemeBgColor) {
                    this.darkThemeBgColor = data.custom.darkThemeBgColor;
                }
                if (data.custom.transpose !== undefined) {
                    const savedTranspose = Number(data.custom.transpose);
                    this.api.settings.notation.transpositionPitches = [savedTranspose];
                }
                this.applyBackgroundColors();
            }

            this.api.updateSettings();
        } catch (e) {
            console.error('Failed to load saved settings:', e);
        }
    }

    private getSavedCustomSetting(key: string): any {
        const dataStr = localStorage.getItem('at-playground-settings');
        if (!dataStr) {
            return null;
        }
        try {
            const data = JSON.parse(dataStr);
            return data?.custom?.[key];
        } catch {
            return null;
        }
    }

    private applySettingValue(settings: alphaTab.Settings, key: string, savedValue: any): void {
        const parts = key.split('.');
        let obj: any = settings;
        let validPath = true;
        for (let i = 0; i < parts.length - 1; i++) {
            if (obj && parts[i] in obj) {
                obj = obj[parts[i]];
            } else {
                validPath = false;
                break;
            }
        }
        if (!validPath || !obj) {
            return;
        }
        const propName = parts[parts.length - 1];
        const currentValue = obj[propName];

        if (currentValue instanceof alphaTab.model.Color) {
            const color = alphaTab.model.Color.fromJson(savedValue);
            if (color) {
                obj[propName] = color;
            }
        } else if (currentValue instanceof alphaTab.model.Font) {
            const font = alphaTab.model.Font.fromJson(savedValue);
            if (font) {
                obj[propName] = font;
            }
        } else {
            obj[propName] = savedValue;
        }
    }

    private applySavedStylesheetSettings(score: alphaTab.model.Score): void {
        const dataStr = localStorage.getItem('at-playground-settings');
        if (!dataStr) {
            return;
        }
        try {
            const data = JSON.parse(dataStr);
            if (data?.stylesheet && score.stylesheet) {
                for (const key of Object.keys(data.stylesheet)) {
                    const savedValue = data.stylesheet[key];
                    if (key in score.stylesheet) {
                        (score.stylesheet as any)[key] = savedValue;
                    }
                }
            }
        } catch (e) {
            console.error('Failed to apply stylesheet settings:', e);
        }
    }

    private saveUserSetting(category: string, key: string, value: any): void {
        this.saveAllSettings();
    }

    private saveAllSettings(): void {
        try {
            const notationElements: any = {};
            for (const [k, v] of this.api.settings.notation.elements.entries()) {
                notationElements[String(k)] = v;
            }

            const data: any = {
                settings: {},
                api: {},
                stylesheet: {},
                custom: {
                    theme: document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light',
                    noteColorScheme: this.noteColorScheme,
                    barCursorColor: this.barCursorColor,
                    barCursorOpacity: this.barCursorOpacity,
                    barCursorPosition: this.barCursorPosition,
                    notationElements,
                    lightThemeBgColor: this.lightThemeBgColor,
                    darkThemeBgColor: this.darkThemeBgColor,
                    transpose: this.api.settings.notation.transpositionPitches[0] || 0
                }
            };

            const settingsKeys = [
                'core.engine',
                'display.scale',
                'display.stretchForce',
                'display.layoutMode',
                'display.barsPerRow',
                'display.startBar',
                'display.barCount',
                'display.justifyLastSystem',
                'display.systemsLayoutMode',
                'display.resources.staffLineColor',
                'display.resources.barSeparatorColor',
                'display.resources.barNumberColor',
                'display.resources.mainGlyphColor',
                'display.resources.secondaryGlyphColor',
                'display.resources.scoreInfoColor',
                'display.resources.watermarkColor',
                'display.resources.copyrightFont',
                'display.resources.titleFont',
                'display.resources.subTitleFont',
                'display.resources.wordsFont',
                'display.resources.effectFont',
                'display.resources.timerFont',
                'display.resources.directionsFont',
                'display.resources.fretboardNumberFont',
                'display.resources.numberedNotationFont',
                'display.resources.tablatureFont',
                'display.resources.graceFont',
                'display.resources.barNumberFont',
                'display.resources.inlineFingeringFont',
                'display.resources.markerFont',
                'display.resources.watermarkFont',
                'display.padding',
                'display.firstSystemPaddingTop',
                'display.systemPaddingTop',
                'display.lastSystemPaddingBottom',
                'display.systemPaddingBottom',
                'display.systemLabelPaddingLeft',
                'display.systemLabelPaddingRight',
                'display.accoladeBarPaddingRight',
                'display.notationStaffPaddingTop',
                'display.notationStaffPaddingBottom',
                'display.effectStaffPaddingTop',
                'display.effectStaffPaddingBottom',
                'display.firstStaffLeft',
                'display.staffPaddingLeft',
                'notation.fingeringMode',
                'notation.rhythmMode',
                'notation.rhythmHeight',
                'notation.smallGraceTabNotes',
                'notation.extendBendArrowsOnTiedNotes',
                'notation.extendLineEffectsToBeatEnd',
                'notation.slurHeight',
                'player.playerMode',
                'player.enableCursor',
                'player.enableAnimatedBeatCursor',
                'player.enableElementHighlighting',
                'player.enableUserInteraction',
                'player.scrollOffsetX',
                'player.scrollOffsetY',
                'player.scrollMode',
                'player.playTripletFeel'
            ];

            for (const key of settingsKeys) {
                const val = this.getPath(this.api.settings, key);
                if (val !== undefined) {
                    data.settings[key] = this.serializeValue(val);
                }
            }

            const apiKeys = ['masterVolume', 'metronomeVolume', 'countInVolume', 'playbackSpeed', 'isLooping'];

            for (const key of apiKeys) {
                const val = (this.api as any)[key];
                if (val !== undefined) {
                    data.api[key] = val;
                }
            }

            const stylesheetKeys = [
                'hideDynamics',
                'bracketExtendMode',
                'useSystemSignSeparator',
                'globalDisplayTuning',
                'globalDisplayChordDiagramsOnTop',
                'singleTrackTrackNamePolicy',
                'multiTrackTrackNamePolicy',
                'firstSystemTrackNameMode',
                'firstSystemTrackNameOrientation',
                'otherSystemsTrackNameMode',
                'otherSystemsTrackNameOrientation',
                'multiTrackMultiBarRest'
            ];

            if (this.api.score && this.api.score.stylesheet) {
                for (const key of stylesheetKeys) {
                    const val = (this.api.score.stylesheet as any)[key];
                    if (val !== undefined) {
                        data.stylesheet[key] = val;
                    }
                }
            } else {
                const oldDataStr = localStorage.getItem('at-playground-settings');
                if (oldDataStr) {
                    try {
                        const oldData = JSON.parse(oldDataStr);
                        if (oldData && oldData.stylesheet) {
                            data.stylesheet = oldData.stylesheet;
                        }
                    } catch {}
                }
            }

            localStorage.setItem('at-playground-settings', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save all settings:', e);
        }
    }

    private serializeValue(value: any): any {
        if (value && typeof value === 'object') {
            if (value instanceof alphaTab.model.Color) {
                return value.rgba;
            }
            if (value instanceof alphaTab.model.Font) {
                return value.toCssString();
            }
            if (Array.isArray(value)) {
                return value.map(v => this.serializeValue(v));
            }
        }
        return value;
    }

    private exportSettings(): void {
        try {
            const exportData: Record<string, string | null> = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('at-playground-')) {
                    exportData[key] = localStorage.getItem(key);
                }
            }

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = 'alphatab-settings.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export settings:', e);
            window.alert('Failed to export settings.');
        }
    }

    private importSettings(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';

        input.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const result = event.target?.result;
                    if (typeof result !== 'string') {
                        throw new Error('Could not read file content');
                    }
                    const data = JSON.parse(result);
                    if (typeof data !== 'object' || data === null) {
                        throw new Error('Invalid JSON format');
                    }

                    const keys = Object.keys(data);
                    const hasPlaygroundKeys = keys.some(k => k.startsWith('at-playground-'));
                    if (!hasPlaygroundKeys) {
                        throw new Error('No alphaTab playground settings found in the file.');
                    }

                    if (
                        window.confirm(
                            'Importing settings will overwrite your current settings and reload the page. Continue?'
                        )
                    ) {
                        for (const key of keys) {
                            if (key.startsWith('at-playground-')) {
                                const val = data[key];
                                if (val === null) {
                                    localStorage.removeItem(key);
                                } else {
                                    localStorage.setItem(key, val);
                                }
                            }
                        }
                        window.location.reload();
                    }
                } catch (error: any) {
                    console.error('Failed to import settings:', error);
                    window.alert(`Failed to import settings: ${error.message}`);
                } finally {
                    input.remove();
                }
            };
            reader.readAsText(file);
        });

        document.body.appendChild(input);
        input.click();
    }

    private resetSettings(): void {
        localStorage.removeItem('at-playground-settings');
        localStorage.removeItem('at-playground-bar-cursor-color');
        localStorage.removeItem('at-playground-bar-cursor-opacity');
        localStorage.removeItem('at-playground-bar-cursor-position');
        localStorage.removeItem('at-playground-score-data');
        localStorage.removeItem('at-playground-track-settings');
        window.location.reload();
    }
}
