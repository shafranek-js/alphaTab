import type * as alphaTab from '@coderline/alphatab';

export interface PracticeNoteSource {
    realValue: number;
    isVisible?: boolean;
    isTieDestination?: boolean;
    durationPercent?: number;
    tieDestination?: PracticeNoteSource | null;
    beat?: PracticeBeatSource;
}

export interface PracticeBeatSource {
    notes: readonly PracticeNoteSource[];
    isRest: boolean;
    absolutePlaybackStart?: number;
    playbackDuration?: number;
}

export interface PracticeTickLookup<TBeat extends PracticeBeatSource> {
    getBeatStart(beat: TBeat): number;
}

export interface PracticeQueueItem<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    beats: TBeat[];
    expectedNotes: number[];
    expectedNoteDetails: PracticeExpectedNote<TBeat>[];
    startTick: number;
    endTick: number;
}

export interface PracticeExpectedNote<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    note: number;
    endTick: number;
    beats: TBeat[];
}

export interface PracticeRequiredNote {
    note: number;
    endTick: number;
    fresh: boolean;
}

export interface PracticeRange {
    startTick: number;
    endTick: number;
}

export interface PracticeSessionState<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    running: boolean;
    complete: boolean;
    currentIndex: number;
    total: number;
    currentItem: PracticeQueueItem<TBeat> | null;
    matchedNotes: number[];
    pressedNotes: number[];
    requiredNotes: PracticeRequiredNote[];
    ignoreOctave: boolean;
    loopEnabled: boolean;
    currentPass: number;
    cleanPassStreak: number;
    wrongCount: number;
    lastPassWrongCount: number;
}

export type PracticeInputResult<TBeat extends PracticeBeatSource = PracticeBeatSource> =
    | { type: 'ignored'; state: PracticeSessionState<TBeat> }
    | { type: 'wrong'; inputNote: number; expectedNotes: number[]; state: PracticeSessionState<TBeat> }
    | { type: 'partial'; inputNote: number; matchedNote?: number; state: PracticeSessionState<TBeat> }
    | { type: 'correct'; inputNote: number; item: PracticeQueueItem<TBeat>; state: PracticeSessionState<TBeat> }
    | {
          type: 'looped';
          inputNote: number;
          item: PracticeQueueItem<TBeat>;
          clean: boolean;
          wrongCount: number;
          state: PracticeSessionState<TBeat>;
      }
    | { type: 'complete'; inputNote: number; item: PracticeQueueItem<TBeat>; state: PracticeSessionState<TBeat> };

export interface PerformSettings {
    startSpeed: number;
    targetSpeed: number;
    speedIncrement: number;
    cleanPassesRequired: number;
    timingWindowMs: number;
    ignoreOctave: boolean;
}

export interface PerformExpectedItem<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    sourceItem: PracticeQueueItem<TBeat>;
    pitch: number;
    startTick: number;
    expectedWallTimestampMs?: number;
    matched: boolean;
    timingMs?: number;
}

export interface PerformPassStats {
    passIndex: number;
    correctCount: number;
    wrongCount: number;
    missedCount: number;
    earlyCount: number;
    lateCount: number;
    expectedCount: number;
    clean: boolean;
}

export interface PerformState<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    running: boolean;
    scoringReady: boolean;
    currentPass: number;
    cleanPassStreak: number;
    speed: number;
    targetSpeed: number;
    lastPass: PerformPassStats | null;
    currentItem: PerformExpectedItem<TBeat> | null;
    expectedCount: number;
    correctCount: number;
    wrongCount: number;
    missedCount: number;
    earlyCount: number;
    lateCount: number;
}

export type PerformInputResult<TBeat extends PracticeBeatSource = PracticeBeatSource> =
    | { type: 'ignored'; state: PerformState<TBeat> }
    | { type: 'matched'; item: PerformExpectedItem<TBeat>; timingMs: number; state: PerformState<TBeat> }
    | { type: 'wrong'; inputNote: number; state: PerformState<TBeat> }
    | { type: 'missed'; items: PerformExpectedItem<TBeat>[]; state: PerformState<TBeat> };

