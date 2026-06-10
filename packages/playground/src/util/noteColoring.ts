import * as alphaTab from '@coderline/alphatab';

export type NoteColorScheme = 'off' | 'suzuki';

const suzukiNoteColors: Record<string, alphaTab.model.Color> = {
    C: alphaTab.model.Color.fromJson('#ff0000')!,
    D: alphaTab.model.Color.fromJson('#ff9900')!,
    E: alphaTab.model.Color.fromJson('#fff200')!,
    F: alphaTab.model.Color.fromJson('#27e000')!,
    G: alphaTab.model.Color.fromJson('#33d9ff')!,
    A: alphaTab.model.Color.fromJson('#0000cc')!,
    B: alphaTab.model.Color.fromJson('#f000ff')!
};

const defaultTargets: alphaTab.model.NoteSubElement[] = [
    alphaTab.model.NoteSubElement.StandardNotationNoteHead,
    alphaTab.model.NoteSubElement.GuitarTabFretNumber,
    alphaTab.model.NoteSubElement.NumberedNumber
];

const noteSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const sharpPreferredDegrees = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const flatPreferredDegrees = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const spellingCandidates: { degree: number; accidentalOffset: number }[][] = [
    [
        { degree: 0, accidentalOffset: 0 },
        { degree: 1, accidentalOffset: -2 },
        { degree: 6, accidentalOffset: 1 }
    ],
    [
        { degree: 0, accidentalOffset: 1 },
        { degree: 1, accidentalOffset: -1 },
        { degree: 6, accidentalOffset: 2 }
    ],
    [
        { degree: 1, accidentalOffset: 0 },
        { degree: 0, accidentalOffset: 2 },
        { degree: 2, accidentalOffset: -2 }
    ],
    [
        { degree: 1, accidentalOffset: 1 },
        { degree: 2, accidentalOffset: -1 },
        { degree: 3, accidentalOffset: -2 }
    ],
    [
        { degree: 2, accidentalOffset: 0 },
        { degree: 1, accidentalOffset: 2 },
        { degree: 3, accidentalOffset: -1 }
    ],
    [
        { degree: 3, accidentalOffset: 0 },
        { degree: 2, accidentalOffset: 1 },
        { degree: 4, accidentalOffset: -2 }
    ],
    [
        { degree: 3, accidentalOffset: 1 },
        { degree: 4, accidentalOffset: -1 },
        { degree: 2, accidentalOffset: 2 }
    ],
    [
        { degree: 4, accidentalOffset: 0 },
        { degree: 3, accidentalOffset: 2 },
        { degree: 5, accidentalOffset: -2 }
    ],
    [
        { degree: 4, accidentalOffset: 1 },
        { degree: 5, accidentalOffset: -1 }
    ],
    [
        { degree: 5, accidentalOffset: 0 },
        { degree: 4, accidentalOffset: 2 },
        { degree: 6, accidentalOffset: -2 }
    ],
    [
        { degree: 5, accidentalOffset: 1 },
        { degree: 6, accidentalOffset: -1 },
        { degree: 0, accidentalOffset: -2 }
    ],
    [
        { degree: 6, accidentalOffset: 0 },
        { degree: 5, accidentalOffset: 2 },
        { degree: 0, accidentalOffset: -1 }
    ]
];

type PreviousColor = {
    hadStyle: boolean;
    colors: Map<alphaTab.model.NoteSubElement, alphaTab.model.Color | null | undefined>;
};

const previousSuzukiColors = new WeakMap<alphaTab.model.Note, PreviousColor>();

export function applySuzukiNoteColors(
    score: alphaTab.model.Score,
    enabled: boolean,
    targets: alphaTab.model.NoteSubElement[] = defaultTargets
): void {
    forEachNote(score, note => {
        if (enabled) {
            applySuzukiColor(note, targets);
        } else {
            restoreSuzukiColor(note, targets);
        }
    });
}

