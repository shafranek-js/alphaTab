import * as alphaTab from '@coderline/alphatab';
import { Crosshair } from '../components/Crosshair';
import { DragDrop, base64ToArrayBuffer } from '../components/DragDrop';
import { Footer } from '../components/Footer';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { PlaygroundSidePanel } from '../components/PlaygroundSidePanel';
import { SelectionHandles } from '../components/SelectionHandles';
import { type Mountable, css, html, injectStyles, mount, parseHtml } from '../util/Dom';
import { Paths } from '../util/Paths';

injectStyles(
    'ControlApp',
    css`
    .at-wrap {
        position: relative;
        width: 100vw;
        height: 100vh;
        margin: 0;
        border: 0;
        background: var(--at-bg);
        color: var(--at-text);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: none;
    }
    .at-wrap > .at-content {
        flex: 1 1 auto;
        overflow: hidden;
        position: relative;
        background: var(--at-bg);
    }
    .at-wrap .at-viewport {
        overflow-y: auto;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        padding-right: 20px;
    }
    .at-wrap .at-canvas {
        min-height: 100%;
    }
    @media screen and (max-width: 1100px) {
        .at-wrap .at-viewport { left: 0; }
    }
`
);

export interface ControlAppOptions {
    file?: string;
    soundFont?: string;
    fontDirectory?: string;
    settings?: alphaTab.json.SettingsJson;
}

function applyFonts(settings: alphaTab.Settings): void {
    settings.display.resources.copyrightFont.families = ['Noto Sans'];
    settings.display.resources.titleFont.families = ['Noto Serif'];
    settings.display.resources.subTitleFont.families = ['Noto Serif'];
    settings.display.resources.wordsFont.families = ['Noto Serif'];
    settings.display.resources.elementFonts.get(alphaTab.NotationElement.ScoreArtist)!.families = ['Noto Serif'];
    settings.display.resources.elementFonts.get(alphaTab.NotationElement.ScoreAlbum)!.families = ['Noto Serif'];
    settings.display.resources.elementFonts.get(alphaTab.NotationElement.ScoreMusic)!.families = ['Noto Serif'];
    settings.display.resources.elementFonts.get(alphaTab.NotationElement.ScoreWordsAndMusic)!.families = ['Noto Serif'];
    settings.display.resources.effectFont.families = ['Noto Serif'];
    settings.display.resources.timerFont.families = ['Noto Serif'];
    settings.display.resources.fretboardNumberFont.families = ['Noto Sans'];
    settings.display.resources.tablatureFont.families = ['Noto Sans'];
    settings.display.resources.graceFont.families = ['Noto Sans'];
    settings.display.resources.barNumberFont.families = ['Noto Sans'];
    settings.display.resources.markerFont.families = ['Noto Serif'];
    settings.display.resources.directionsFont.families = ['Noto Serif'];
    settings.display.resources.numberedNotationFont.families = ['Noto Sans'];
    settings.display.resources.numberedNotationGraceFont.families = ['Noto Sans'];
}

export function buildSettings(options: ControlAppOptions, viewport: HTMLElement): alphaTab.Settings {
    const params = new URL(window.location.href).searchParams;
    const settings = new alphaTab.Settings();
    applyFonts(settings);

    const hasSavedScore = typeof localStorage !== 'undefined' && localStorage.getItem('at-playground-score-data') !== null;

    settings.fillFromJson({
        core: {
            includeNoteBounds: true,
            logLevel: (params.get('loglevel') ?? 'info') as alphaTab.json.CoreSettingsJson['logLevel'],
            engine: params.get('engine') ?? 'svg',
            file: hasSavedScore ? null : (options.file ?? Paths.defaultScore),
            fontDirectory: options.fontDirectory ?? Paths.fontDirectory
        },
        display: {
            scale: 2,
            layoutMode: alphaTab.LayoutMode.Parchment,
            stretchForce: 1.5,
            padding: [35, 35],
            firstSystemPaddingTop: 0,
            systemPaddingTop: 10,
            lastSystemPaddingBottom: 5,
            systemPaddingBottom: 10,
            systemLabelPaddingLeft: 0,
            systemLabelPaddingRight: 3,
            accoladeBarPaddingRight: 3,
            notationStaffPaddingTop: 0,
            notationStaffPaddingBottom: 0,
            effectStaffPaddingTop: 0,
            effectStaffPaddingBottom: 0,
            firstStaffPaddingLeft: 6,
            staffPaddingLeft: 2
        },
        notation: {
            rhythmHeight: 25,
            smallGraceTabNotes: true,
            extendBendArrowsOnTiedNotes: true,
            extendLineEffectsToBeatEnd: false,
            slurHeight: 5
        },
        player: {
            playerMode: alphaTab.PlayerMode.EnabledAutomatic,
            enableCursor: true,
            enableAnimatedBeatCursor: true,
            enableElementHighlighting: true,
            enableUserInteraction: true,
            scrollOffsetX: -10,
            scrollOffsetY: -20,
            scrollMode: alphaTab.ScrollMode.Continuous,
            playTripletFeel: true,
            soundFont: options.soundFont ?? Paths.soundFont,
            scrollElement: viewport
        }
    } satisfies alphaTab.json.SettingsJson);

    // Apply dark theme colors if no settings or dark theme is active
    const savedSettingsStr = typeof localStorage !== 'undefined' ? localStorage.getItem('at-playground-settings') : null;
    let isDark = true;
    if (savedSettingsStr) {
        try {
            const data = JSON.parse(savedSettingsStr);
            isDark = data?.custom?.theme !== 'light';
        } catch {}
    }

    if (isDark) {
        settings.display.resources.staffLineColor = new alphaTab.model.Color(200, 200, 200, 100);
        settings.display.resources.barSeparatorColor = new alphaTab.model.Color(200, 200, 200, 150);
        settings.display.resources.barNumberColor = new alphaTab.model.Color(150, 150, 150, 255);
        settings.display.resources.mainGlyphColor = new alphaTab.model.Color(240, 240, 240, 255);
        settings.display.resources.secondaryGlyphColor = new alphaTab.model.Color(180, 180, 180, 255);
        settings.display.resources.scoreInfoColor = new alphaTab.model.Color(240, 240, 240, 255);
    }

    // Set Copyright and Watermark font sizes to 0 to hide them by default
    settings.display.resources.copyrightFont.size = 0;
    settings.display.resources.watermarkFont.size = 0;

    if (options.settings) {
        settings.fillFromJson(options.settings);
    }
    if (hasSavedScore) {
        settings.core.file = null;
    }
    settings.core.includeNoteBounds = true;
    return settings;
}