export interface PerformPassResult<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    stats: PerformPassStats;
    missedItems: PerformExpectedItem<TBeat>[];
    speedChanged: boolean;
    state: PerformState<TBeat>;
}

export const defaultPerformSettings: PerformSettings = {
    startSpeed: 0.7,
    targetSpeed: 1,
    speedIncrement: 0.1,
    cleanPassesRequired: 3,
    timingWindowMs: 120,
    ignoreOctave: false
};

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

        const playableNotes = beat.notes.filter(note => note.isVisible !== false && note.isTieDestination !== true);
        if (playableNotes.length === 0) {
            continue;
        }

        const startTick = getBeatStartTick(beat, fallbackStartTick, tickLookup);
        const noteEndTicks = new Map<number, number>();
        for (const note of playableNotes) {
            if (note.realValue <= 0) {
                continue;
            }

            const endTick = getNoteEndTick(note, beat, startTick);
            noteEndTicks.set(note.realValue, Math.max(noteEndTicks.get(note.realValue) ?? Number.NEGATIVE_INFINITY, endTick));
        }

        if (noteEndTicks.size === 0) {
            continue;
        }

        const expectedNotes = Array.from(noteEndTicks.keys());
        const expectedNoteDetails = expectedNotes.map(note => ({ note, endTick: noteEndTicks.get(note)!, beats: [beat] }));

        items.push({
            beats: [beat],
            expectedNotes,
            expectedNoteDetails,
            startTick,
            endTick: Math.max(startTick + getBeatPlaybackDuration(beat), ...expectedNoteDetails.map(note => note.endTick))
        });
        fallbackStartTick++;
    }

    const grouped = new Map<number, PracticeQueueItem<TBeat>>();
    for (const item of items) {
        const existing = grouped.get(item.startTick);
        if (!existing) {
            grouped.set(item.startTick, item);
            continue;
        }

        for (const beat of item.beats) {
            if (!existing.beats.includes(beat)) {
                existing.beats.push(beat);
            }
        }
        for (const detail of item.expectedNoteDetails) {
            const existingDetail = existing.expectedNoteDetails.find(candidate => candidate.note === detail.note);
            if (!existingDetail) {
                existing.expectedNoteDetails.push({ ...detail, beats: [...detail.beats] });
                existing.expectedNotes.push(detail.note);
                continue;
            }

            existingDetail.endTick = Math.max(existingDetail.endTick, detail.endTick);
            for (const beat of detail.beats) {
                if (!existingDetail.beats.includes(beat)) {
                    existingDetail.beats.push(beat);
                }
            }
        }
        existing.endTick = Math.max(
            existing.endTick,
            item.endTick,
            ...existing.expectedNoteDetails.map(note => note.endTick)
        );
    }

    return Array.from(grouped.values()).sort((a, b) => a.startTick - b.startTick);
}

function getBeatStartTick<TBeat extends PracticeBeatSource>(
    beat: TBeat,
    fallbackStartTick: number,
    tickLookup?: PracticeTickLookup<TBeat> | null
): number {
    if (typeof beat.absolutePlaybackStart === 'number') {
        return beat.absolutePlaybackStart;
    }

    const cacheTick = tickLookup?.getBeatStart(beat);
    if (typeof cacheTick === 'number' && cacheTick >= 0) {
        return cacheTick;
    }

    return fallbackStartTick;
}

function getBeatPlaybackDuration(beat: PracticeBeatSource): number {
    return typeof beat.playbackDuration === 'number' && beat.playbackDuration > 0 ? beat.playbackDuration : 1;
}

