function getRuntimeBaseUrl(): string {
    if (typeof document === 'undefined') {
        return '/';
    }
    return document.querySelector<HTMLMetaElement>('meta[name="alphatab-base-url"]')?.content ?? '/';
}

export function resolvePublicPath(path: string, baseUrl: string = getRuntimeBaseUrl()): string {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

export const Paths = {
    fontDirectory: resolvePublicPath('font/bravura/'),
    soundFont: resolvePublicPath('soundfont/FluidR3.sf3'),
    defaultScore: resolvePublicPath('test-data/audio/full-song.gp'),
    youtubeSyncScore: resolvePublicPath('test-data/guitarpro8/canon-audio-track.gp')
} as const;
