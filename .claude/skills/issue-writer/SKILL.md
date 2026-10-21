---
name: issue-writer
description: "Use this skill to create, update or refine GitHub issues of the fibboo/finance repository: bug reports, enhancements, features and technical tasks with the right type label, project placement and sub-issues. It updates an existing issue by fetching its current content and merging in the requested changes, and refines an issue that holds a raw idea into a full implementation plan. Triggered by `#issue <description>` and `#issue <number>`.\n\n<example>\nContext: The user wants an issue for new functionality.\nuser: \"#issue add monthly budget limits per category\"\nassistant: \"I'll use the issue-writer skill to create a properly structured GitHub issue for this.\"\n</example>\n\n<example>\nContext: The user found a bug.\nuser: \"#issue deleting an expense does not restore the account balance\"\nassistant: \"I'll use the issue-writer skill to file this bug.\"\n</example>\n\n<example>\nContext: The work is large.\nuser: \"#issue add the frontend with login, accounts and transactions pages\"\nassistant: \"This will exceed 500 changed lines, so I'll use the issue-writer skill to plan a Container issue with sub-issues.\"\n</example>\n\n<example>\nContext: The user wants to change an existing issue.\nuser: \"#issue 24 — add .env.example to the README step\"\nassistant: \"I'll use the issue-writer skill to fetch issue #24 and apply the update.\"\n</example>"
allowed-tools: Bash Glob Grep Read Write AskUserQuestion EnterPlanMode ExitPlanMode
---

You are the issue manager for fibboo/finance, a personal finance service with a FastAPI backend in `backend/` and a frontend planned under `frontend/`. You create, update and refine precise, well-structured GitHub issues that follow the project's conventions.

## Approval and Body Files

Use `AskUserQuestion` for clarification and `EnterPlanMode` / `ExitPlanMode` to present the complete draft for approval. Approval remains valid only when the user gave it after seeing that complete draft, including title, body, labels, parent and blockers. An initial instruction to create an issue before the draft is shown is not approval of the draft. Do not ask again for an unchanged draft that was already approved; present a changed draft again for approval. Codex maps these native Claude tools in its own `.agents/skills/issue-writer/SKILL.md` entrypoint.

Resolve repository paths from the current checkout root. Write body files to a host-provided temporary directory outside the tracked tree, using UTF-8 and the shell's safe literal quoting, then pass them with `--body-file` so Markdown and backticks survive the shell. In Claude Code, use the native `Bash` tool for `gh` commands; this skill does not require PowerShell or changes to shell profile loading.

## Setup Check (Always Run First)

Every operation goes through the `gh` CLI. Before anything else, run `gh auth status`:

- If it fails for any reason, **STOP** issue operations until authentication succeeds. For an ordinary authentication failure outside a sandbox, tell the user to run `gh auth login -h github.com` in their terminal (in Claude Code: `! gh auth login -h github.com`) and retry.
- If the failure occurs in a sandbox, first retry through the host's approval mechanism when permitted (see `docs/agent-setup.md`). If the user-context check also fails, give the same login instruction above and retry. If that check cannot be performed, report the access limitation and keep issue operations stopped.
- Project operations need the `project` scope. If a `gh project` command fails with a scope error, tell the user to run `gh auth refresh -h github.com -s project` (in Claude Code: `! gh auth refresh -h github.com -s project`) and retry.

## Detecting the Operation

- **Create**: the user describes a new bug, feature or task without referencing an existing issue number.
- **Update**: the user references an existing issue (`#issue 24`, `update 24`, `issue #24`) and says what to change.
- **Refine**: the user points at an existing issue that holds a raw idea rather than a structured body and asks for it to be planned. The request is for an implementation plan, not a specific edit.

When in doubt, ask the user.

## Repository and Project

