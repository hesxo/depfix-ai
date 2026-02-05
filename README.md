# depfix-ai

[![npm version](https://img.shields.io/npm/v/depfix-ai.svg)](https://www.npmjs.com/package/depfix-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> CLI for dependency audit, env file generation, and contributor onboarding. Fix your deps, generate `.env.example`, and get projects ready in one command.

**Requires Node.js ≥ 18.**

---

## Install

**Global (npm or pnpm):**

```bash
npm install -g depfix-ai
# or
pnpm add -g depfix-ai
```

**Run without installing (npx / pnpm dlx):**

```bash
npx depfix-ai --help
# or
pnpm dlx depfix-ai --help
```

---

## Quick start

After installing globally or with `npx` / `pnpm dlx`:

```bash
depfix-ai audit              # Security audit + human summary
depfix-ai env generate       # Scan source → .env.example
depfix-ai onboard            # Install deps + env + tests
depfix-ai fix                # Preview fixes (dry-run); use --apply to apply
```

One-off (no install):

```bash
npx depfix-ai audit
pnpm dlx depfix-ai env generate
```

---

## Commands

### `depfix-ai audit`

Run a security audit and get a human-readable summary (npm only for now).

| Flag | Description |
|------|-------------|
| `--json` | Print raw npm audit JSON |
| `--severity <level>` | `low` \| `moderate` \| `high` \| `critical` (default: low) |
| `--fail` | Exit 1 if vulnerabilities ≥ severity |

```bash
depfix-ai audit
depfix-ai audit --severity high --fail
depfix-ai audit --json
```

---

### `depfix-ai env generate`

Scan source for `process.env.*` and `import.meta.env.*`; generate grouped `.env.example` (and optionally a blank `.env`).

| Flag | Description |
|------|-------------|
| `--out <path>` | Output file (default: .env.example) |
| `--create` | Create .env with blank values if missing |
| `--force` | Overwrite .env when used with --create |
| `--check` | Verify .env.example has all vars; exit 1 if not |

```bash
depfix-ai env generate
depfix-ai env generate --create
depfix-ai env generate --check
```

---

### `depfix-ai fix`

Preview dependency fixes (dry-run by default). Use `--apply` to write changes.

| Flag | Description |
|------|-------------|
| `--apply` | Apply changes |
| `--force` | Pass --force to npm audit fix |
| `--stash` | Auto-stash if git dirty |
| `--commit` | Auto-commit with chore(deps): audit fix |
| `--dry-run` | Preview only (default) |

```bash
depfix-ai fix
depfix-ai fix --apply
```

---

### `depfix-ai onboard`

One-command setup: backup (git stash), install deps, env generate, run tests.

| Flag | Description |
|------|-------------|
| `--skip-install` | Skip npm install |
| `--skip-env` | Skip env generate |
| `--skip-test` | Skip test script |

```bash
depfix-ai onboard
depfix-ai onboard --skip-test
```

---

## Development

```bash
git clone https://github.com/hesxo/depfix-ai.git
cd depfix-ai
npm ci
# or: pnpm install
npm run build
npm test
```

**Scripts:** `build` · `test` · `lint` · `version:patch`

---

## License

MIT

lol
