# Project knowledge protocol

The persistent project knowledge base is the Obsidian vault in `knowledge-base/`.

For every substantial task in this repository:

1. Read `knowledge-base/00 Home.md`, `knowledge-base/_generated/Repository Snapshot.md`, and the notes relevant to the task before making changes.
2. Treat source code and executable tests as authoritative. Record conflicts between code, documentation, and historical notes in the knowledge base.
3. Run `npm run kb:update` after pulling changes and before the final handoff. Use `npm run kb:check` to validate wiki links without rewriting generated notes.
4. Update curated notes when architecture, behavior, workflows, risks, or product decisions change. Do not hand-edit files under `knowledge-base/_generated/`.
5. Add durable decisions to `knowledge-base/Decisions/Decision Log.md` using the decision template. Add investigations that may matter later under `knowledge-base/Investigations/`.
6. Never store secrets, tokens, personal data, build artifacts, or large generated outputs in the vault.
