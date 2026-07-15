import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const playgroundDirectory = path.join(repositoryRoot, 'packages', 'playground');
const outputDirectory = path.join(playgroundDirectory, 'dist-pages');

await build({
    configFile: path.join(playgroundDirectory, 'vite.pages.config.ts')
});

await Promise.all([
    cp(
        path.join(repositoryRoot, 'packages', 'alphatab', 'font', 'bravura'),
        path.join(outputDirectory, 'font', 'bravura'),
        { recursive: true }
    ),
    copyAsset(
        path.join(repositoryRoot, 'soundfont', 'FluidR3.sf3'),
        path.join(outputDirectory, 'soundfont', 'FluidR3.sf3')
    ),
    copyAsset(
        path.join(repositoryRoot, 'packages', 'alphatab', 'test-data', 'audio', 'full-song.gp'),
        path.join(outputDirectory, 'test-data', 'audio', 'full-song.gp')
    ),
    copyAsset(
        path.join(repositoryRoot, 'LICENSE'),
        path.join(outputDirectory, 'licenses', 'alphaTab-MPL-2.0.txt')
    ),
    copyAsset(
        path.join(repositoryRoot, 'soundfont', 'LICENSE'),
        path.join(outputDirectory, 'licenses', 'FluidR3-MIT.txt')
    ),
    writeFile(path.join(outputDirectory, '.nojekyll'), '', 'utf8')
]);

async function copyAsset(source, destination) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
}
