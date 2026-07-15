import { describe, expect, it, vi } from 'vitest';

class MockHTMLElement {
    readonly children: MockHTMLElement[] = [];
    readonly dataset: Record<string, string> = {};
    readonly style: Record<string, string> = {};
    className = '';
    textContent = '';

    appendChild(child: MockHTMLElement): MockHTMLElement {
        this.children.push(child);
        return child;
    }

    replaceChildren(...children: MockHTMLElement[]): void {
        this.children.splice(0, this.children.length, ...children);
    }

    remove(): void {}
}

globalThis.HTMLElement = MockHTMLElement as any;

const overlayRoot = new MockHTMLElement();
globalThis.document = {
    createElement: vi.fn((tag: string) => {
        if (tag === 'template') {
            return {
                content: { firstElementChild: overlayRoot },
                innerHTML: ''
            };
        }
        return new MockHTMLElement();
    }),
    adoptNode: vi.fn(element => element),
    head: {
        querySelector: vi.fn(() => null),
        appendChild: vi.fn()
    }
} as any;

describe('TempoCursorOverlay', () => {
    it('renders one mark for each affected staff', async () => {
        const { TempoCursorOverlay } = await import('../src/components/practice/TempoCursorOverlay');
        const upperStaff = {};
        const lowerStaff = {};
        const upperBeatA = { voice: { bar: { staff: upperStaff } } };
        const upperBeatB = { voice: { bar: { staff: upperStaff } } };
        const lowerBeat = { voice: { bar: { staff: lowerStaff } } };
        const bounds = new Map([
            [upperBeatA, { realBounds: { x: 10, y: 20, h: 30 } }],
            [upperBeatB, { realBounds: { x: 15, y: 20, h: 30 } }],
            [lowerBeat, { realBounds: { x: 12, y: 80, h: 40 } }]
        ]);
        const api = {
            boundsLookup: {
                findBeat: vi.fn(beat => bounds.get(beat))
            }
        };
        const host = new MockHTMLElement();
        const overlay = new TempoCursorOverlay(api as any, host as any);

        overlay.showItem({ beats: [upperBeatA, upperBeatB, lowerBeat] } as any);

        expect(overlay.root.children).toHaveLength(2);
        expect(api.boundsLookup.findBeat).toHaveBeenCalledTimes(2);
        expect((overlay.root.children[0] as any).style).toMatchObject({ left: '10px', top: '16px', height: '38px' });
        expect((overlay.root.children[1] as any).style).toMatchObject({ left: '12px', top: '76px', height: '48px' });
    });

    it('falls back to another beat on the same staff when the first has no bounds', async () => {
        const { TempoCursorOverlay } = await import('../src/components/practice/TempoCursorOverlay');
        const staff = {};
        const missingBeat = { voice: { bar: { staff } } };
        const renderedBeat = { voice: { bar: { staff } } };
        const api = {
            boundsLookup: {
                findBeat: vi.fn((beat: object) =>
                    beat === renderedBeat ? { realBounds: { x: 24, y: 32, h: 20 } } : null
                )
            }
        };
        const host = new MockHTMLElement();
        const overlay = new TempoCursorOverlay(api as any, host as any);

        overlay.showItem({ beats: [missingBeat, renderedBeat] } as any);

        expect(overlay.root.children).toHaveLength(1);
        expect(api.boundsLookup.findBeat).toHaveBeenCalledTimes(2);
        expect((overlay.root.children[0] as any).style.left).toBe('24px');
    });
});
