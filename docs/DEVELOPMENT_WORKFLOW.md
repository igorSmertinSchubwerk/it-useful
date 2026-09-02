# Development workflow

This file defines how the user and Codex will build IT Useful step by step.

## 1. Propose work before changing the project

Codex proposes the next logical step or a small group of closely related steps. The proposal explains:

1. the goal;
2. the files and systems that will change;
3. the recommended implementation;
4. meaningful choices or risks;
5. what the user must approve.

Codex waits for explicit approval before implementing the proposed group. Read-only investigation needed to prepare a proposal is allowed.

## 2. Implement only approved work

After approval, Codex:

1. creates a feature branch from the current `main` branch;
2. implements only the approved scope;
3. tests and verifies the change in proportion to its risk;
4. updates `docs/WORKSHEET.csv` to reflect completed or blocked steps;
5. reviews the complete diff;
6. creates a focused commit;
7. pushes the feature branch;
8. creates a GitHub pull request.

One pull request normally represents one approved, coherent group. Tiny worksheet rows that cannot be meaningfully reviewed alone may be combined when they belong to the same outcome.

## 3. User review and merge

Codex does not merge its own pull request. The user reviews and merges it on GitHub. Work on the next group begins only after the user confirms the previous pull request was merged, unless the user explicitly approves independent parallel work.

If the user requests changes, Codex updates the same branch and pull request when practical.

## 4. Commit and pull-request conventions

- Default branch: `main`
- Feature branches: `feature/<short-description>`
- Documentation branches: `docs/<short-description>`
- Fix branches: `fix/<short-description>`
- Commit style: short imperative subject, such as `Add repository foundation`
- Pull requests include scope, verification performed, and any user action still required.
- Secrets, generated build output, dependencies, database files, and uploaded runtime files are never committed.

The initial empty-repository bootstrap is the only expected exception to the pull-request rule: GitHub needs a baseline `main` commit before a feature branch can open a pull request against it. The baseline contains only the minimum required Git history. All substantive project work then goes through pull requests.

## 5. Completion response format

After implementing an approved group, Codex ends its response using this structure:

**SUMMARY**

### What was done

1. A numbered list of changes made during this group.
2. Tests and verification that were performed.
3. The commit and pull-request result.

### What you should do now:

1. The exact action or decision required from the user.
2. Commands the user must run, if any.
3. A direct link to the pull request.

If work is blocked before a pull request can be created, this section explains the blocker and the smallest action needed to continue. It must not invent a pull-request link.

## 6. Current implementation plan

The ordered implementation plan and live status are maintained in `docs/WORKSHEET.csv`. Status values are:

- `TODO`: not started;
- `IN PROGRESS`: approved and currently being implemented;
- `BLOCKED`: cannot continue without a dependency or user action;
- `DONE`: implemented and verified.
