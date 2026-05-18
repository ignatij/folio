# Contributing

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must follow the format:

```
<type>(<scope>): <short description>
```

Release notes are generated automatically from commit history by [git-cliff](https://git-cliff.org/). Only commits that match the format appear in the changelog — so clear, scoped messages directly improve the release notes.

---

### Valid scopes

| Scope | Covers |
|---|---|
| `backend` | Go server, API handlers, models, migrations, services |
| `admin` | React admin UI, block editor, pages, components |
| `site` | Eleventy templates, CSS, site data files |
| *(none)* | Cross-cutting changes that span multiple modules |

### Valid types

| Type | Included in changelog | When to use |
|---|---|---|
| `feat` | Yes | New user-facing feature |
| `fix` | Yes | Bug fix |
| `perf` | Yes | Performance improvement |
| `refactor` | No | Internal restructuring, no behaviour change |
| `docs` | No | Documentation only |
| `chore` | No | Dependency bumps, config, tooling |
| `ci` | No | GitHub Actions / CI changes |
| `test` | No | Adding or fixing tests |
| `style` | No | Formatting, linting (no logic change) |
| `build` | No | Build system changes |

### Breaking changes

Append `!` after the type/scope, or add a `BREAKING CHANGE:` footer:

```
feat(backend)!: replace slug generation — existing URLs will change

BREAKING CHANGE: article slugs are now lowercase and hyphenated.
Existing bookmarks pointing to the old slugs will 404.
```

---

### Examples

```bash
feat(backend): add newsletter unsubscribe endpoint
fix(admin): correct image picker modal z-index on mobile
perf(site): lazy-load article cover images
feat(admin): add article-grid block to the block palette
fix(backend): prevent duplicate email subscriptions
chore: bump Go to 1.25
ci: add docker publish workflow on tag push
feat!: rename JWT_SECRET env var to APP_SECRET
```

---

## Previewing the changelog

Install [git-cliff](https://git-cliff.org/) once:

```bash
# macOS / Linux (Homebrew)
brew install git-cliff

# Windows
winget install orhun.git-cliff

# Any platform (Cargo)
cargo install git-cliff
```

Preview what the next release notes would look like:

```bash
# Everything since the last tag
git cliff --latest

# Full changelog from the beginning
git cliff

# A specific range
git cliff v0.9.0..HEAD
```

---

## Releasing

Releases are tag-driven. Pushing a tag triggers the GitHub Actions workflow that:

1. Generates the changelog with git-cliff
2. Creates a GitHub Release with the per-module notes
3. Builds and pushes the Docker image to `ghcr.io`

```bash
# Create and push a release tag
git tag -a v1.0.0-beta.1 -m "Release v1.0.0-beta.1"
git push origin v1.0.0-beta.1
```

Tag naming conventions:

| Pattern | Published as |
|---|---|
| `v1.0.0` | Stable release; also tagged `latest` on ghcr.io |
| `v1.0.0-beta.1` | Pre-release; also tagged `beta` on ghcr.io |
| `v1.0.0-rc.1` | Pre-release |
| `v1.0.0-alpha.1` | Pre-release |