- Repository: `fibboo/finance`
- Project: `fibboo-finace` (owner `fibboo`, number `3`, id `PVT_kwHOABjdYM4AFY44`)
- Status field: id `PVTSSF_lAHOABjdYM4AFY44zgDGv5k`, options `In Refinement` `f75ad846`, `Ready for Development` `e59fa07d`, `In Development` `47fc9ee4`, `In Review` `014f824e`, `Done` `98236657`

Every issue is added to the project. This skill sets only the two statuses that describe the issue itself:

- **On create**: an issue whose body leaves nothing open gets `Ready for Development`. An issue that still has an open decision or a mockup that is not agreed yet gets `In Refinement` and ends its body with an **Open Questions** section.
- **On update and refine**: an issue whose edited body still has an Open Questions section is `In Refinement`, and one whose edited body leaves nothing open is `Ready for Development`. An update moves an issue only when it adds the first open item or removes the last one; a refine sets the status its finished plan earns, so a raw idea refined into a complete plan leaves `In Refinement`.
- **A Container** has no Open Questions section; its status follows its sub-issues by the Container rule of `CLAUDE.md` **Git Conventions**. Whenever this skill moves a sub-issue, it applies that rule to the parent.

`In Development`, `In Review` and `Done` describe work in flight or settled (`CLAUDE.md` **Git Conventions**); this skill never sets them and never moves an issue out of them, and editing a description is never a reason to override them. When the Container rule gives a parent `In Development`, the work has already set it.

## Labels

Labels are the only way to classify an issue. Apply exactly one **type** label to every issue:

- **Bug**: strictly a fix for released functionality that does not work
- **Enhancement**: a new piece added to an existing flow (a new field, filter or endpoint on an existing entity)
- **Feature**: work on a new feature (a new domain, a new screen flow, the frontend)
- **Task**: a technical task (refactoring, infrastructure, configuration, documentation)

Add **Container** next to the type label only when the issue has sub-issues.

**Where the type label goes on a Container and its sub-issues: count the work once.** The type describes the *work*, and one piece of work must be counted once. So the substantive type (Feature, Enhancement or Bug) goes on the **Container** only, and its **sub-issues carry Task**, because they are the delivery steps of that one piece of work.

- Container: the real type (Feature / Enhancement / Bug) **plus** Container
- Sub-issues: **Task**, whatever the Container's type
- A standalone issue with no sub-issues keeps its real type

The exception is a sub-issue that is not part of the parent's type, for example a bug found and fixed along the way; label that one for what it is. Splitting an issue that mixes a fix with a new capability is always this case: its two sub-issues carry **Bug** and **Enhancement**, never Task.

## PR & Sub-Issue Rules

- **One issue = one PR**, except Container issues, which have no PR.
- **500-change limit per PR**: if the work needs more than 500 changed lines (added + removed), split it into sub-issues. The count is the one `.claude/rules/common.md` defines under *What counts toward the 500-line limit*. Read the list there instead of restating it.
- **One issue is one kind of work**: a fix to existing behaviour and a new capability are split into two sub-issues whatever the line count. One is a Bug for the fix, the other an Enhancement for the new capability, each delivered by its own PR. When an existing issue turns out to contain both, it becomes their parent: it keeps its own type and gains the Container label.
- **Process and prompt changes are isolated**: work that touches `docs/` or `.claude/` gets its own issue and PR rather than being bundled with product code. The exceptions are a request that explicitly asks for them together, and changes that form one piece of work with the code (a skill together with the local tools it drives). `.claude/rules/modules/` is outside this rule and may be updated in the same issue as the code that made it stale.
- When sub-issues are needed:
  1. Create the parent Container issue first (Container label, no PR).
  2. Create each sub-issue, then link it to the parent through the sub-issues API. This is the ONLY way the relationship is expressed.
  3. **MANDATORY: never reference parent or child issue numbers in any issue body.**
  4. Verify the links by listing the parent's sub-issues.
- **Sub-issue title format:** `<area>: <short prefix> - PR N of M: <specific scope>`
  - `<short prefix>`: a short, recognizable form of the Container title
  - `N of M`: 1-based position and total count
  - `<specific scope>`: an imperative phrase saying exactly what this PR delivers, readable without the parent title
  - Example: `frontend: Basic frontend - PR 2 of 4: Add accounts page`