function getNoteEndTick(note: PracticeNoteSource, beat: PracticeBeatSource, startTick: number): number {
    let endTick = startTick + getNotePlaybackDuration(note, beat);
    const visited = new Set<PracticeNoteSource>();
    let tieDestination = note.tieDestination;

    while (tieDestination && !visited.has(tieDestination)) {
        visited.add(tieDestination);
        const destinationBeat = tieDestination.beat;
        if (!destinationBeat) {
            break;
        }

        const destinationStart =
            typeof destinationBeat.absolutePlaybackStart === 'number' ? destinationBeat.absolutePlaybackStart : endTick;
        endTick = Math.max(endTick, destinationStart + getNotePlaybackDuration(tieDestination, destinationBeat));
        tieDestination = tieDestination.tieDestination;
    }

    return endTick;
}

function getNotePlaybackDuration(note: PracticeNoteSource, beat: PracticeBeatSource): number {
    const duration = getBeatPlaybackDuration(beat);
    return Math.max(1, duration * (note.durationPercent ?? 1));
}

export function filterPracticeQueueByRange<TBeat extends PracticeBeatSource>(
    queue: PracticeQueueItem<TBeat>[],
    range?: PracticeRange | null
): PracticeQueueItem<TBeat>[] {
    if (!range) {
        return queue;
    }
    return queue.filter(item => item.startTick >= range.startTick && item.startTick < range.endTick);
}

export function resolvePracticeInputChannel<TBeat extends PracticeBeatSource>(
    item: PracticeQueueItem<TBeat> | null,
    inputNote: number,
    ignoreOctave: boolean,
    getChannel: (beat: TBeat) => number | undefined,
    fallbackChannel: number
): number {
    const normalizedInput = ignoreOctave ? inputNote % 12 : inputNote;
    const detail = item?.expectedNoteDetails.find(expected => {
        const normalizedExpected = ignoreOctave ? expected.note % 12 : expected.note;
        return normalizedExpected === normalizedInput;
    });
    const sourceBeat = detail?.beats[0] ?? item?.beats[0] ?? null;
    return sourceBeat ? (getChannel(sourceBeat) ?? fallbackChannel) : fallbackChannel;
}

