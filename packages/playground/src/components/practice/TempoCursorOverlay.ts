import type * as alphaTab from '@coderline/alphatab';
import { css, injectStyles, type Mountable, parseHtml } from '../../util/Dom';
import type { PracticeQueueItem } from './PracticeController';

injectStyles(
    'TempoCursorOverlay',
    css`
    .at-tempo-cursor-overlay {
        position: absolute;
        inset: 0;
        z-index: 999;
        pointer-events: none;
    }
    .at-tempo-cursor-mark {
        position: absolute;
        width: 3px;
        min-height: 18px;
        border-radius: 2px;
        background: rgba(107, 114, 128, 0.7);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.72), 0 0 8px rgba(75, 85, 99, 0.36);
        transform: translateX(-1px);
        transition: left 80ms linear, top 80ms linear, height 80ms linear;
    }
`
);

export class TempoCursorOverlay implements Mountable {
    readonly root: HTMLElement;

    public constructor(
        private api: alphaTab.AlphaTabApi,
        host: HTMLElement
    ) {
        this.root = parseHtml('<div class="at-tempo-cursor-overlay"></div>');
        host.appendChild(this.root);
    }

    public showItem(item: PracticeQueueItem<alphaTab.model.Beat> | null): void {
        this.root.replaceChildren();
        if (!item) {
            return;
        }

        const renderedStaves = new Set<alphaTab.model.Staff>();
        for (const beat of item.beats) {
            const staff = beat.voice.bar.staff;
            if (renderedStaves.has(staff)) {
                continue;
            }

            const beatBounds = this.api.boundsLookup?.findBeat(beat);
            if (!beatBounds) {
                continue;
            }
            renderedStaves.add(staff);

            const bounds = beatBounds.realBounds;
            const mark = document.createElement('div');
            mark.className = 'at-tempo-cursor-mark';
            mark.style.left = `${bounds.x}px`;
            mark.style.top = `${bounds.y - 4}px`;
            mark.style.height = `${Math.max(18, bounds.h + 8)}px`;
            this.root.appendChild(mark);
        }
    }

    public clear(): void {
        this.root.replaceChildren();
    }

    public dispose(): void {
        this.clear();
        this.root.remove();
    }
}
