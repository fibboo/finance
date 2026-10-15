# Claude Code and Codex setup

## Shared guidance

Run either agent from the root of the checkout or worktree you intend to change. Claude Code reads `CLAUDE.md`, `.claude/rules/` and `.claude/skills/` through its native discovery. Codex reads `AGENTS.md`, which tells it to load the same project rules, and discovers the entrypoints under `.agents/skills/`.

The Codex skill files refer to the full workflows in `.claude/skills/`; they are ordinary files, so cloning on Windows requires no symlink privileges or generation step. Change workflow instructions in the shared files. When adding a skill, add an entrypoint for both agents and keep their descriptions aligned. When adding a module rule, give it accurate `paths:` frontmatter: Claude uses native matching and Codex follows the loading instructions in `AGENTS.md`.

Keep Claude-specific skill metadata in `.claude/skills/`, including `allowed-tools` grants and trigger examples. Codex entrypoints have their own metadata; reading the shared workflow does not grant Codex the permissions listed for Claude. Validate Claude skills with `claude plugin validate .claude/skills` and Codex entrypoints with the Codex skill validator.

The Codex issue-writer entrypoint maps Claude's command, search, file, question and plan-mode tools to the tools available in the current Codex session. It uses `request_user_input_async` for clarification when available, with a chat fallback. Asynchronous questions do not block execution automatically; the agent must wait for answers before dependent work. Draft approval must be given after the complete draft was shown in either agent.

In either agent, `#issue <description>` creates an issue and `#issue <number>` updates or refines it as requested. Native explicit invocations are `/issue-writer` and `/add-module` in Claude Code, and `$issue-writer` and `$add-module` in Codex. Creating or changing an issue requires approval of the complete draft in both agents, regardless of the host's command approval mode.

Open a fresh session from the intended checkout after changing the setup. In Codex CLI, check `/skills` for both skills; in Claude Code, check the `/` skill suggestions. Ask either agent to list the project instruction files it loaded and the rules it would use for a Python PR review. Expect `CLAUDE.md`, common rules, Python rules, applicable module rules and PR review rules; Codex should also name `AGENTS.md`. This read-only check should not create an issue or edit files.

## Tools and startup

Install Git, GitHub CLI, the agent you use, and Docker Desktop for backend work. Launch Docker Desktop before running container commands. Black and isort may run locally; the project's Docker fallback is in `CLAUDE.md`.

The terminal examples below assume PowerShell 7 on Windows. They are setup commands for your terminal, not a requirement to replace Claude Code's native `Bash` tool. Codex uses its available command tool; when that tool supports profile control, disable interactive profile loading for non-interactive PowerShell commands. To diagnose profile errors in your own terminal:

```powershell
pwsh -NoProfile
```

Check tools from the intended checkout:

```powershell
Get-Command git, gh, docker
git --version
gh --version
docker info --format '{{.ServerVersion}}'
codex --version
claude --version
```

Only the chosen agent needs to be installed. Use the project's scoped Docker test commands from `CLAUDE.md`; do not replace them with a full local suite. For a rules/documentation-only change, skip backend tests and formatters because no Python files changed.

## Git and GitHub checks

Run these in your own terminal first, then in the agent's execution environment if it is sandboxed:

```powershell
whoami
git rev-parse --show-toplevel
git status --short
git branch --show-current
git worktree list
git config --get user.name
git config --get user.email
git remote get-url origin
git ls-remote --exit-code origin refs/heads/main
gh auth status
gh api repos/fibboo/finance --jq '.permissions'
gh project item-list 3 --owner fibboo --format json -L 200 --jq '.items[] | {id, title, status}'
```

The Git identity must be the contributor's chosen name and email. If missing, set it for this repository; substitute your own values:

```powershell
git config --local user.name 'Your Name'
git config --local user.email 'your-address@example.com'
```

Git remote access and GitHub CLI authentication are separate. The repository's SSH remote needs your SSH key/agent even if `gh auth status` succeeds. `git ls-remote` verifies the actual configured remote. The `push` permission from the API checks account authorization; a successful push is the final write-access check.

If GitHub CLI authentication fails in your own terminal, authenticate interactively there:

```powershell
gh auth login -h github.com
```

If GitHub project operations report a missing OAuth scope:

```powershell
gh auth refresh -h github.com -s project
```

For SSH, check the loaded keys with `ssh-add -l`. GitHub's documented connection check is `ssh -T git@github.com`; successful authentication prints a greeting but returns exit code 1 because GitHub provides no shell. If you prefer HTTPS, change only this repository's remote and configure the GitHub credential helper after logging in:

```powershell
git remote set-url origin https://github.com/fibboo/finance.git
gh auth setup-git
git ls-remote --exit-code origin refs/heads/main
```

