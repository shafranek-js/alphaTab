const PlaygroundStoragePrefix = 'at-playground-';

export interface PlaygroundStorage {
    readonly length: number;
    key(index: number): string | null;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export function collectPlaygroundSettings(storage: PlaygroundStorage): Record<string, string | null> {
    const exportData: Record<string, string | null> = {};
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(PlaygroundStoragePrefix)) {
            exportData[key] = storage.getItem(key);
        }
    }
    return exportData;
}

export function applyPlaygroundSettingsImport(storage: PlaygroundStorage, data: unknown): string[] {
    if (typeof data !== 'object' || data === null) {
        throw new Error('Invalid JSON format');
    }

    const settingsData = data as Record<string, unknown>;
    const keys = Object.keys(settingsData);
    const playgroundKeys = keys.filter(k => k.startsWith(PlaygroundStoragePrefix));
    if (playgroundKeys.length === 0) {
        throw new Error('No alphaTab playground settings found in the file.');
    }

    for (const key of playgroundKeys) {
        const value = settingsData[key];
        if (value === null) {
            storage.removeItem(key);
        } else if (typeof value === 'string') {
            storage.setItem(key, value);
        } else {
            throw new Error(`Invalid value for ${key}`);
        }
    }

    return playgroundKeys;
}
