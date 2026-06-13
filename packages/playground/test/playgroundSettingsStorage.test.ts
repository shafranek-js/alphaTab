import { describe, expect, it } from 'vitest';
import { applyPlaygroundSettingsImport, collectPlaygroundSettings, type PlaygroundStorage } from '../src/util/playgroundSettingsStorage';

class MemoryStorage implements PlaygroundStorage {
    private readonly data = new Map<string, string>();

    public get length(): number {
        return this.data.size;
    }

    public key(index: number): string | null {
        return Array.from(this.data.keys())[index] ?? null;
    }

    public getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }

    public setItem(key: string, value: string): void {
        this.data.set(key, value);
    }

    public removeItem(key: string): void {
        this.data.delete(key);
    }
}

describe('playground settings export/import storage', () => {
    it('exports the restored custom, score info, marker and player settings from local storage', () => {
        const storage = new MemoryStorage();
        const settings = {
            custom: {
                beatCursorColor: '#123456',
                beatCursorOpacity: 0.65,
                beatCursorWidth: 7,
                beatCursorColorFromNote: true,
                hiddenTracksVolume: 0.35,
                notationElements: {
                    '0': true,
                    '2': false,
                    '35': true
                },
                scoreInfoElementFonts: {
                    '2': '11px "Noto Serif"',
                    '3': '12px "Noto Serif"',
                    '5': '13px "Noto Serif"'
                }
            },
            settings: {
                'display.firstStaffPaddingLeft': 9,
                'display.resources.markerFont': 'bold 15px "Noto Serif"'
            },
            api: {
                metronomeVolume: 0.2,
                countInVolume: 0.3,
                playbackSpeed: 1.2
            }
        };

        storage.setItem('at-playground-settings', JSON.stringify(settings));
        storage.setItem('unrelated', 'ignore me');

        const exported = collectPlaygroundSettings(storage);

        expect(Object.keys(exported)).toEqual(['at-playground-settings']);
        const exportedSettings = JSON.parse(exported['at-playground-settings']!);
        expect(exportedSettings.custom.beatCursorColor).toBe('#123456');
        expect(exportedSettings.custom.beatCursorOpacity).toBe(0.65);
        expect(exportedSettings.custom.beatCursorWidth).toBe(7);
        expect(exportedSettings.custom.beatCursorColorFromNote).toBe(true);
        expect(exportedSettings.custom.hiddenTracksVolume).toBe(0.35);
        expect(exportedSettings.custom.notationElements).toEqual(settings.custom.notationElements);
        expect(exportedSettings.custom.scoreInfoElementFonts).toEqual(settings.custom.scoreInfoElementFonts);
        expect(exportedSettings.settings['display.firstStaffPaddingLeft']).toBe(9);
        expect(exportedSettings.settings['display.resources.markerFont']).toBe('bold 15px "Noto Serif"');
        expect(exportedSettings.api.metronomeVolume).toBe(0.2);
        expect(exportedSettings.api.countInVolume).toBe(0.3);
        expect(exportedSettings.api.playbackSpeed).toBe(1.2);
    });

    it('imports exported playground settings and removes null playground keys', () => {
        const storage = new MemoryStorage();
        storage.setItem('at-playground-settings', 'old');
        storage.setItem('at-playground-score-data', 'old score');
        storage.setItem('unrelated', 'keep');

        const nextSettings = JSON.stringify({
            custom: {
                hiddenTracksVolume: 0.4
            }
        });

        const importedKeys = applyPlaygroundSettingsImport(storage, {
            'at-playground-settings': nextSettings,
            'at-playground-score-data': null,
            unrelated: 'ignored'
        });

        expect(importedKeys).toEqual(['at-playground-settings', 'at-playground-score-data']);
        expect(storage.getItem('at-playground-settings')).toBe(nextSettings);
        expect(storage.getItem('at-playground-score-data')).toBeNull();
        expect(storage.getItem('unrelated')).toBe('keep');
    });

    it('rejects imports without playground keys', () => {
        const storage = new MemoryStorage();

        expect(() => applyPlaygroundSettingsImport(storage, { unrelated: 'value' })).toThrow(
            'No alphaTab playground settings found in the file.'
        );
    });
});
