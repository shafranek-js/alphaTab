import type * as alphaTab from '@coderline/alphatab';

export interface PracticeNoteSource {
    realValue: number;
    isVisible?: boolean;
    isTieDestination?: boolean;
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

export interface LoopTrainerRange {
    startTick: number;
    endTick: number;
}

export interface LoopTrainerSettings {
    startSpeed: number;
    targetSpeed: number;
    speedIncrement: number;
    cleanPassesRequired: number;
}

export interface LoopTrainerPassStats {
    passIndex: number;
    wrongCount: number;
    missedCount: number;
    matchedCount: number;
    expectedCount: number;
    clean: boolean;
}

export interface LoopTrainerState {
    running: boolean;
    currentPass: number;
    cleanPassStreak: number;
    speed: number;
    targetSpeed: number;
    lastPass: LoopTrainerPassStats | null;
}

export interface LoopTrainerExpectedItem<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    id: number;
    beat: TBeat;
    pitch: number;
    startTick: number;
    matched: boolean;
}

export type LoopTrainerInputResult<TBeat extends PracticeBeatSource = PracticeBeatSource> =
    | { type: 'ignored'; state: LoopTrainerState }
    | { type: 'duplicate'; item: LoopTrainerExpectedItem<TBeat>; state: LoopTrainerState }
    | { type: 'matched'; item: LoopTrainerExpectedItem<TBeat>; state: LoopTrainerState }
    | { type: 'wrong'; inputNote: number; expectedNotes: number[]; state: LoopTrainerState };

export interface LoopTrainerPassResult<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    stats: LoopTrainerPassStats;
    missedItems: LoopTrainerExpectedItem<TBeat>[];
    speedChanged: boolean;
}

export const defaultLoopTrainerSettings: LoopTrainerSettings = {
    startSpeed: 0.7,
    targetSpeed: 1,
    speedIncrement: 0.1,
    cleanPassesRequired: 3
};

const defaultLoopTrainerMatchWindowTicks = 240;

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
            beat.notes
                .filter(note => note.isVisible !== false && note.isTieDestination !== true)
                .map(note => note.realValue)
                .filter(value => value > 0)
        );
        if (expectedNotes.length === 0) {
            continue;
        }

        let startTick = (beat as any).absolutePlaybackStart;
        if (typeof startTick !== 'number') {
            const cacheTick = tickLookup?.getBeatStart(beat);
            startTick = typeof cacheTick === 'number' && cacheTick > 0 ? cacheTick : fallbackStartTick;
        }

        items.push({
            beat,
            expectedNotes,
            startTick
        });
        fallbackStartTick++;
    }

    return items.sort((a, b) => a.startTick - b.startTick);
}