function applySuzukiColor(note: alphaTab.model.Note, targets: alphaTab.model.NoteSubElement[]): void {
    if (!note.isVisible || note.isPercussion || (!note.isPiano && !note.isStringed)) {
        return;
    }

    const step = getSuzukiStep(note);
    const color = step ? suzukiNoteColors[step] : undefined;
    if (!color) {
        return;
    }

    const previous = ensurePreviousColor(note, targets);
    note.style ??= new alphaTab.model.NoteStyle();

    for (const target of targets) {
        if (!previous.colors.has(target)) {
            previous.colors.set(target, note.style.colors.has(target) ? note.style.colors.get(target) : undefined);
        }
        note.style.colors.set(target, color);
    }
}

function restoreSuzukiColor(note: alphaTab.model.Note, targets: alphaTab.model.NoteSubElement[]): void {
    const previous = previousSuzukiColors.get(note);
    if (!previous || !note.style) {
        return;
    }

    for (const target of targets) {
        if (!previous.colors.has(target)) {
            continue;
        }

        const previousColor = previous.colors.get(target);
        if (previousColor === undefined) {
            note.style.colors.delete(target);
        } else {
            note.style.colors.set(target, previousColor);
        }
    }

    if (!previous.hadStyle && note.style.colors.size === 0) {
        note.style = undefined;
    }
    previousSuzukiColors.delete(note);
}

function ensurePreviousColor(note: alphaTab.model.Note, targets: alphaTab.model.NoteSubElement[]): PreviousColor {
    let previous = previousSuzukiColors.get(note);
    if (!previous) {
        previous = {
            hadStyle: !!note.style,
            colors: new Map()
        };
        previousSuzukiColors.set(note, previous);
    }

    for (const target of targets) {
        if (!previous.colors.has(target)) {
            previous.colors.set(target, note.style?.colors.has(target) ? note.style.colors.get(target) : undefined);
        }
    }

    return previous;
}

function forEachNote(score: alphaTab.model.Score, handler: (note: alphaTab.model.Note) => void): void {
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            for (const bar of staff.bars) {
                for (const voice of bar.voices) {
                    for (const beat of voice.beats) {
                        for (const note of beat.notes) {
                            handler(note);
                        }
                    }
                }
            }
        }
    }
}

export function getSuzukiStep(note: alphaTab.model.Note): string | null {
    let noteValue: number;
    try {
        noteValue = note.displayValue;
    } catch {
        return null;
    }

    if (!Number.isFinite(noteValue)) {
        return null;
    }

    const chroma = positiveModulo(Math.round(noteValue), 12);
    const forcedOffset = getForcedAccidentalOffset(note.accidentalMode);
    const candidates = spellingCandidates[chroma];
    const forcedSpelling = forcedOffset === null ? undefined : candidates.find(c => c.accidentalOffset === forcedOffset);
    const degree =
        forcedSpelling?.degree ??
        (Number(note.beat?.voice?.bar?.keySignature) < 0 ? flatPreferredDegrees[chroma] : sharpPreferredDegrees[chroma]);

    return noteSteps[degree] ?? null;
}

function getForcedAccidentalOffset(accidentalMode: alphaTab.model.NoteAccidentalMode): number | null {
    switch (accidentalMode) {
        case alphaTab.model.NoteAccidentalMode.ForceSharp:
            return 1;
        case alphaTab.model.NoteAccidentalMode.ForceDoubleSharp:
            return 2;
        case alphaTab.model.NoteAccidentalMode.ForceFlat:
            return -1;
        case alphaTab.model.NoteAccidentalMode.ForceDoubleFlat:
            return -2;
        case alphaTab.model.NoteAccidentalMode.ForceNatural:
        case alphaTab.model.NoteAccidentalMode.ForceNone:
            return 0;
        default:
            return null;
    }
}

function positiveModulo(value: number, mod: number): number {
    return ((value % mod) + mod) % mod;
}

export function getSuzukiColor(note: alphaTab.model.Note): string | null {
    const step = getSuzukiStep(note);
    return step ? suzukiNoteColors[step]?.rgba ?? null : null;
}
