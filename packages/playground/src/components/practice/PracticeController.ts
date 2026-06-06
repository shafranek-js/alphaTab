import type * as alphaTab from '@coderline/alphatab';

export interface PracticeNoteSource {
    realValue: number;
    isVisible?: boolean;
}

export interface PracticeBeatSource {
    notes: readonly PracticeNoteSource[];
    isRest: boolean;
}

export interface PracticeTickLookup<TBeat extends PracticeBeatSource> {
    getBeatStart(beat: TBeat): number;
}

export interface PracticeQueueItem<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    beat: TBeat;
    expectedNotes: number[];
    startTick: number;
}

export interface PracticeSessionState<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    running: boolean;
    complete: boolean;
    currentIndex: number;
    total: number;
    currentItem: PracticeQueueItem<TBeat> | null;
    matchedNotes: number[];
    ignoreOctave: boolean;
}

export type PracticeInputResult<TBeat extends PracticeBeatSource = PracticeBeatSource> =
    | { type: 'ignored'; state: PracticeSessionState<TBeat> }
    | { type: 'wrong'; inputNote: number; expectedNotes: number[]; state: PracticeSessionState<TBeat> }
    | { type: 'partial'; inputNote: number; matchedNote: number; state: PracticeSessionState<TBeat> }
    | { type: 'correct'; inputNote: number; item: PracticeQueueItem<TBeat>; state: PracticeSessionState<TBeat> }
    | { type: 'complete'; inputNote: number; item: PracticeQueueItem<TBeat>; state: PracticeSessionState<TBeat> };

export function buildPracticeQueue<TBeat extends PracticeBeatSource>(
    beats: Iterable<TBeat>,
    tickLookup?: PracticeTickLookup<TBeat> | null
): PracticeQueueItem<TBeat>[] {
    const items: PracticeQueueItem<TBeat>[] = [];
    let fallbackStartTick = 0;

    for (const beat of beats) {
        if (beat.isRest) {
            continue;
        }

        const expectedNotes = uniqueNotes(
            beat.notes.filter(note => note.isVisible !== false).map(note => note.realValue).filter(value => value > 0)
        );
        if (expectedNotes.length === 0) {
            continue;
        }

        items.push({
            beat,
            expectedNotes,
            startTick: tickLookup?.getBeatStart(beat) ?? fallbackStartTick
        });
        fallbackStartTick++;
    }

    return items.sort((a, b) => a.startTick - b.startTick);
}

export function getPlayableBeatsFromTracks(tracks: readonly alphaTab.model.Track[]): alphaTab.model.Beat[] {
    const beats: alphaTab.model.Beat[] = [];
    for (const track of tracks) {
        for (const staff of track.staves) {
            for (const bar of staff.bars) {
                for (const voice of bar.voices) {
                    beats.push(...voice.beats);
                }
            }
        }
    }
    return beats;
}

export class PracticeSession<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    private queue: PracticeQueueItem<TBeat>[] = [];
    private currentIndex = 0;
    private running = false;
    private complete = false;
    private matchedNotes = new Set<number>();
    private ignoreOctave = false;

    public setQueue(queue: PracticeQueueItem<TBeat>[]): void {
        this.queue = queue;
        this.reset();
    }

    public setIgnoreOctave(ignoreOctave: boolean): void {
        this.ignoreOctave = ignoreOctave;
        this.matchedNotes.clear();
    }

    public start(): PracticeSessionState<TBeat> {
        this.currentIndex = Math.min(this.currentIndex, Math.max(0, this.queue.length - 1));
        this.running = this.queue.length > 0;
        this.complete = this.queue.length === 0;
        this.matchedNotes.clear();
        return this.getState();
    }

    public stop(): PracticeSessionState<TBeat> {
        this.running = false;
        this.matchedNotes.clear();
        return this.getState();
    }

    public reset(): PracticeSessionState<TBeat> {
        this.currentIndex = 0;
        this.running = false;
        this.complete = false;
        this.matchedNotes.clear();
        return this.getState();
    }

    public handleMidiNote(inputNote: number): PracticeInputResult<TBeat> {
        const currentItem = this.queue[this.currentIndex];
        if (!this.running || !currentItem) {
            return { type: 'ignored', state: this.getState() };
        }

        const matchedNote = this.findMatchingExpectedNote(currentItem.expectedNotes, inputNote);
        if (matchedNote === null) {
            this.matchedNotes.clear();
            return {
                type: 'wrong',
                inputNote,
                expectedNotes: currentItem.expectedNotes,
                state: this.getState()
            };
        }

        this.matchedNotes.add(matchedNote);
        if (this.matchedNotes.size < currentItem.expectedNotes.length) {
            return {
                type: 'partial',
                inputNote,
                matchedNote,
                state: this.getState()
            };
        }

        const completedItem = currentItem;
        this.currentIndex++;
        this.matchedNotes.clear();
        if (this.currentIndex >= this.queue.length) {
            this.running = false;
            this.complete = true;
            return {
                type: 'complete',
                inputNote,
                item: completedItem,
                state: this.getState()
            };
        }

        return {
            type: 'correct',
            inputNote,
            item: completedItem,
            state: this.getState()
        };
    }

    public getState(): PracticeSessionState<TBeat> {
        return {
            running: this.running,
            complete: this.complete,
            currentIndex: this.currentIndex,
            total: this.queue.length,
            currentItem: this.queue[this.currentIndex] ?? null,
            matchedNotes: Array.from(this.matchedNotes),
            ignoreOctave: this.ignoreOctave
        };
    }

    private findMatchingExpectedNote(expectedNotes: number[], inputNote: number): number | null {
        const normalizedInput = this.normalize(inputNote);
        for (const expectedNote of expectedNotes) {
            if (this.matchedNotes.has(expectedNote)) {
                continue;
            }
            if (this.normalize(expectedNote) === normalizedInput) {
                return expectedNote;
            }
        }
        return null;
    }

    private normalize(note: number): number {
        return this.ignoreOctave ? note % 12 : note;
    }
}

function uniqueNotes(notes: number[]): number[] {
    return Array.from(new Set(notes)).sort((a, b) => a - b);
}