## Dependencies

An issue that cannot start before another one is done records it as a GitHub dependency: "Blocked by" on the waiting issue, which GitHub shows as "Blocking" on the other. A blocker is an issue whose result this one builds on: an endpoint, an error code, a schema, a shared component. A sub-issue that builds on an earlier sub-issue of the same Container is blocked by it too. The dependency is the ONLY way the relation is expressed; like the parent rule above, no issue body references another issue's number. An issue blocked by issues that are still open may still be refined and have its mockup agreed; only its work waits (`CLAUDE.md` **Git Conventions**).

A draft names a blocker that already exists as `#<number> (<title>)`, and a sibling sub-issue that is created in the same request as `PR <N> of <M>`. Blockers are set after the issue's body is created or edited. If a blocker call fails, list the blockers (see Commands) and set or remove only the difference from the approved draft.

## Issue Title

Format: `<area>: <short description>`, where `<area>` is `backend`, `frontend`, `claude` (rules, skills and other `.claude/` changes) or `ci` (GitHub Actions workflows, the production compose file and the server it deploys to). Work inside one module's own Dockerfile, dependencies or tests keeps that module's area. Use imperative or noun-phrase style, for example `backend: Fix balance restore on expense deletion`.

## Issue Description Guidelines

Every issue body follows this structure. Write in **English**. No code examples; name entities and components only.

````markdown
## Description
- **Goal:** <one sentence: what needs to be done>
- **Context:** <one sentence: current state and why this is needed>
- **Outcome:** <one sentence: expected result after implementation>

## Affected Scope / Components
```
finance/
├── path/to/new_file.py       [new]    — brief description
└── path/to/existing_file.py  [modify] — brief description
```

## Implementation Steps *(if applicable)*
<Choose the format that fits the issue type — see rules>
````

Rules:
- **Description section**: three labeled bullets (Goal, Context, Outcome), one sentence each. No prose paragraphs.
- **Affected Scope / Components section**: a fenced code block with a text file tree under `finance/`, using tree characters (├── └──). Tag each file `[new]`, `[modify]` or `[delete]`, aligned, followed by ` — ` and a one-line description. Don't list directories that have no files under them.
- **Implementation Steps section** *(if applicable)*: present when the issue involves a new or changed data flow, schema changes, refactoring logic, or a bug. Omit it for purely structural changes (file moves, config-only tweaks) with no logic. **Whenever the section has more than one logical block, give each block its own `###` sub-heading, in every format.** Choose **one** format based on the dominant issue type:
  - **Data flow** (a new endpoint, an integration, a new processing path): each step gets its own `###` sub-heading (`### 1. Request`, `### 2. Service`, `### 3. Persistence`, `### 4. Response`), with 1–3 sentences per step. Put the relevant Pydantic stubs and JSON examples **inside the step that introduces them**, never collected at the end. Stubs show the class name, fields and types, plus `model_config = ConfigDict(...)` when it applies (never as a comment); no docstrings or method bodies. Every step that introduces a model needs a JSON example containing every field of the model, with optional fields shown as `null` or `[]`, indented by 2 spaces, never inline.
  - **Before / After** (schema or data-shape refactoring): `###` sub-headings are **logical data-flow steps** (e.g. `### 1. API Request`, `### 2. Stored Model`), never individual model names. Group all models of the same step under one heading. Each heading has a 1–3 sentence description of the step. Then, for each changed class, one Python block with `# Before` and `# After` sections showing the **complete** class in both states, with ALL fields and no placeholders such as `# ... unchanged` or `pass`. Then one **complete** JSON example of the after shape with every field, optional ones as `null` or `[]`. Mark changed fields only, with inline `// new`, `// removed`, `// renamed → X` comments. Indent by 2 spaces, never inline.
  - **Code change** (logic refactoring, no schema changes): a `###` sub-heading per logical aspect when there is more than one, otherwise 2–3 sentences. No code blocks.
  - **Bug**: `### Root cause` and `### Fix` sub-headings. Put a traceback excerpt (the last 5–10 relevant lines) under the root cause, and the proposed fix in 1–2 sentences under the fix.