export function buildLoopTrainerQueue<TBeat extends PracticeBeatSource>(
    beats: Iterable<TBeat>,
    tickLookup?: PracticeTickLookup<TBeat> | null,
    range?: LoopTrainerRange | null
): LoopTrainerExpectedItem<TBeat>[] {
    const expected: LoopTrainerExpectedItem<TBeat>[] = [];
    const practiceQueue = buildPracticeQueue(beats, tickLookup);

    for (const item of practiceQueue) {
        if (range && (item.startTick < range.startTick || item.startTick >= range.endTick)) {
            continue;
        }
        for (const pitch of item.expectedNotes) {
            expected.push({
                id: expected.length,
                beat: item.beat,
                pitch,
                startTick: item.startTick,
                matched: false
            });
        }
    }

    return expected;
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

    public seekToTick(tick: number): void {
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

export class LoopTrainerSession<TBeat extends PracticeBeatSource = PracticeBeatSource> {
    private queue: LoopTrainerExpectedItem<TBeat>[] = [];
    private running = false;
    private currentPass = 0;
    private cleanPassStreak = 0;
    private speed: number;
    private targetSpeed: number;
    private lastPass: LoopTrainerPassStats | null = null;
    private wrongCount = 0;
    private lastTick: number | null = null;
    private settings: LoopTrainerSettings;

    public constructor(
        settings: Partial<LoopTrainerSettings> = {},
        private matchWindowTicks: number = defaultLoopTrainerMatchWindowTicks
    ) {
        this.settings = normalizeLoopTrainerSettings(settings);
        this.speed = this.settings.startSpeed;
        this.targetSpeed = this.settings.targetSpeed;
    }

    public configure(settings: Partial<LoopTrainerSettings>): void {
        this.settings = normalizeLoopTrainerSettings(settings);
        this.speed = this.settings.startSpeed;
        this.targetSpeed = this.settings.targetSpeed;
    }

    public start(queue: LoopTrainerExpectedItem<TBeat>[]): LoopTrainerState {
        this.queue = queue.map(item => ({ ...item, matched: false }));
        this.running = this.queue.length > 0;
        this.currentPass = this.running ? 1 : 0;
        this.cleanPassStreak = 0;
        this.speed = this.settings.startSpeed;
        this.targetSpeed = this.settings.targetSpeed;
        this.lastPass = null;
        this.wrongCount = 0;
        this.lastTick = null;
        return this.getState();
    }

    public stop(): LoopTrainerState {
        this.running = false;
        this.lastTick = null;
        return this.getState();
    }

    public resetStats(): LoopTrainerState {
        this.currentPass = this.running ? 1 : 0;
        this.cleanPassStreak = 0;
        this.lastPass = null;
        this.wrongCount = 0;
        this.resetMatched();
        return this.getState();
    }

    public updateTick(tick: number): LoopTrainerPassResult<TBeat> | null {
        if (!this.running) {
            return null;
        }

        const wrapped = this.lastTick !== null && tick < this.lastTick;
        this.lastTick = tick;
        return wrapped ? this.finishPass() : null;
    }

    public handleMidiNote(inputNote: number, tick: number): LoopTrainerInputResult<TBeat> {
        if (!this.running) {
            return { type: 'ignored', state: this.getState() };
        }

        const candidates = this.findCandidates(tick);
        if (candidates.length === 0) {
            return { type: 'ignored', state: this.getState() };
        }

        const unmatchedMatch = candidates.find(item => !item.matched && item.pitch === inputNote);
        if (unmatchedMatch) {
            unmatchedMatch.matched = true;
            return { type: 'matched', item: unmatchedMatch, state: this.getState() };
        }

        const duplicateMatch = candidates.find(item => item.matched && item.pitch === inputNote);
        if (duplicateMatch) {
            return { type: 'duplicate', item: duplicateMatch, state: this.getState() };
        }

        this.wrongCount++;
        return {
            type: 'wrong',
            inputNote,
            expectedNotes: uniqueNotes(candidates.map(item => item.pitch)),
            state: this.getState()
        };
    }

    public getState(): LoopTrainerState {
        return {
            running: this.running,
            currentPass: this.currentPass,
            cleanPassStreak: this.cleanPassStreak,
            speed: this.speed,
            targetSpeed: this.targetSpeed,
            lastPass: this.lastPass
        };
    }

    public getExpectedItems(): readonly LoopTrainerExpectedItem<TBeat>[] {
        return this.queue;
    }

    public getCurrentItem(tick: number): LoopTrainerExpectedItem<TBeat> | null {
        if (this.queue.length === 0) {
            return null;
        }

        let best: LoopTrainerExpectedItem<TBeat> | null = null;
        let bestDiff = Number.POSITIVE_INFINITY;
        for (const item of this.queue) {
            const diff = Math.abs(item.startTick - tick);
            if (diff < bestDiff) {
                best = item;
                bestDiff = diff;
            }
        }
        return best;
    }

    private findCandidates(tick: number): LoopTrainerExpectedItem<TBeat>[] {
        return this.queue.filter(item => Math.abs(item.startTick - tick) <= this.matchWindowTicks);
    }

    private finishPass(): LoopTrainerPassResult<TBeat> {
        const missedItems = this.queue.filter(item => !item.matched);
        const matchedCount = this.queue.length - missedItems.length;
        const stats: LoopTrainerPassStats = {
            passIndex: this.currentPass,
            wrongCount: this.wrongCount,
            missedCount: missedItems.length,
            matchedCount,
            expectedCount: this.queue.length,
            clean: this.wrongCount === 0 && missedItems.length === 0 && matchedCount === this.queue.length
        };

        this.lastPass = stats;
        let speedChanged = false;
        if (stats.clean) {
            this.cleanPassStreak++;
            if (this.cleanPassStreak >= this.settings.cleanPassesRequired) {
                const nextSpeed = Math.min(
                    this.targetSpeed,
                    roundToStep(this.speed * (1 + this.settings.speedIncrement), 0.1)
                );
                if (nextSpeed !== this.speed) {
                    this.speed = nextSpeed;
                    speedChanged = true;
                }
                this.cleanPassStreak = 0;
            }
        } else {
            this.cleanPassStreak = 0;
        }

        this.currentPass++;
        this.wrongCount = 0;
        this.resetMatched();

        return {
            stats,
            missedItems,
            speedChanged
        };
    }

    private resetMatched(): void {
        for (const item of this.queue) {
            item.matched = false;
        }
    }
}

function uniqueNotes(notes: number[]): number[] {
    return Array.from(new Set(notes)).sort((a, b) => a - b);
}

function normalizeLoopTrainerSettings(settings: Partial<LoopTrainerSettings>): LoopTrainerSettings {
    return {
        startSpeed: clampSpeed(settings.startSpeed ?? defaultLoopTrainerSettings.startSpeed),
        targetSpeed: clampSpeed(settings.targetSpeed ?? defaultLoopTrainerSettings.targetSpeed),
        speedIncrement: Math.max(0, settings.speedIncrement ?? defaultLoopTrainerSettings.speedIncrement),
        cleanPassesRequired: Math.max(
            1,
            Math.round(settings.cleanPassesRequired ?? defaultLoopTrainerSettings.cleanPassesRequired)
        )
    };
}

function clampSpeed(value: number): number {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.min(1, Math.max(0.1, value));
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