export class ControlApp implements Mountable {
    readonly root: HTMLElement;
    readonly api: alphaTab.AlphaTabApi;
    readonly sidePanel: PlaygroundSidePanel;
    readonly footer: Footer;
    private overlay: LoadingOverlay;
    private selectionHandles: SelectionHandles;
    private crosshair: Crosshair;
    private dragDrop: DragDrop;
    private unsubError: () => void;

    constructor(options: ControlAppOptions = {}) {
        this.root = parseHtml(html`
            <div class="at-wrap">
                <div class="cmp-overlay"></div>
                <div class="at-content">
                    <div class="at-viewport">
                        <div class="at-canvas"></div>
                    </div>
                </div>
                <div class="cmp-side-panel"></div>
                <div class="cmp-footer"></div>
                <div class="cmp-selection-handles"></div>
            </div>
        `);

        const viewport = this.root.querySelector<HTMLElement>('.at-viewport')!;
        const canvas = this.root.querySelector<HTMLElement>('.at-canvas')!;
        const settings = buildSettings(options, viewport);

        this.api = new alphaTab.AlphaTabApi(canvas, settings);
        this.unsubError = this.api.error.on(e => {
            console.error('alphaTab error', e);
        });

        const savedScoreDataStr = typeof localStorage !== 'undefined' ? localStorage.getItem('at-playground-score-data') : null;
        if (savedScoreDataStr) {
            try {
                const savedScore = JSON.parse(savedScoreDataStr);
                if (savedScore && savedScore.data) {
                    const arrayBuffer = base64ToArrayBuffer(savedScore.data);
                    this.api.load(arrayBuffer, [0]);
                } else {
                    throw new Error('Invalid score data format');
                }
            } catch (e) {
                console.error('Failed to load saved score from localStorage, falling back to default:', e);
                try {
                    localStorage.removeItem('at-playground-score-data');
                } catch {}
                this.api.load(options.file ?? Paths.defaultScore, [0]);
            }
        }

        this.overlay = mount(this.root, '.cmp-overlay', new LoadingOverlay(this.api));
        this.sidePanel = mount(this.root, '.cmp-side-panel', new PlaygroundSidePanel(this.api));
        this.footer = mount(
            this.root,
            '.cmp-footer',
            new Footer(this.api, {
                showWaveform: false,
                practiceOverlayHost: viewport,
                onSidePanelModeChange: mode => this.sidePanel.setMode(mode)
            })
        );
        this.sidePanel.onModeChange = mode => {
            this.footer.transport.setSidePanelMode(mode);
        };
        this.selectionHandles = mount(
            this.root,
            '.cmp-selection-handles',
            new SelectionHandles(this.api, viewport)
        );
        this.crosshair = new Crosshair();
        this.dragDrop = new DragDrop(this.api, {
            onEnter: () => this.overlay.enterDrag(),
            onLeave: () => this.overlay.leaveDrag()
        });
        // expose for fiddling in dev tools
        if (typeof window !== 'undefined') {
            window.api = this.api;
            window.alphaTab = alphaTab;
        }
    }

    dispose(): void {
        this.unsubError();
        this.dragDrop.dispose();
        this.crosshair.dispose();
        this.selectionHandles.dispose();
        this.footer.dispose();
        this.sidePanel.dispose();
        this.overlay.dispose();
        this.api.destroy();
        this.root.remove();
    }
}