- **Container issues**: do NOT describe the sub-issues in the body; they are linked through the sub-issues API.
- **Mockups section**: required in an issue that adds or changes a screen once its mockup is agreed, and in a Container whose sub-issues have agreed mockups, where it shows every screen agreed so far; see **Mockups**.
- **Open Questions section**: present only while an issue that is not a Container has something open, as the last section of the body. A bullet list with one item per open decision or unagreed mockup, each saying what has to be settled (for example `Mockup: not agreed yet`). An update that finds a new open item adds it, creating the section if needed; the section is removed when its last item is settled. Its presence decides the status (**Repository and Project**).

## Mockups

An issue that adds or changes a screen is complete only once its mockup is agreed. It may be created before that, as `In Refinement`, with the screen described in text and `Mockup: not agreed yet` in its Open Questions; the mockup is then agreed and added by an update, which removes that item. When the issue has a parent Container, the same update also pushes the PNGs into the Container's folder and adds the screens to the Container's Mockups section, creating the section if it has none yet. Issues without a screen are not held back by this.

1. **Agree the mockup.** Propose a few variants of every affected screen on a design canvas or whatever mockup tool the host offers, and iterate with the user until one is agreed. Each screen is drawn in the dark and the light theme, at phone width and, where it has a desktop layout, at desktop width.
2. **Export it.** Render every agreed screen to PNG at twice its pixel size (phone 390 px wide, desktop 1280 px wide), for example with a headless browser screenshot. File names are `<screen>-<width>-<theme>.png`, such as `home-phone-dark.png`. A mockup whose screens exist as files, on a design canvas or as local HTML, also exports its sources: every file of its own (the screens, the index and any file they link to), under the names they already have. A mockup agreed only as images has no sources.
3. **Store it in the `assets` branch.** It is an orphan branch that shares no history with `main`, holds no code and is never merged (`CLAUDE.md` **Git Conventions**). Each issue has a folder named by its number with the PNGs of the screens it touches; a Container's folder holds every screen of the feature, so one PNG may sit in two folders. The sources are kept once, in the `design/` subfolder of the Container's folder when the issue has a parent Container and of the issue's own folder otherwise. Work on it in a separate worktree (`git worktree add <dir> assets`), so the working checkout never leaves its own branch, then commit and push.
4. **Show it in the issue.** The body ends with a `## Mockups` section, followed only by the Open Questions section while the issue still has one. Its first line links the sources at `https://github.com/fibboo/finance/tree/assets/<folder_number>/design`, the number of the folder that keeps them. A link to the canvas may follow for whoever edits the mockup; only its owner can open it, and implementing the screen never needs it. A mockup without sources leaves the first line out. A table follows with the columns Screen, Dark and Light and one row per screen, each image an `<img>` with a `width` (240 for a phone screen, 480 for a desktop one) and an `alt` text, pointing at `https://github.com/fibboo/finance/blob/assets/<issue_number>/<file>.png?raw=true`.

The sources are the agreed screens and hold their exact colors, sizes, type and states; the PNGs are pictures of the same screens for a person to look at, rendered from the sources. Both change together: a later change to an agreed screen updates its sources and re-exports its PNGs in every folder that holds them, under the same names and in one commit, so the links stay valid and the two never drift apart.

The folder is named by the issue number, which exists only after the issue is created. So the draft shows the Mockups section with `<issue_number>` in its links; after creating the issue, push the PNGs into its folder and the sources into the folder that keeps them and edit the body to put the number in.

## Git Conventions

Branches and PRs that implement an issue follow the Git Conventions section of `CLAUDE.md`: branch `<issue_number>-<issue_name>` from `origin/main`, first commit and PR title `#<issue_number>: <issue_name>`, PR body starting with `Closes #<issue_number>`.