export function selectTempoCursorItem<TBeat extends PracticeBeatSource>(
    queue: readonly PracticeQueueItem<TBeat>[],
    currentTick: number,
    completed = false
): PracticeQueueItem<TBeat> | null {
    if (completed || queue.length === 0) {
        return null;
    }

    if (currentTick < queue[0].startTick) {
        return null;
    }

    let current = queue[0];
    for (const item of queue) {
        if (item.startTick > currentTick) {
            break;
        }
        current = item;
    }
    return current;
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
    private pressedNotes = new Map<number, number>();
    private activeRequiredNotes: PracticeRequiredNote[] = [];
    private activeRequiredIndex = -1;
    private penalizedWrongNotes = new Set<number>();
    private ignoreOctave = false;
    private loopEnabled = false;
    private currentPass = 1;
    private cleanPassStreak = 0;
    private wrongCount = 0;
    private lastPassWrongCount = 0;

    public setQueue(queue: PracticeQueueItem<TBeat>[]): void {
        this.queue = queue;
        this.reset();
    }

    public setIgnoreOctave(ignoreOctave: boolean): void {
        this.ignoreOctave = ignoreOctave;
        this.clearPressedNotes();
    }

    public setLoopEnabled(loopEnabled: boolean): void {
        this.loopEnabled = loopEnabled;
        this.resetLoopStats();
    }

    public resetLoopStats(): void {
        this.currentPass = this.running ? Math.max(1, this.currentPass) : 1;
        this.cleanPassStreak = 0;
        this.wrongCount = 0;
        this.lastPassWrongCount = 0;
    }

    public seekToTick(tick: number): void {
        this.clearPressedNotes();
        this.clearActiveRequiredNotes();
        if (this.queue.length === 0) {
            this.currentIndex = 0;
            return;
        }

        let targetIndex = 0;
        let minDiff = Number.POSITIVE_INFINITY;

        for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];
            const diff = Math.abs(item.startTick - tick);
            if (diff < minDiff) {
                minDiff = diff;
                targetIndex = i;
            }
        }

        this.currentIndex = targetIndex;
        if (this.running) {
            this.setActiveRequiredForIndex(this.currentIndex);
        }
    }

    public start(): PracticeSessionState<TBeat> {
        this.currentIndex = Math.min(this.currentIndex, Math.max(0, this.queue.length - 1));
        this.running = this.queue.length > 0;
        this.complete = this.queue.length === 0;
        this.clearPressedNotes();
        if (this.running) {
            this.setActiveRequiredForIndex(this.currentIndex);
        } else {
            this.clearActiveRequiredNotes();
        }
        return this.getState();
    }

    public stop(): PracticeSessionState<TBeat> {
        this.running = false;
        this.clearPressedNotes();
        this.clearActiveRequiredNotes();
        return this.getState();
    }

    public reset(): PracticeSessionState<TBeat> {
        this.currentIndex = 0;
        this.running = false;
        this.complete = false;
        this.clearPressedNotes();
        this.clearActiveRequiredNotes();
        this.currentPass = 1;
        this.cleanPassStreak = 0;
        this.wrongCount = 0;
        this.lastPassWrongCount = 0;
        return this.getState();
    }

    public handleMidiNote(inputNote: number): PracticeInputResult<TBeat> {
        const currentItem = this.queue[this.currentIndex];
        if (!this.running || !currentItem) {
            return { type: 'ignored', state: this.getState() };
        }

        const wasAlreadyPressed = this.pressedNotes.has(inputNote);
        this.pressedNotes.set(inputNote, wasAlreadyPressed ? this.pressedNotes.get(inputNote)! : 0);
        if (
            !wasAlreadyPressed &&
            this.isNewWrongNote(inputNote) &&
            !this.penalizedWrongNotes.has(inputNote)
        ) {
            this.wrongCount++;
            this.penalizedWrongNotes.add(inputNote);
        }

        return this.evaluateHeldState(inputNote);
    }

    public handleMidiNoteOff(inputNote: number): PracticeInputResult<TBeat> {
        this.pressedNotes.delete(inputNote);
        this.penalizedWrongNotes.delete(inputNote);
        const currentItem = this.queue[this.currentIndex];
        if (!this.running || !currentItem) {
            return { type: 'ignored', state: this.getState() };
        }

        return this.evaluateHeldState(inputNote);
    }

    public clearPressedNotes(): void {
        this.pressedNotes.clear();
        this.penalizedWrongNotes.clear();
    }

    private evaluateHeldState(inputNote: number): PracticeInputResult<TBeat> {
        const currentItem = this.queue[this.currentIndex];
        if (!this.running || !currentItem) {
            return { type: 'ignored', state: this.getState() };
        }

        this.ensureActiveRequiredForCurrentItem();
        const comparison = this.compareHeldState(currentItem);
        if (comparison.hasExtraNotes) {
            return {
                type: 'wrong',
                inputNote,
                expectedNotes: currentItem.expectedNotes,
                state: this.getState()
            };
        }

        if (!comparison.isComplete) {
            return {
                type: 'partial',
                inputNote,
                state: this.getState()
            };
        }

        const completedItem = currentItem;
        this.currentIndex++;
        this.incrementPressedAges();
        this.penalizedWrongNotes.clear();
        if (this.currentIndex >= this.queue.length) {
            if (this.loopEnabled) {
                const wrongCount = this.wrongCount;
                const clean = wrongCount === 0;
                this.lastPassWrongCount = wrongCount;
                this.cleanPassStreak = clean ? this.cleanPassStreak + 1 : 0;
                this.wrongCount = 0;
                this.currentPass++;
                this.currentIndex = 0;
                this.running = true;
                this.complete = false;
                this.setActiveRequiredForIndex(this.currentIndex);
                return {
                    type: 'looped',
                    inputNote,
                    item: completedItem,
                    clean,
                    wrongCount,
                    state: this.getState()
                };
            }
            this.running = false;
            this.complete = true;
            this.clearActiveRequiredNotes();
            return {
                type: 'complete',
                inputNote,
                item: completedItem,
                state: this.getState()
            };
        }

        this.advanceActiveRequiredToIndex(this.currentIndex);
        return {
            type: 'correct',
            inputNote,
            item: completedItem,
            state: this.getState()
        };
    }

    public getState(): PracticeSessionState<TBeat> {
        const currentItem = this.queue[this.currentIndex] ?? null;
        return {
            running: this.running,
            complete: this.complete,
            currentIndex: this.currentIndex,
            total: this.queue.length,
            currentItem,
            matchedNotes: currentItem ? this.getMatchedNotes(currentItem) : [],
            pressedNotes: Array.from(this.pressedNotes.keys()),
            requiredNotes: this.running ? this.activeRequiredNotes.map(note => ({ ...note })) : [],
            ignoreOctave: this.ignoreOctave,
            loopEnabled: this.loopEnabled,
            currentPass: this.currentPass,
            cleanPassStreak: this.cleanPassStreak,
            wrongCount: this.wrongCount,
            lastPassWrongCount: this.lastPassWrongCount
        };
    }

    private compareHeldState(currentItem: PracticeQueueItem<TBeat>): { hasExtraNotes: boolean; isComplete: boolean } {
        const pressedCounts = this.countNormalized(this.pressedNotes.keys());
        const requiredCounts = this.countNormalized(this.activeRequiredNotes.map(note => note.note));

        for (const [note, pressedCount] of pressedCounts) {
            if (pressedCount > (requiredCounts.get(note) ?? 0)) {
                return { hasExtraNotes: true, isComplete: false };
            }
        }

        const freshPressedCounts = this.countNormalized(this.getFreshPressedNotes());
        const freshRequiredCounts = this.countNormalized(currentItem.expectedNotes);
        for (const [note, expectedCount] of freshRequiredCounts) {
            if ((freshPressedCounts.get(note) ?? 0) < expectedCount) {
                return { hasExtraNotes: false, isComplete: false };
            }
        }

        return { hasExtraNotes: false, isComplete: true };
    }

    private getMatchedNotes(currentItem: PracticeQueueItem<TBeat>): number[] {
        const remainingPressedCounts = this.countNormalized(this.getFreshPressedNotes());
        const matchedNotes: number[] = [];
        for (const expectedNote of currentItem.expectedNotes) {
            const normalized = this.normalize(expectedNote);
            const remaining = remainingPressedCounts.get(normalized) ?? 0;
            if (remaining > 0) {
                matchedNotes.push(expectedNote);
                remainingPressedCounts.set(normalized, remaining - 1);
            }
        }
        return matchedNotes;
    }

    private isNewWrongNote(inputNote: number): boolean {
        this.ensureActiveRequiredForCurrentItem();
        const pressedCounts = this.countNormalized(this.pressedNotes.keys());
        const expectedCounts = this.countNormalized(this.activeRequiredNotes.map(note => note.note));
        const normalizedInput = this.normalize(inputNote);
        return (pressedCounts.get(normalizedInput) ?? 0) > (expectedCounts.get(normalizedInput) ?? 0);
    }

    private ensureActiveRequiredForCurrentItem(): void {
        if (this.activeRequiredIndex !== this.currentIndex) {
            this.setActiveRequiredForIndex(this.currentIndex);
        }
    }

    private setActiveRequiredForIndex(index: number): void {
        this.activeRequiredNotes = [];
        this.activeRequiredIndex = index;
        const item = this.queue[index];
        if (item) {
            this.addFreshRequiredNotes(item);
        }
    }

    private advanceActiveRequiredToIndex(index: number): void {
        const item = this.queue[index];
        if (!item) {
            this.clearActiveRequiredNotes();
            return;
        }

        this.activeRequiredNotes = this.activeRequiredNotes
            .filter(note => note.endTick > item.startTick)
            .map(note => ({ ...note, fresh: false }));
        this.activeRequiredIndex = index;
        this.addFreshRequiredNotes(item);
    }

    private addFreshRequiredNotes(item: PracticeQueueItem<TBeat>): void {
        for (const note of item.expectedNoteDetails) {
            this.activeRequiredNotes.push({
                note: note.note,
                endTick: note.endTick,
                fresh: true
            });
        }
    }

    private clearActiveRequiredNotes(): void {
        this.activeRequiredNotes = [];
        this.activeRequiredIndex = -1;
    }

    private incrementPressedAges(): void {
        for (const [note, age] of this.pressedNotes) {
            this.pressedNotes.set(note, age + 1);
        }
    }

    private getFreshPressedNotes(): number[] {
        const notes: number[] = [];
        for (const [note, age] of this.pressedNotes) {
            if (age === 0) {
                notes.push(note);
            }
        }
        return notes;
    }

    private countNormalized(notes: Iterable<number>): Map<number, number> {
        const counts = new Map<number, number>();
        for (const note of notes) {
            const normalized = this.normalize(note);
            counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        }
        return counts;
    }

    private normalize(note: number): number {
        return this.ignoreOctave ? note % 12 : note;
    }
}

