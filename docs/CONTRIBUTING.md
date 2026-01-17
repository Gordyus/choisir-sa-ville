# Contributing Guide

Thank you for contributing to this project ❤️  
This document explains **how contributions are expected to be structured**, both for humans and AI agents (Codex).

---

## Philosophy

- Code quality > speed
- Readability > cleverness
- Consistency > personal preference

This project is designed so that:
- **Codex can safely implement changes and commit**
- **Humans remain in control of branching, merging and releases**

---

## Roles & Responsibilities

### Codex (AI contributor)

Codex is allowed to:
- implement features
- fix bugs
- refactor code
- update documentation
- create Git commits (locally)

Codex must:
- strictly follow commit conventions
- keep commits small and intentional
- never push to remote
- never create or merge branches
- never commit broken or unused code

---

### Human maintainer

The human contributor is responsible for:
- creating branches
- reviewing commits
- resolving conflicts
- merging branches
- pushing to remote
- releasing / deploying

---

## Branching Strategy

### Main branches

- `main` → production-ready code
- `dev` → integration branch (optional)

### Feature branches

Created manually by the human maintainer:

```
feat/scoring-logic
fix/cache-zones
refactor/routing-engine
docs/seo-model
```

Codex **never creates branches**.

---

## Commit Rules (Mandatory)

All commits **must follow** the rules defined in:

```
docs/git-commit-guidelines.md
```

### Summary

- Conventional commit format
- Scope is mandatory
- English only
- One commit = one clear intention
- No WIP / tmp / vague messages

Commits that do not follow these rules **must not be merged**.

---

## Code Style

### General rules

- Favor clarity over abstraction
- Avoid premature optimization
- Prefer explicit code over implicit behavior
- Avoid clever tricks that reduce readability

### Formatting

- Use existing formatting tools (Prettier, ESLint, etc.)
- Do not mix formatting-only changes with logic changes

---

## Architecture Guidelines

- No circular dependencies
- Clear separation of concerns
- Shared logic must live in explicit shared modules
- Avoid tight coupling between layers

Guiding principle:

> Make the code easier to delete than to extend.

---

## Performance & Caching

- Expensive computations must be:
  - lazy
  - cached
  - documented
- Cache keys must be deterministic
- Cache invalidation rules must be explicit

No hidden or implicit caching behavior is allowed.

---

## Documentation

Documentation is required.

Update documentation when:
- behavior changes
- a new concept is introduced
- a non-obvious decision is made

Documentation lives in:
- `README.md`
- `docs/`
- inline comments (only when strictly necessary)

---

## Tests

When tests exist:
- new features must include tests
- bug fixes must include regression coverage
- refactors must not reduce coverage

If no tests exist yet, code must remain test-ready.