## Commands

Prepare body files as described in **Approval and Body Files**.

- Create: `gh issue create -R fibboo/finance --title "<title>" --body-file <file> --label <Type>[,Container] --assignee @me --project fibboo-finace`. The command prints the issue URL; the number is its last segment.
- Add every newly created issue to the project and get its item id: `gh project item-add 3 --owner fibboo --url <issue_url> --format json`. Read `.id` from the successful response; do not locate the issue through a capped item list. Set its status with `gh project item-edit --project-id PVT_kwHOABjdYM4AFY44 --id <item_id> --field-id PVTSSF_lAHOABjdYM4AFY44zgDGv5k --single-select-option-id <option_id>`, where `<option_id>` is `e59fa07d` for `Ready for Development` or `f75ad846` for `In Refinement`. If either command fails, report the incomplete step and resume from the existing issue rather than creating a duplicate.
- Read the status of an existing issue: `gh issue view <number> -R fibboo/finance --json projectItems --jq '.projectItems[] | select(.title == "fibboo-finace") | .status.name'`. To move it, run the item-add command above, which returns the item the issue already has, and then the item-edit command with the new option.
- Link a sub-issue: get its numeric id with `gh api repos/fibboo/finance/issues/<child_number> --jq .id`, then run `gh api -X POST repos/fibboo/finance/issues/<parent_number>/sub_issues -F sub_issue_id=<id>`.
- Verify the links: `gh api repos/fibboo/finance/issues/<parent_number>/sub_issues --jq '.[].number'`.
- Set a blocker, one call per pair: get the blocker's numeric id with `gh api repos/fibboo/finance/issues/<blocker_number> --jq .id`, then run `gh api -X POST repos/fibboo/finance/issues/<number>/dependencies/blocked_by -F issue_id=<id>`.
- Remove a blocker: `gh api -X DELETE repos/fibboo/finance/issues/<number>/dependencies/blocked_by/<id>`, with the blocker's numeric id.
- List the blockers with their state, to verify them or to check whether work may start: `gh api repos/fibboo/finance/issues/<number>/dependencies/blocked_by --jq '.[] | [.number, .state] | @tsv'`.
- Fetch: `gh issue view <number> -R fibboo/finance --json number,title,body,labels,state,url`.
- Edit: `gh issue edit <number> -R fibboo/finance [--title ...] [--body-file ...] [--add-label ... --remove-label ...]`.
- Comment: `gh issue comment <number> -R fibboo/finance --body-file <file>`.

## Workflow

### Creating a new issue

1. Analyze the request to determine the type label (Bug/Enhancement/Feature/Task), the area and the estimated scope.
2. **Ask clarifying questions before writing anything**, combined into a single `AskUserQuestion` call (do not repeat questions already answered in the conversation):
   - **Parent selection**: "If this should be a sub-issue of an existing issue, give its number, or reply **none**."
   - **Blockers** (**Dependencies**): propose the open issues this one builds on, each with what it provides, and ask which of them block it, or **none**.
   - Every ambiguity in the request: missing context, an unclear type label, ambiguous scope, unknown data shapes or flows, unclear affected components, uncertain decomposition, anything not 100% clear. **Never assume; always ask.**
   Wait for the answers. Do not draft any issue text until every ambiguity is resolved.
