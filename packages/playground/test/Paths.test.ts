import { describe, expect, it } from 'vitest';
import { resolvePublicPath } from '../src/util/Paths';

describe('public asset paths', () => {
    it('keeps root deployments rooted', () => {
        expect(resolvePublicPath('/font/bravura/', '/')).toBe('/font/bravura/');
    });

    it('prefixes repository deployments with the configured base path', () => {
        expect(resolvePublicPath('/soundfont/FluidR3.sf3', '/alphaTab/')).toBe(
            '/alphaTab/soundfont/FluidR3.sf3'
        );
    });

    it('normalizes a base path without a trailing slash', () => {
        expect(resolvePublicPath('test-data/audio/full-song.gp', '/alphaTab')).toBe(
            '/alphaTab/test-data/audio/full-song.gp'
        );
    });
});
