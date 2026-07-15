import path from 'node:path';
import { defineConfig, type UserConfig } from 'vite';
import { buildTsconfigAliases } from '../tooling/src/vite';
import { elementStyleUsingPlugin } from '../tooling/src/vite.plugin.transform';
import { alphaTab } from '../vite/src/alphaTab.vite';

function normalizeBasePath(basePath: string): string {
    const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
    return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(() => {
    const projectDirectory = import.meta.dirname;
    const alphaTabDistribution = path.resolve(projectDirectory, '../alphatab/dist/alphaTab.mjs');
    const config: UserConfig = {
        base: normalizeBasePath(process.env.PAGES_BASE_PATH ?? '/'),
        root: path.resolve(projectDirectory, 'pages'),
        publicDir: false,
        plugins: [alphaTab({ assetOutputDir: false }), elementStyleUsingPlugin()],
        resolve: {
            alias: [
                { find: /^@coderline\/alphatab$/, replacement: alphaTabDistribution },
                ...buildTsconfigAliases(projectDirectory)
            ]
        },
        build: {
            outDir: path.resolve(projectDirectory, 'dist-pages'),
            emptyOutDir: true
        }
    };

    return config;
});