export class PerformSession<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    private items: PerformExpectedItem<TBeat>[] = [];
    private settings: PerformSettings = { ...defaultPerformSettings };
    private running = false;
    private currentPass = 1;
    private cleanPassStreak = 0;
    private speed = defaultPerformSettings.startSpeed;
    private lastPass: PerformPassStats | null = null;
    private correctCount = 0;
    private wrongCount = 0;
    private missedCount = 0;
    private earlyCount = 0;
    private lateCount = 0;
    private lastCompletedBoundary = Number.NEGATIVE_INFINITY;

    public configure(settings: Partial<PerformSettings>): void {
        this.settings = { ...this.settings, ...settings };
        if (!this.running) {
            this.speed = this.settings.startSpeed;
        }
    }

    public start(items: PerformExpectedItem<TBeat>[]): PerformState<TBeat> {
        this.items = items.map(item => ({ ...item, matched: false, timingMs: undefined }));
        this.running = this.items.length > 0;
        this.currentPass = 1;
        this.cleanPassStreak = 0;
        this.speed = this.settings.startSpeed;
        this.lastPass = null;
        this.resetPassCounts();
        this.lastCompletedBoundary = Number.NEGATIVE_INFINITY;
        return this.getState();
    }

    public stop(): PerformState<TBeat> {
        this.running = false;
        return this.getState();
    }

    public resetStats(): PerformState<TBeat> {
        this.currentPass = 1;
        this.cleanPassStreak = 0;
        this.lastPass = null;
        this.resetPassCounts();
        for (const item of this.items) {
            item.matched = false;
            item.timingMs = undefined;
        }
        return this.getState();
    }

    public setExpectedWallTimestamps(timestamps: Map<number, number>): void {
        for (const item of this.items) {
            const wallTime = timestamps.get(item.startTick);
            if (typeof wallTime === 'number' && Number.isFinite(wallTime)) {
                item.expectedWallTimestampMs = wallTime;
            }
        }
    }

    public clearExpectedWallTimestamps(): void {
        for (const item of this.items) {
            item.expectedWallTimestampMs = undefined;
        }
    }

    public advancePosition(_currentTick: number, wallTimestampMs: number): PerformInputResult<TBeat> {
        if (!this.running || !this.isScoringReady()) {
            return { type: 'ignored', state: this.getState() };
        }

        const missed = this.collectMissed(wallTimestampMs);
        if (missed.length > 0) {
            return { type: 'missed', items: missed, state: this.getState() };
        }

        return { type: 'ignored', state: this.getState() };
    }

    public handleNoteOn(inputNote: number, timestampMs: number): PerformInputResult<TBeat> {
        if (!this.running || !this.isScoringReady()) {
            return { type: 'ignored', state: this.getState() };
        }

        const normalizedInput = this.normalize(inputNote);
        const candidates = this.items
            .filter(
                item =>
                    !item.matched &&
                    item.expectedWallTimestampMs !== undefined &&
                    this.normalize(item.pitch) === normalizedInput &&
                    Math.abs(timestampMs - item.expectedWallTimestampMs) <= this.settings.timingWindowMs
            )
            .sort((a, b) => this.compareMatchCandidate(a, b, timestampMs));

        const match = candidates[0];
        if (!match) {
            if (this.hasActiveWindow(timestampMs)) {
                this.wrongCount++;
                this.cleanPassStreak = 0;
                return { type: 'wrong', inputNote, state: this.getState() };
            }
            return { type: 'ignored', state: this.getState() };
        }

        const timingMs = timestampMs - match.expectedWallTimestampMs!;
        match.matched = true;
        match.timingMs = timingMs;
        this.correctCount++;
        if (timingMs < 0) {
            this.earlyCount++;
        } else if (timingMs > 0) {
            this.lateCount++;
        }

        return { type: 'matched', item: match, timingMs, state: this.getState() };
    }

    public completePass(boundaryToken: number): PerformPassResult<TBeat> | null {
        if (!this.running || boundaryToken === this.lastCompletedBoundary) {
            return null;
        }
        this.lastCompletedBoundary = boundaryToken;

        const missedItems = this.items.filter(item => !item.matched);
        this.missedCount += missedItems.length;
        const stats: PerformPassStats = {
            passIndex: this.currentPass,
            correctCount: this.correctCount,
            wrongCount: this.wrongCount,
            missedCount: this.missedCount,
            earlyCount: this.earlyCount,
            lateCount: this.lateCount,
            expectedCount: this.items.length,
            clean: this.wrongCount === 0 && this.missedCount === 0 && this.correctCount === this.items.length
        };

        this.lastPass = stats;
        this.cleanPassStreak = stats.clean ? this.cleanPassStreak + 1 : 0;
        let speedChanged = false;
        if (this.cleanPassStreak >= this.settings.cleanPassesRequired) {
            const nextSpeed = Math.min(
                this.settings.targetSpeed,
                roundToStep(this.speed * (1 + this.settings.speedIncrement), 0.1)
            );
            if (nextSpeed !== this.speed) {
                this.speed = nextSpeed;
                speedChanged = true;
            }
            this.cleanPassStreak = 0;
        }

        this.currentPass++;
        this.resetPassItems();
        this.resetPassCounts();

        return { stats, missedItems, speedChanged, state: this.getState() };
    }

    public getState(): PerformState<TBeat> {
        return {
            running: this.running,
            scoringReady: this.isScoringReady(),
            currentPass: this.currentPass,
            cleanPassStreak: this.cleanPassStreak,
            speed: this.speed,
            targetSpeed: this.settings.targetSpeed,
            lastPass: this.lastPass,
            currentItem: this.getCurrentItem(),
            expectedCount: this.items.length,
            correctCount: this.correctCount,
            wrongCount: this.wrongCount,
            missedCount: this.missedCount,
            earlyCount: this.earlyCount,
            lateCount: this.lateCount
        };
    }

    public getExpectedItems(): readonly PerformExpectedItem<TBeat>[] {
        return this.items;
    }

    private resetPassCounts(): void {
        this.correctCount = 0;
        this.wrongCount = 0;
        this.missedCount = 0;
        this.earlyCount = 0;
        this.lateCount = 0;
    }

    private resetPassItems(): void {
        for (const item of this.items) {
            item.matched = false;
            item.timingMs = undefined;
        }
    }

    private collectMissed(wallTimestampMs: number): PerformExpectedItem<TBeat>[] {
        const missed: PerformExpectedItem<TBeat>[] = [];
        for (const item of this.items) {
            if (
                !item.matched &&
                item.expectedWallTimestampMs !== undefined &&
                wallTimestampMs > item.expectedWallTimestampMs + this.settings.timingWindowMs
            ) {
                item.matched = true;
                missed.push(item);
            }
        }
        this.missedCount += missed.length;
        if (missed.length > 0) {
            this.cleanPassStreak = 0;
        }
        return missed;
    }

    private hasActiveWindow(timestampMs: number): boolean {
        return this.items.some(
            item =>
                !item.matched &&
                item.expectedWallTimestampMs !== undefined &&
                Math.abs(timestampMs - item.expectedWallTimestampMs) <= this.settings.timingWindowMs
        );
    }

    private compareMatchCandidate(
        a: PerformExpectedItem<TBeat>,
        b: PerformExpectedItem<TBeat>,
        timestampMs: number
    ): number {
        const aOverdue = timestampMs >= a.expectedWallTimestampMs! ? 0 : 1;
        const bOverdue = timestampMs >= b.expectedWallTimestampMs! ? 0 : 1;
        if (aOverdue !== bOverdue) {
            return aOverdue - bOverdue;
        }

        const delta = Math.abs(timestampMs - a.expectedWallTimestampMs!) - Math.abs(timestampMs - b.expectedWallTimestampMs!);
        if (delta !== 0) {
            return delta;
        }
        return a.startTick - b.startTick;
    }

    private getCurrentItem(): PerformExpectedItem<TBeat> | null {
        return this.items.find(item => !item.matched) ?? this.items[0] ?? null;
    }

    private isScoringReady(): boolean {
        return this.items.some(item => !item.matched && item.expectedWallTimestampMs !== undefined);
    }

    private normalize(note: number): number {
        return this.settings.ignoreOctave ? note % 12 : note;
    }
}

