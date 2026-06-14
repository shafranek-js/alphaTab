import { describe, expect, it, vi } from 'vitest';

// Mock the DOM APIs that PianoKeyboard uses
class MockElement {
    replaceChildren() {}
}
globalThis.Element = MockElement as any;

class MockHTMLElement extends MockElement {}
globalThis.HTMLElement = MockHTMLElement as any;

class MockHTMLButtonElement extends MockHTMLElement {}
globalThis.HTMLButtonElement = MockHTMLButtonElement as any;

class MockHTMLStyleElement extends MockHTMLElement {}
globalThis.HTMLStyleElement = MockHTMLStyleElement as any;

const mockElement = Object.create(HTMLElement.prototype);
mockElement.classList = {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn()
};
mockElement.querySelectorAll = vi.fn(() => []);
mockElement.querySelector = vi.fn(() => mockElement);
mockElement.appendChild = vi.fn();
mockElement.getAttribute = vi.fn();
mockElement.dataset = {};
mockElement.replaceChildren = vi.fn();
mockElement.remove = vi.fn();
mockElement.style = {};
mockElement.addEventListener = vi.fn();

globalThis.document = {
    createElement: vi.fn((tag) => {
        if (tag === 'template') {
            return {
                content: {
                    firstElementChild: mockElement
                },
                innerHTML: ''
            };
        }
        return {
            dataset: {},
            style: {},
            textContent: ''
        };
    }),
    adoptNode: vi.fn((el) => el),
    head: {
        querySelector: vi.fn(() => null),
        appendChild: vi.fn()
    }
} as any;

globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
} as any;

describe('PianoKeyboard live note queueing', () => {
    it('implements queueing for repeated notes', async () => {
        // Use dynamic import to avoid hoisting issues, ensuring document is mocked first
        const { PianoKeyboard } = await import('../src/components/PianoKeyboard');

        const mockPlayer = {
            playLiveNote: vi.fn(),
            stopLiveNote: vi.fn()
        };
        const mockApi = {
            scoreLoaded: { on: vi.fn(() => vi.fn()) },
            renderFinished: { on: vi.fn(() => vi.fn()) },
            playedBeatChanged: { on: vi.fn(() => vi.fn()) },
            playerStateChanged: { on: vi.fn(() => vi.fn()) },
            tracks: [
                {
                    playbackInfo: {
                        primaryChannel: 1
                    }
                }
            ],
            player: mockPlayer
        };

        const keyboard = new PianoKeyboard(mockApi as any);

        // 1. Play note 60 (first press)
        keyboard.playInputNote(60, 100, 1);
        expect(mockPlayer.playLiveNote).toHaveBeenLastCalledWith(1, 60, 100);
        expect(mockPlayer.playLiveNote).toHaveBeenCalledTimes(1);
        expect(mockPlayer.stopLiveNote).not.toHaveBeenCalled();

        // 2. Play note 60 (second press - overlap)
        keyboard.playInputNote(60, 100, 1);
        expect(mockPlayer.playLiveNote).toHaveBeenLastCalledWith(1, 60, 100);
        expect(mockPlayer.playLiveNote).toHaveBeenCalledTimes(2);
        expect(mockPlayer.stopLiveNote).not.toHaveBeenCalled();

        // 3. Stop note 60 (first release)
        keyboard.stopInputNote(60);
        // Should trigger stopLiveNote for the first channel (1)
        expect(mockPlayer.stopLiveNote).toHaveBeenLastCalledWith(1, 60);
        expect(mockPlayer.stopLiveNote).toHaveBeenCalledTimes(1);

        // 4. Stop note 60 (second release)
        keyboard.stopInputNote(60);
        // Should trigger stopLiveNote again for the second channel (1)
        expect(mockPlayer.stopLiveNote).toHaveBeenLastCalledWith(1, 60);
        expect(mockPlayer.stopLiveNote).toHaveBeenCalledTimes(2);
    });

    it('emits virtual note events for practice input', async () => {
        const { PianoKeyboard } = await import('../src/components/PianoKeyboard');

        const mockPlayer = {
            playLiveNote: vi.fn(),
            stopLiveNote: vi.fn(),
            playOneTimeMidiFile: vi.fn()
        };
        const mockApi = {
            scoreLoaded: { on: vi.fn(() => vi.fn()) },
            renderFinished: { on: vi.fn(() => vi.fn()) },
            playedBeatChanged: { on: vi.fn(() => vi.fn()) },
            playerStateChanged: { on: vi.fn(() => vi.fn()) },
            tracks: [],
            player: mockPlayer
        };

        const keyboard = new PianoKeyboard(mockApi as any);
        const noteOns: number[] = [];
        const noteOffs: number[] = [];
        keyboard.onVirtualNote(note => noteOns.push(note.note));
        keyboard.onVirtualNoteOff(note => noteOffs.push(note.note));

        (keyboard as any).playVirtualNote(60);
        (keyboard as any).stopVirtualNote(60);

        expect(noteOns).toEqual([60]);
        expect(noteOffs).toEqual([60]);
        expect(mockPlayer.playOneTimeMidiFile).not.toHaveBeenCalled();
    });
});
