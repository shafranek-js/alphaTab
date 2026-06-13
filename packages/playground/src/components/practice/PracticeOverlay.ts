import type * as alphaTab from '@coderline/alphatab';
import { type Mountable, css, injectStyles, parseHtml } from '../../util/Dom';
import type { PracticeQueueItem } from './PracticeController';

type OverlayFeedback = 'current' | 'partial' | 'correct' | 'wrong' | 'missed';

injectStyles(
    'PracticeOverlay',
    css`
    .at-practice-overlay {
        position: absolute;
        inset: 0;
        z-index: 1000;
        pointer-events: none;
    }
    .at-practice-note-mark {
        position: absolute;
        border: 2px solid #2f80ed;
        background: rgba(47, 128, 237, 0.16);
        border-radius: 4px;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.75);
        transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
    }
    .at-practice-note-mark.partial {
        border-color: #9b7b00;
        background: rgba(245, 185, 33, 0.24);
    }
    .at-practice-note-mark.correct {
        border-color: #1f8f4d;
        background: rgba(31, 143, 77, 0.26);
        transform: scale(1.08);
    }
    .at-practice-note-mark.wrong {
        border-color: #c92a2a;
        background: rgba(201, 42, 42, 0.28);
        transform: scale(1.08);
    }
    .at-practice-note-mark.missed {
        border-color: #c2410c;
        background: rgba(251, 146, 60, 0.3);
        transform: scale(1.08);
    }
`
);

export class PracticeOverlay implements Mountable {
    readonly root: HTMLElement;
    private clearFeedbackTimer: number | null = null;

    public constructor(
        private api: alphaTab.AlphaTabApi,
        host: HTMLElement
    ) {
        this.root = parseHtml('<div class="at-practice-overlay"></div>');
        host.appendChild(this.root);
    }

    public showItem(item: PracticeQueueItem<alphaTab.model.Beat> | null, matchedNotes: number[] = []): void {
        this.render(item, 'current', matchedNotes);
    }

    public flash(item: PracticeQueueItem<alphaTab.model.Beat> | null, feedback: OverlayFeedback, matchedNotes: number[] = []): void {
        this.render(item, feedback, matchedNotes);
        if (this.clearFeedbackTimer !== null) {
            window.clearTimeout(this.clearFeedbackTimer);
        }
        this.clearFeedbackTimer = window.setTimeout(() => {
            this.render(item, 'current', matchedNotes);
            this.clearFeedbackTimer = null;
        }, 180);
    }

    public flashItems(items: PracticeQueueItem<alphaTab.model.Beat>[], feedback: OverlayFeedback): void {
        this.renderMany(items, feedback);
        if (this.clearFeedbackTimer !== null) {
            window.clearTimeout(this.clearFeedbackTimer);
        }
        this.clearFeedbackTimer = window.setTimeout(() => {
            this.clear();
        }, 300);
    }

    public clear(): void {
        if (this.clearFeedbackTimer !== null) {
            window.clearTimeout(this.clearFeedbackTimer);
            this.clearFeedbackTimer = null;
        }
        this.root.replaceChildren();
    }

    public dispose(): void {
        this.clear();
        this.root.remove();
    }

    private render(
        item: PracticeQueueItem<alphaTab.model.Beat> | null,
        feedback: OverlayFeedback,
        matchedNotes: number[] = []
    ): void {
        this.root.replaceChildren();
        if (!item) {
            return;
        }
        this.renderItem(item, feedback, matchedNotes);
    }

    private renderMany(items: PracticeQueueItem<alphaTab.model.Beat>[], feedback: OverlayFeedback): void {
        this.root.replaceChildren();
        for (const item of items) {
            this.renderItem(item, feedback);
        }
    }

    private renderItem(
        item: PracticeQueueItem<alphaTab.model.Beat>,
        feedback: OverlayFeedback,
        matchedNotes: number[] = []
    ): void {
        const beatBounds = this.api.boundsLookup?.findBeat(item.beat);
        if (!beatBounds) {
            return;
        }

        const matched = new Set(matchedNotes);
        const expected = new Set(item.expectedNotes);
        const noteBounds = beatBounds.notes?.filter(n => expected.has(n.note.realValue)) ?? [];
        if (noteBounds.length === 0) {
            this.addMark(beatBounds.realBounds, feedback);
            return;
        }

        for (const note of noteBounds) {
            const noteFeedback = matched.has(note.note.realValue) && feedback === 'current' ? 'partial' : feedback;
            this.addMark(note.noteHeadBounds, noteFeedback);
        }
    }

    private addMark(bounds: alphaTab.rendering.Bounds, feedback: OverlayFeedback): void {
        const mark = document.createElement('div');
        mark.className = `at-practice-note-mark ${feedback}`;
        mark.style.left = `${bounds.x - 3}px`;
        mark.style.top = `${bounds.y - 3}px`;
        mark.style.width = `${Math.max(6, bounds.w + 6)}px`;
        mark.style.height = `${Math.max(6, bounds.h + 6)}px`;
        this.root.appendChild(mark);
    }
}