function roundToStep(value: number, step: number): number {
    return Math.round(value / step) * step;
}

export const findBestPianoTransposeIntervals = (midiNumbers: number[]): number[] => {
    // Оставляем только уникальные ноты мелодии
    const uniqueMidi = Array.from(new Set(midiNumbers));
    if (uniqueMidi.length === 0) {
        return [];
    }

    // Диапазон стандартного пианино (88 клавиш)
    const PIANO_MIN_MIDI = 21; // A0
    const PIANO_MAX_MIDI = 108; // C8

    // Индексы черных клавиш в октаве (До=0, До-диез=1, Ре=2, Ре-диез=3...)
    const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

    const results: {
        interval: number;
        unplayableCount: number; // Ноты за пределами клавиатуры
        blackKeyCount: number; // Диезы и бемоли
    }[] = [];

    let minUnplayableCount = Number.POSITIVE_INFINITY;

    // Ищем в диапазоне 3 октав (от -36 до +36), чтобы дать музыканту
    // возможность выбрать удобную октаву
    for (let interval = -36; interval <= 36; interval += 1) {
        let unplayableCount = 0;
        let blackKeyCount = 0;

        for (const midi of uniqueMidi) {
            const transposedMidi = midi + interval;

            // 1. Проверяем, не выпала ли нота за пределы пианино
            if (transposedMidi < PIANO_MIN_MIDI || transposedMidi > PIANO_MAX_MIDI) {
                unplayableCount += 1;
                continue; // Если нота вообще не влезает, дальше не считаем
            }

            // 2. Проверяем, черная ли это клавиша (с корректной обработкой отрицательного остатка)
            const pitchClass = ((transposedMidi % 12) + 12) % 12;
            if (BLACK_KEYS.has(pitchClass)) {
                blackKeyCount += 1;
            }
        }

        results.push({ interval, unplayableCount, blackKeyCount });
        if (unplayableCount < minUnplayableCount) {
            minUnplayableCount = unplayableCount;
        }
    }

    // Фильтруем результаты, оставляя те, что максимально влезают в клавиатуру
    const playableResults = results.filter(r => r.unplayableCount === minUnplayableCount);
    if (playableResults.length === 0) {
        return [];
    }

    // Среди них находим минимальное количество черных клавиш
    const minBlackKeyCount = Math.min(...playableResults.map(r => r.blackKeyCount));

    // Возвращаем идеальные интервалы сдвига (сортируя от ближайшего к 0)
    return playableResults
        .filter(r => r.blackKeyCount === minBlackKeyCount)
        .map(r => r.interval)
        .sort((a, b) => Math.abs(a) - Math.abs(b));
};