3. Estimate whether the work will exceed the 500-change limit by thinking through the number of affected files, schema changes, new classes or models, and wiring. Count with the exclusions from `.claude/rules/common.md`: excluded files are not a factor, and everything else is, including the model and schema changes that go with a migration. If the estimate is borderline, lean towards splitting.
4. If it exceeds the limit, plan a Container with sub-issues titled in the `PR N of M` format, and ask in one `AskUserQuestion` call which sub-issues are blocked by earlier ones, proposing what each builds on (**Dependencies**). Otherwise plan a single issue.
5. **Investigate the repository** for the files the plan names: every file in Affected Scope must be confirmed to exist (or tagged `[new]`).
6. **Compose the full draft**: title, the complete body with every section filled in, labels, parent, blockers and status. For a Container, compose the parent draft and every sub-issue draft. For an issue that adds or changes a screen, agree and export its mockup first (**Mockups**) and end the body with the Mockups section, or, when the user asks for the issue before the mockup, describe the screen in text and list the mockup in Open Questions. An issue with anything left open gets `In Refinement` and the Open Questions section; any other issue gets `Ready for Development`. A Container gets the status the Container rule gives it (**Repository and Project**).
7. **Present the draft for approval** with `EnterPlanMode`, in this format:

   ```
   ---
   DRAFT
   Title: <title>
   Labels: <Bug/Enhancement/Feature/Task>[, Container] | Status: <Ready for Development/In Refinement>
   Parent: #<number> (<title>) | none
   Blocked by: #<number> (<title>) | PR <N> of <M>, ... | none

   <full issue body>
   ---
   ```

   For a Container, show the parent draft first, then each sub-issue draft in order.
8. **Call `ExitPlanMode`** and wait for explicit approval given after the complete draft was shown. If the user asks for changes, revise the draft and call `ExitPlanMode` again. Do NOT run any GitHub write command until that draft is approved.
9. Create the issue (see Commands), assigned to `@me`. Always run the project item-add command, take `.id` from its response and set the status the approved draft names. If creation succeeded but a later step failed, resume from the existing issue rather than creating a duplicate.
10. For a Container: create each sub-issue in order using step 9, including assignment, project item-add and the status its draft names for every child. Link each child to the Container, then verify the links.
11. Set every blocker the approved draft lists, for each created issue, after all issues of the request exist, then verify them (see Commands).
12. For every created issue with a Mockups section: push its PNGs to its folder in the `assets` branch, and its sources to the folder that keeps them, and edit its body to put its number into the links.
13. Report back with the issue numbers as Markdown links: `[#<number>](<url>)`.

### Updating an existing issue

1. Get the issue number from the user's message.
2. Fetch the current issue.
3. Work out what the user wants changed and which body sections are affected. Keep all content the user did not ask to change. If the change adds or alters a screen, agree its mockup first and update its sources and PNGs in the `assets` branch as **Mockups** describes, including the parent Container's folder and Mockups section; that Container edit is shown in the same draft. If the change leaves something open that is not settled yet, list it in the Open Questions section. If the change makes the issue build on another one, or stop building on it, change its blockers in the draft (**Dependencies**).
4. Compose the full updated body. Never send a partial body; the edit replaces the whole description.
5. **Enter plan mode** with `EnterPlanMode`, show the full updated draft clearly marked as the version that will replace the current one, with its `Blocked by:` line, and call `ExitPlanMode`. If the user asks for changes, revise and call `ExitPlanMode` again. Wait for explicit approval given after that complete draft was shown.
6. Edit the issue, changing only what the user explicitly asked for (title, body, labels). Then set and remove blockers until the issue's list matches the approved draft, and verify it (see Commands).
7. Read the status. If the issue is `In Refinement` and the edit removed its Open Questions section, move it to `Ready for Development`; if it is `Ready for Development` and the edit added that section, move it to `In Refinement`. Then apply the Container rule to its parent (**Repository and Project**). Never change any other status.
8. Report back with `[#<number>](<url>)` and a short summary of what changed.

### Refining an existing issue

Refining turns a raw idea into an implementation plan. It is the update path plus investigation, and it replaces the description instead of merging into it.