Do not change an already working remote just to accommodate a sandbox. Never put access tokens or private keys in tracked files, command bodies, logs or shared agent configuration.

## Windows sandbox troubleshooting

| Symptom | Check and remedy |
| --- | --- |
| `detected dubious ownership` | Compare `whoami` and the owner reported by Git. A Windows sandbox may use a different account. If Git works in your own terminal, use the host's approved execution outside the sandbox for Git operations. |
| `gh auth status` reports an invalid token only in the sandbox | Retry with approved user-context execution. Do not log out or replace the user's working credentials based on the sandbox result. |
| Access denied for `.git`, a worktree's Git metadata, SSH agent or credential store | Use the host's approval mechanism or a permission profile that provides the required access. `safe.directory` only handles Git trust; it does not grant filesystem or credential access. |
| Docker config or `docker_engine` pipe access denied | Compare `docker info` in your terminal and in the sandbox. If only the sandbox fails, request permitted user-context execution; if both fail, start or troubleshoot Docker Desktop. |
| `setup refresh had errors` before a command starts | This is host environment preparation, before PowerShell runs. Retry a simple command, restart the app/session if needed, and use host diagnostics if it persists. It does not identify a repository defect. |
| `Set-PSReadLineOption` fails in redirected output | In your terminal use `pwsh -NoProfile`, or disable profile loading when the host's command tool supports it. This does not require switching Claude Code away from its native Bash tool. |

For a repository intentionally owned by another account, the user may explicitly trust its exact absolute path in protected Git configuration. **Only the user runs the following command in their own terminal; agents must not execute it or modify global `safe.directory` settings.** Replace the placeholder with the real absolute checkout path and run as the account that actually executes Git:

```powershell
git config --global --add safe.directory '<absolute-checkout-path>'
```

A separate worktree may need its own exact path. Adding trust to your user profile does not automatically configure a sandbox account. Do not use `safe.directory '*'`, alter ownership or broaden ACLs to work around a sandbox. Prefer permitted execution as the repository owner when that already works.

## Fewer approval prompts in Codex

Use the permissions control below the composer; in Codex CLI use `/permissions`.

- **Approve for me** sends eligible requests to automatic review while retaining the workspace sandbox. Some requests can still require manual approval.
- **Full access** permits filesystem and network operations outside that sandbox without ordinary command approval prompts. Select it yourself for a trusted environment if that is the access you want.
- **Saved command permissions** can reduce repeated prompts for specific Git/GitHub operations while retaining a restricted profile. Save narrowly scoped prefixes offered by the host.

Modes depend on the installed version and managed requirements. A user instruction or an `AGENTS.md` file cannot change the active permission profile. The command approval mode also does not remove the issue workflow's requirement to approve a complete draft.

The installed Codex CLI can also start with automatic approval review:

```powershell
codex --approve-for-me
```

Do not use a never-ask policy as a fix for missing filesystem or credential access: suppressing prompts does not expand the sandbox. Keep machine-specific approval and authentication settings out of shared project files. No global trust, credentials, ownership or permission mode changes are required when approved user-context execution already works.

## Worktrees

Fetch first, then create a separate checkout from `origin/main` for the issue, substituting its number and slug:

```powershell
git fetch origin
git worktree add -b 123-issue-slug --no-track .claude/worktrees/123-issue-slug origin/main
Set-Location .claude/worktrees/123-issue-slug
git rev-parse --show-toplevel
git branch --show-current
```

Git writes worktree metadata in the main repository's `.git/worktrees/`, so permission to write files inside the new checkout alone may be insufficient. Request the necessary Git execution permission rather than repeatedly retrying a denied operation. Do not check out a branch already in another worktree or remove worktrees belonging to another task.

Nested worktrees may appear as untracked files in the main checkout. Never stage the worktree directory. To hide this local workspace artifact without changing the shared `.gitignore`, the user can add `/.claude/worktrees/` to the main repository's `.git/info/exclude`.

A worktree nested under the main checkout can also inherit ancestor `CLAUDE.md` instructions in Claude Code, so the parent checkout's guidance may be loaded alongside the worktree's version. Check `/context` for the actual files loaded. Searches from the main checkout can include copies of files in nested worktrees unless the search tool's exclusions filter them; scope searches to the active checkout and exclude `.claude/worktrees/**` when searching the parent. Sibling worktrees outside the repository avoid these ancestor and search-overlap issues. Existing nested worktrees do not need to be moved for this setup change.

## Sources

- [Codex instruction loading](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Codex skill discovery](https://learn.chatgpt.com/docs/build-skills)
- [Codex permission modes](https://learn.chatgpt.com/docs/permission-modes)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Git safe.directory](https://git-scm.com/docs/git-config#Documentation/git-config.txt-safedirectory)
- [GitHub SSH connection check](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)
