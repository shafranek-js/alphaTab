import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vault = join(root, 'knowledge-base');
const generated = join(vault, '_generated');
const checkOnly = process.argv.includes('--check');

function git(args, fallback = '') {
    try {
        return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
        return fallback;
    }
}

function stripAnsi(value) {
    const ansiEscape = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');
    return value.replaceAll(ansiEscape, '');
}

function codeGraphStatus() {
    const command = process.env.CODEGRAPH_BIN ?? (process.platform === 'win32' ? 'codegraph.cmd' : 'codegraph');
    const result = spawnSync(command, ['status', '.'], {
        cwd: root,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        timeout: 30_000
    });
    if (result.status !== 0 || !result.stdout) {
        return 'CodeGraph CLI недоступен или status завершился с ошибкой.';
    }
    return stripAnsi(result.stdout).trim();
}

function yamlDate() {
    return new Date().toISOString();
}

function writeGenerated(name, body) {
    mkdirSync(generated, { recursive: true });
    const content = `---\ntype: generated\nstatus: verified\ngenerated: true\nupdated: ${yamlDate()}\n---\n\n${body.trim()}\n`;
    writeFileSync(join(generated, name), content, 'utf8');
}

function markdownCode(value) {
    return value ? `\`${value.replaceAll('`', '\\`')}\`` : '—';
}

function updateRepositorySnapshot() {
    const branch = git(['branch', '--show-current'], '(detached)');
    const head = git(['rev-parse', 'HEAD']);
    const headShort = git(['rev-parse', '--short=10', 'HEAD']);
    const headSubject = git(['log', '-1', '--format=%s']);
    const headDate = git(['log', '-1', '--format=%aI']);
    const origin = git(['remote', 'get-url', 'origin']);
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    const counts = upstream ? git(['rev-list', '--left-right', '--count', `HEAD...${upstream}`]) : '';
    const [ahead = '?', behind = '?'] = counts.split(/\s+/);
    const statusLines = git(['status', '--short']).split('\n').filter(Boolean);
    const status = statusLines.length === 0 ? 'clean' : `dirty (${statusLines.length} path(s))`;
    const statusPreview = statusLines.length
        ? `\n## Working tree\n\n\`\`\`text\n${statusLines.slice(0, 30).join('\n')}\n\`\`\`${statusLines.length > 30 ? `\n\n…и ещё ${statusLines.length - 30}` : ''}`
        : '';

    writeGenerated(
        'Repository Snapshot.md',
        `# Снимок репозитория\n\n| Поле | Значение |\n|---|---|\n| Branch | ${markdownCode(branch)} |\n| HEAD | ${markdownCode(head)} |\n| Commit | ${markdownCode(`${headShort} ${headSubject}`)} |\n| Commit date | ${markdownCode(headDate)} |\n| Origin | ${markdownCode(origin)} |\n| Tracking branch | ${markdownCode(upstream)} |\n| Ahead / behind tracking | ${ahead} / ${behind} |\n| Working tree | ${status} |\n\n## CodeGraph\n\n\`\`\`text\n${codeGraphStatus()}\n\`\`\`${statusPreview}\n\n> Этот снимок не выполняет network fetch и показывает только локально известные refs.`
    );
}

function updatePackageMatrix() {
    const packageRoot = join(root, 'packages');
    const rows = [];
    for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }
        const manifestPath = join(packageRoot, entry.name, 'package.json');
        if (!existsSync(manifestPath)) {
            continue;
        }
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        rows.push({
            folder: entry.name,
            name: manifest.name ?? '',
            version: manifest.version ?? '',
            private: manifest.private === true,
            scripts: Object.keys(manifest.scripts ?? {})
                .sort()
                .join(', ')
        });
    }
    rows.sort((a, b) => a.folder.localeCompare(b.folder));
    const table = rows
        .map(
            row =>
                `| \`${row.folder}\` | \`${row.name}\` | ${row.version || '—'} | ${row.private ? 'yes' : 'no'} | ${row.scripts || '—'} |`
        )
        .join('\n');
    writeGenerated(
        'Package Matrix.md',
        `# Матрица пакетов\n\n| Folder | Package | Version | Private | Scripts |\n|---|---|---:|:---:|---|\n${table}\n\nКурируемое описание ответственности пакетов: [[04 Package Map]].`
    );
}

function updateRecentChanges() {
    const log = git(['log', '-20', '--date=short', '--format=%h%x09%ad%x09%s']);
    const rows = log
        .split('\n')
        .filter(Boolean)
        .map(line => {
            const [hash, date, ...subject] = line.split('\t');
            return `| \`${hash}\` | ${date} | ${subject.join('\t').replaceAll('|', '\\|')} |`;
        })
        .join('\n');
    writeGenerated(
        'Recent Changes.md',
        `# Последние изменения\n\n| Commit | Date | Subject |\n|---|---|---|\n${rows}\n\nДля причин и последствий изменений используйте Git diff, tests и заметки в [[Investigations/README|Investigations]].`
    );
}

function markdownFiles(directory) {
    const result = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '.obsidian') {
            continue;
        }
        const full = join(directory, entry.name);
        if (entry.isDirectory()) {
            result.push(...markdownFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            result.push(full);
        }
    }
    return result;
}

function validateWikiLinks() {
    const files = markdownFiles(vault);
    const byRelative = new Map();
    const byBase = new Map();
    for (const file of files) {
        const rel = relative(vault, file).replaceAll('\\', '/').replace(/\.md$/i, '');
        byRelative.set(rel.toLowerCase(), file);
        const base = rel.split('/').at(-1).toLowerCase();
        const matches = byBase.get(base) ?? [];
        matches.push(file);
        byBase.set(base, matches);
    }

    const missing = [];
    for (const file of files) {
        const content = readFileSync(file, 'utf8');
        for (const match of content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
            const target = match[1].trim().replaceAll('\\', '/').replace(/\.md$/i, '');
            const key = target.toLowerCase();
            const exists = target.includes('/') ? byRelative.has(key) : (byBase.get(key)?.length ?? 0) > 0;
            if (!exists && !target.includes('{{')) {
                missing.push(`${relative(root, file)} -> [[${target}]]`);
            }
        }
    }

    if (missing.length > 0) {
        console.error(`Knowledge base has ${missing.length} broken wiki link(s):`);
        for (const item of missing) {
            console.error(`- ${item}`);
        }
        process.exitCode = 1;
        return;
    }
    console.log(`Knowledge base links OK (${files.length} Markdown files).`);
}

if (!checkOnly) {
    updateRepositorySnapshot();
    updatePackageMatrix();
    updateRecentChanges();
    console.log('Knowledge base generated notes updated.');
}

validateWikiLinks();