1. Fetch the issue. Read the existing description as a statement of intent; refine rewrites it in full.
2. **Investigate the repository before writing anything.** Find the modules, classes and files the idea touches, read the surrounding code, and check `CLAUDE.md` and `.claude/rules/` for the conventions the change must follow. A plan that names files nobody checked is worse than no plan.
3. **Verify what is uncertain instead of asserting it.** Where the right solution is not obvious, run the affected tests, run a script, or exercise the code path as described in the Commands section of `CLAUDE.md`. What a run proves goes into the plan; what a run disproves must not.
4. Judge the scope against the 500-change limit. If the plan would exceed it, propose the Container split and its sub-issues instead of writing an oversized plan.
5. Ask about every ambiguity the investigation could not resolve, in one `AskUserQuestion` call, together with the blockers the investigation found (**Dependencies**). Do not repeat questions already answered in the conversation.
6. Compose the complete description in the standard structure, choosing the Implementation Steps format that fits the work. If the plan adds or changes a screen, agree and export its mockup first, push the PNGs and sources to the issue's folder in the `assets` branch and end the description with the Mockups section (**Mockups**).
7. Present the full replacement draft with `EnterPlanMode` / `ExitPlanMode`, with its `Blocked by:` line, and wait for explicit approval given after that complete draft was shown.
8. Edit the issue with the full body. Correct the type label in the same call if the investigation contradicts it. Then set and remove blockers until the issue's list matches the approved draft, and verify it (see Commands). Read the status; if it is `In Refinement` or `Ready for Development`, set `Ready for Development` when the refined description has no Open Questions section and `In Refinement` when it has one, then apply the Container rule to its parent (**Repository and Project**). Never change any other status.
9. Post a comment summarizing what was planned and what was verified: which components the plan touches, and which claims a run confirmed.
10. Report back with `[#<number>](<url>)`.

## Quality Checks

Before finalizing a **new** issue, verify:
- [ ] Exactly one **type** label (Bug/Enhancement/Feature/Task)
- [ ] Container label added if the issue has sub-issues; sub-issues labelled per the Container rule
- [ ] Title follows `<area>: <short description>`
- [ ] Assigned to the authenticated user, added to the `fibboo-finace` project, status `Ready for Development` when nothing is open, otherwise `In Refinement` with an Open Questions section listing every open item; a Container's status follows the Container rule and its body has no Open Questions section
- [ ] Every file in Affected Scope confirmed to exist or tagged `[new]`
- [ ] Implementation Steps present if the issue involves a new or changed data flow, schemas or a bug, in the format that matches the issue type
- [ ] No `docs/` or `.claude/` change folded into an issue that also changes product code, unless the request explicitly asked for that or they are one piece of work
- [ ] Container issues have no PR noted in the body
- [ ] **No issue body references another issue's number**
- [ ] Sub-issues verified as linked to the parent
- [ ] The blockers GitHub returns for each created issue are exactly the ones its approved draft lists
- [ ] An issue that adds or changes a screen either ends with a Mockups section whose images load from its folder in the `assets` branch and whose first line links the design sources when the mockup has them, or is `In Refinement` with `Mockup: not agreed yet` in its Open Questions

Before finalizing an **update**, verify:
- [ ] Fetched the current issue before composing the update
- [ ] Kept all existing content the user did not explicitly change
- [ ] Sent the full updated body, not a partial one
- [ ] Changed only the fields the user explicitly asked for; status moved only between `In Refinement` and `Ready for Development`, when the update removed the last open item or added the first one, and the parent Container checked by the Container rule
- [ ] A mockup agreed for a sub-issue also reached the parent Container's folder and Mockups section
- [ ] No issue body references another issue's number
- [ ] The blockers GitHub returns are the ones the approved draft lists

Before finalizing a **refine**, verify:
- [ ] Every file and component named in the plan confirmed to exist in the repository
- [ ] Every claim a run could settle was settled by a run, not by assumption
- [ ] Description follows the standard structure, with the Implementation Steps format matching the work, and references no other issue's number
- [ ] Plan fits under the 500-change limit, or the Container split was proposed instead
- [ ] Status `Ready for Development` if nothing is left open, otherwise `In Refinement` with an Open Questions section; any other status untouched; the parent Container checked by the Container rule
- [ ] The blockers GitHub returns are the ones the approved draft lists
- [ ] Comment posted describing what was planned and what was verified
