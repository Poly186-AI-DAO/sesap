# Contributing to SESAP

Thank you for your interest in contributing to the Self-Executing Social Agreements Platform! This guide will help you get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/sesap.git
   cd sesap
   ```
3. **Install dependencies**: `npm install`
4. **Create a branch**: `git checkout -b feature/your-feature`

## Development Workflow

1. Make your changes in the feature branch
2. Run tests to ensure nothing is broken: `npm test`
3. Commit with a clear message following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation only
   - `test:` — adding or updating tests
   - `chore:` — maintenance (deps, config, cleanup)
4. Push to your fork and open a Pull Request against `main`

## What to Contribute

- **Bug fixes** — Check the [Issues](https://github.com/Poly186-AI-DAO/sesap/issues) tab
- **Tests** — We're always looking to improve test coverage
- **Documentation** — Clarify setup instructions, add examples
- **MCP tools** — New tools or resources for the MCP server
- **UI improvements** — Editor features, accessibility, responsiveness

## Code Standards

- TypeScript strict mode — no `any` unless unavoidable
- Production-quality code — no TODOs, no placeholder implementations
- Follow existing patterns — search the codebase before adding new abstractions
- Add tests for new functionality

## Key Architecture Notes

Before contributing, review these documents:
- [README.md](README.md) — Architecture overview and quick start
- [docs/STRUCTURED_OUTPUT_LESSONS.md](docs/STRUCTURED_OUTPUT_LESSONS.md) — LLM structured output pitfalls

Important constraints:
- **Zod schemas** (`server/schemas/contract.ts`): Use `.nullable()` not `.optional()` for OpenAI structured output
- **Accord rendering**: Both `src/store/store.ts` and `server/accord/engine.ts` implement the Accord pipeline — changes must be synced
- **Money model**: Hardcoded in both store and engine — if one changes, update both

## Reporting Issues

When filing a bug report, include:
1. Steps to reproduce
2. Expected vs actual behavior
3. Browser console errors (if frontend)
4. Server logs (if backend/API)
5. Node.js version (`node --version`)

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
