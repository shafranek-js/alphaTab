import * as alphaTab from '@coderline/alphatab';
import { Crosshair } from '../components/Crosshair';
import { DragDrop } from '../components/DragDrop';
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
    settings.fillFromJson({
        core: {
            includeNoteBounds: true,
            logLevel: (params.get('loglevel') ?? 'info') as alphaTab.json.CoreSettingsJson['logLevel'],
            engine: params.get('engine') ?? 'svg',
            file: options.file ?? Paths.defaultScore,
            fontDirectory: options.fontDirectory ?? Paths.fontDirectory
        },
        player: {
            playerMode: alphaTab.PlayerMode.EnabledAutomatic,
            scrollOffsetX: -10,
            scrollOffsetY: -20,
            soundFont: options.soundFont ?? Paths.soundFont,
            scrollElement: viewport
        }
    } satisfies alphaTab.json.SettingsJson);
    if (options.settings) {
        settings.fillFromJson(options.settings);
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
