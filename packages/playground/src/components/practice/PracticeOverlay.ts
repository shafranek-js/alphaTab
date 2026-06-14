import type * as alphaTab from '@coderline/alphatab';
import { type Mountable, css, injectStyles, parseHtml } from '../../util/Dom';
import type { PracticeQueueItem } from './PracticeController';

type OverlayFeedback = 'current' | 'partial' | 'correct' | 'wrong';

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
        transform-origin: center;
        transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
    }
    .at-practice-note-mark.current {
        border-color: #0b84ff;
        background: rgba(11, 132, 255, 0.22);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.86), 0 0 14px rgba(11, 132, 255, 0.65);
        animation: at-practice-current-pulse 1150ms ease-in-out infinite;
    }
    .at-practice-note-pulse-group {
        animation: at-practice-note-glyph-pulse 1150ms ease-in-out infinite;
        filter: drop-shadow(0 0 3px rgba(11, 132, 255, 0.95));
        transform-box: view-box;
        transform-origin: 0 0;
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
    @keyframes at-practice-current-pulse {
        0%,
        100% {
            opacity: 0.78;
            transform: scale(1);
        }
        50% {
            opacity: 1;
            transform: scale(1.28);
        }
    }
    @keyframes at-practice-note-glyph-pulse {
        0%,
        100% {
            opacity: 0.84;
            transform: translate(var(--at-practice-note-pulse-x), var(--at-practice-note-pulse-y)) scale(1) translate(calc(var(--at-practice-note-pulse-x) * -1), calc(var(--at-practice-note-pulse-y) * -1));
        }
        50% {
            opacity: 1;
            transform: translate(var(--at-practice-note-pulse-x), var(--at-practice-note-pulse-y)) scale(1.12) translate(calc(var(--at-practice-note-pulse-x) * -1), calc(var(--at-practice-note-pulse-y) * -1));
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .at-practice-note-mark.current,
        .at-practice-note-pulse-group {
            animation: none;
        }
    }
`
);

interface PulseOriginal {
    element: Element;
    visibility: string;
}

interface PulseGroup {
    wrapper: SVGGElement;
    originals: PulseOriginal[];
}

export class PracticeOverlay implements Mountable {
    readonly root: HTMLElement;
    private clearFeedbackTimer: number | null = null;
    private pulseGroups: PulseGroup[] = [];

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
            this.root.replaceChildren();
            this.clearFeedbackTimer = null;
        }, 180);
    }

    public clear(): void {
        if (this.clearFeedbackTimer !== null) {
            window.clearTimeout(this.clearFeedbackTimer);
            this.clearFeedbackTimer = null;
        }
        this.clearPulseTargets();
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
        this.clearPulseTargets();
        this.root.replaceChildren();
        if (!item) {
            return;
        }
        this.renderItem(item, feedback, matchedNotes);
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
        if (feedback === 'current') {
            if (noteBounds.length === 0) {
                this.addPulseTarget(beatBounds.realBounds);
                return;
            }
            for (const note of noteBounds) {
                if (matched.has(note.note.realValue)) {
                    this.addMark(note.noteHeadBounds, 'partial');
                } else {
                    this.addPulseTarget(note.noteHeadBounds);
                }
            }
            return;
        }
        if (noteBounds.length === 0) {
            this.addMark(beatBounds.realBounds, feedback);
            return;
        }

        for (const note of noteBounds) {
            this.addMark(note.noteHeadBounds, feedback);
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

    private addPulseTarget(bounds: alphaTab.rendering.Bounds): void {
        const rootBounds = this.root.getBoundingClientRect();
        const x = rootBounds.left + bounds.x + bounds.w / 2;
        const y = rootBounds.top + bounds.y + bounds.h / 2;
        const textElements = document
            .elementsFromPoint(x, y)
            .filter(el => el.tagName.toLowerCase() === 'text' && el.closest('.at-surface-svg'));
        const noteHead = this.findNoteHeadElement(textElements) ?? textElements[0];
        if (!noteHead) {
            return;
        }
        this.addPulseGroup([this.findPulseRoot(noteHead), ...this.findAttachedNoteElements(noteHead, rootBounds, bounds)]);
    }

    private findNoteHeadElement(textElements: Element[]): Element | null {
        const noteHeadGlyphs = new Set(['\uE0A4']);
        return (
            textElements.find(el => noteHeadGlyphs.has(el.textContent ?? '')) ??
            textElements.find(el => !this.isDefaultNotationFill(el.getAttribute('fill'))) ??
            textElements.find(el => !el.hasAttribute('text-anchor')) ??
            null
        );
    }

    private isDefaultNotationFill(fill: string | null): boolean {
        if (!fill) {
            return false;
        }
        const normalized = fill.trim().toLowerCase();
        return normalized === '#f0f0f0' || normalized === '#969696' || normalized.startsWith('rgba(200,200,200');
    }

    private findAttachedNoteElements(
        noteHead: Element,
        rootBounds: DOMRect,
        bounds: alphaTab.rendering.Bounds
    ): Element[] {
        const svg = noteHead.closest('.at-surface-svg');
        if (!svg) {
            return [];
        }

        const noteLeft = rootBounds.left + bounds.x;
        const noteRight = noteLeft + bounds.w;
        const noteTop = rootBounds.top + bounds.y;
        const noteBottom = noteTop + bounds.h;
        const candidates = Array.from(svg.querySelectorAll('rect,path,line,polygon,polyline'));
        return candidates.filter(element => {
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return false;
            }

            const nearNoteColumn = rect.right >= noteLeft - 8 && rect.left <= noteRight + 8;
            const nearNoteVertically = rect.bottom >= noteTop - 90 && rect.top <= noteBottom + 120;
            if (!nearNoteColumn || !nearNoteVertically) {
                return false;
            }

            const isStemLike = rect.width <= 6 && rect.height >= Math.max(10, bounds.h * 1.25);
            const isFlagOrBeamLike = rect.height <= 12 && rect.width <= 70 && rect.width >= 4;
            return isStemLike || isFlagOrBeamLike;
        });
    }

    private findPulseRoot(noteHead: Element): Element {
        const parent = noteHead.parentElement;
        const grandParent = parent?.parentElement;
        if (
            parent?.tagName.toLowerCase() === 'g' &&
            grandParent?.tagName.toLowerCase() === 'g' &&
            grandParent.classList.length > 0
        ) {
            return grandParent;
        }
        return noteHead;
    }

    private addPulseGroup(elements: Element[]): void {
        const uniqueElements = Array.from(new Set(elements)).filter(element => {
            return !elements.some(other => other !== element && other.contains(element));
        });
        const rects = uniqueElements.map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
        if (rects.length === 0) {
            return;
        }

        const left = Math.min(...rects.map(rect => rect.left));
        const top = Math.min(...rects.map(rect => rect.top));
        const right = Math.max(...rects.map(rect => rect.right));
        const bottom = Math.max(...rects.map(rect => rect.bottom));
        const svg = uniqueElements[0].closest('.at-surface-svg') as SVGSVGElement | null;
        if (!svg) {
            return;
        }
        const origin = this.toSvgPoint(svg, (left + right) / 2, (top + bottom) / 2);
        const orderedElements = uniqueElements.sort((a, b) => {
            const position = a.compareDocumentPosition(b);
            return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
        });
        const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        wrapper.classList.add('at-practice-note-pulse-group');
        wrapper.style.setProperty('--at-practice-note-pulse-x', `${origin.x}px`);
        wrapper.style.setProperty('--at-practice-note-pulse-y', `${origin.y}px`);

        const originals: PulseOriginal[] = [];
        for (const element of orderedElements) {
            const clone = element.cloneNode(true) as Element;
            clone.removeAttribute('id');
            wrapper.appendChild(clone);

            const styledElement = element as HTMLElement | SVGElement;
            originals.push({
                element,
                visibility: styledElement.style.getPropertyValue('visibility')
            });
            styledElement.style.setProperty('visibility', 'hidden');
        }
        svg.appendChild(wrapper);
        this.pulseGroups.push({ wrapper, originals });
    }

    private toSvgPoint(svg: SVGSVGElement, x: number, y: number): DOMPoint {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        return point.matrixTransform(svg.getScreenCTM()?.inverse());
    }

    private clearPulseTargets(): void {
        for (const group of this.pulseGroups) {
            for (const original of group.originals) {
                const styledElement = original.element as HTMLElement | SVGElement;
                if (original.visibility) {
                    styledElement.style.setProperty('visibility', original.visibility);
                } else {
                    styledElement.style.removeProperty('visibility');
                }
            }
            group.wrapper.remove();
        }
        this.pulseGroups = [];
    }
}
