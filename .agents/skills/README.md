# REDLINE repository skills

Audited and installed on 24 October 2026. This installation adds agent guidance
only. It does not implement application features or change project policy.

## Installed packages and provenance

The AgenticSkills pages were used to locate the official repositories. The
instructions and licenses below were read directly from the pinned upstream
sources, rather than copied from the directory summaries.

| Skill | Official upstream | Pinned revision | License | Files |
| --- | --- | --- | --- | --- |
| `verification-before-completion` | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/verification-before-completion) | `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b` | MIT, copyright 2025 Jesse Vincent | `verification-before-completion/SKILL.md`, `verification-before-completion/LICENSE` |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design) | `dbd4588f9e1033efb41dad4bef2f7947c8993d44` | Apache-2.0 | `frontend-design/SKILL.md`, `frontend-design/LICENSE.txt` |
| `writing-plans` | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/writing-plans) | `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b` | MIT, copyright 2025 Jesse Vincent | `writing-plans/SKILL.md`, `writing-plans/LICENSE` |

All installed `SKILL.md` files are unchanged upstream copies. The MIT license was copied
from the Superpowers repository root so each standalone package retains its
required copyright and permission notice. The frontend package includes its
own full Apache license; no applicable ancestor `NOTICE` file was found in the
pinned tree. Keep the license files when redistributing these folders. If the
Apache-licensed files are modified later, retain notices and identify changes.

### Installation method

[Official OpenAI documentation](https://learn.chatgpt.com/docs/build-skills)
supports direct skill folders under the repository's `.agents/skills/`, with
`name` and `description` in YAML frontmatter. `agents/openai.yaml` is optional.
The built-in Codex installer was used with an explicit repository destination
and immutable revision:

```powershell
python C:/Users/LOQ/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo obra/superpowers --ref 2ce8aa15d05bd57213e6f746f953aafb7ded7a8b --path skills/verification-before-completion --dest D:/Projects/REDLINE/.agents/skills
python C:/Users/LOQ/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo anthropics/skills --ref dbd4588f9e1033efb41dad4bef2f7947c8993d44 --path skills/frontend-design --dest D:/Projects/REDLINE/.agents/skills
python C:/Users/LOQ/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo obra/superpowers --ref 2ce8aa15d05bd57213e6f746f953aafb7ded7a8b --path skills/writing-plans --dest D:/Projects/REDLINE/.agents/skills
```

The installer refuses existing destination folders; these commands are a record
of the installation, not an overwrite/update procedure. The MIT license was
downloaded separately from `LICENSE` at the same pinned Superpowers revision.
No third-party CLI, complete plugin, bootstrap hook, symlink, npm dependency,
browser server, or automatic updater was installed.

## Compatibility and instruction audit

### verification-before-completion

- Instruction-only, with valid Codex-compatible frontmatter. No external skill,
  agent-specific tool, executable helper, or runtime package is required.
- Its evidence-before-success rule largely repeats REDLINE's existing
  verification and commit rules. It is retained as the requested reusable
  workflow; the project rules still determine the relevant checks.
- The regression-test example includes temporarily reverting a fix. This is
  guidance, not authorization to reset Git, discard user changes, or rewrite
  history. Preserve work and use an isolated/reversible approach if that check
  is actually needed.
- Broad demands for fresh checks must stay proportional to the claim: run the
  complete relevant checks, and do not repeatedly rerun unrelated suites or
  claim an unavailable check passed. Nothing in this skill authorizes a push,
  deployment, PR publication, or delegation.

### frontend-design

- Instruction-only; its `name`, `description`, and `license` frontmatter is
  supported. No Claude-only tool, mandatory library, or companion skill is used.
- The upstream instructions explicitly give the client's brief priority over
  generic aesthetic advice. REDLINE's map-first workspace, prescribed design
  direction, accessibility requirements, and scientific integrity remain the
  constraints for any future design work.
- The advice to invent copy/placeholders must never be used to fabricate Mars
  measurements, targets, observations, citations, or safety claims. Follow the
  project's provenance and conspicuous demo-label requirements.
- Design planning, responsive behavior, focus, reduced motion, and critique
  overlap with existing project guidance. The skill adds reusable typography,
  layout, restraint, and interface-writing guidance rather than a new stack.
- A personal copy already exists at
  `C:/Users/LOQ/.codex/skills/frontend-design/`. It was preserved. Codex reports
  both copies separately; do not assume identical names are merged or that the
  repository copy automatically replaces the personal copy. Both copies were
  byte-identical at this audit.

### writing-plans

- The pinned upstream folder contains only `SKILL.md` (10,335 bytes), with valid
  `name` and `description` frontmatter. It has no local companion files, scripts,
  executable hooks, telemetry, mandatory runtime package, or skill dependency
  required to write and self-review a plan. The root MIT license is included
  separately as `writing-plans/LICENSE`.
- The upstream skill and its direct workflow references were inspected before
  installation: `executing-plans`, `subagent-driven-development`, and
  `using-git-worktrees`, at the same pinned revision. The subagent implementer
  template and final-review reference were also read to identify later review
  and cleanup requirements. None of those packages was installed or executed.
- Planning preserves existing code patterns and user-selected plan locations.
  Its default `docs/superpowers/plans/` output, mandatory plan header, TDD steps,
  exact interfaces, self-review, and review-before-implementation handoff are
  guidance for a future planning request. This installation creates no plan
  document and grants no permission to implement features or install more skills.
- Python/pytest snippets are examples, not REDLINE's stack or runnable checks.
  Apply the existing project package manager, meaningful tests, milestone commits,
  scientific integrity, and current authorization when making a real plan.
- Codex discovers this as the standalone repository skill `$writing-plans`,
  with `pluginId: null`. This does not register a Superpowers plugin or prove
  that the prefixed `superpowers:writing-plans` invocation resolves. The native
  standalone name/path is available; no namespace adapter was added.

#### Dependencies for later implementation

| Dependency | When needed | Current status |
| --- | --- | --- |
| `executing-plans` **or** `subagent-driven-development` | Required by the generated plan header and selected execution handoff; choose one execution approach | Neither installed |
| `using-git-worktrees` | Conditional worktree reference in planning; both upstream executors use it for isolation | Not installed |
| `test-driven-development` | Required by the native executor before its first task | Not installed |
| `requesting-code-review` | Referenced by both executors for the final reviewer template | Not installed |
| `finishing-a-development-branch` | Required final handoff from both upstream executors | Not installed |
| `systematic-debugging` | Used by the native executor when implementation is wrong | Not installed |
| `verification-before-completion` | Governs native executor completion claims | Already installed locally |

The native executor also uses scripts from the subagent package, so selecting
`executing-plans` alone would not supply its complete supporting files. These
later packages need a separate dependency/compatibility audit if requested;
this table is not a claim that their full transitive closure is approved.
Executor references include Bash workspace helpers and eventual cleanup. None
was run. Worktree creation, subagents/model overrides, cleanup, external actions,
and additional approvals must continue to respect Codex and REDLINE instructions.

### brainstorming: not installed

Official source reviewed:
[obra/superpowers/skills/brainstorming](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/brainstorming),
at revision `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b`. It is covered by the
same upstream MIT license. No `brainstorming/` directory was created.

The manifest is structurally portable, but the current upstream workflow is not
self-contained in this installation:

- It requires `superpowers:writing-plans` after design approval, and specifies
  invoking that skill and no other skill. The initial installation audit found
  it missing. The later installation now supplies standalone `$writing-plans`;
  plugin-prefixed invocation and the complete execution handoff remain unverified.
  This change does not install or re-approve brainstorming or its companion.
- Its broad creative-work trigger, additional approach/design approvals, and
  per-message questions can conflict with already-authorized execution and
  Codex's separate clarification tools. The opt-out and clear-task exceptions
  do not settle the remaining workflow compatibility issues.
- It directs writing and committing design documents under
  `docs/superpowers/specs/`, and a project-sized design uses a builder subagent
  (with a self-review fallback). These are workflow choices to audit separately,
  not permission to add files, delegate, or change the project specification in
  this installation task.
- The upstream instruction that the skill need never be quoted cannot override
  this environment's requirement to disclose skill-caused approval gates.
- The optional visual companion requires additional local Markdown, HTML,
  JavaScript, a Node server, and Bash start/stop scripts. Those scripts are not
  direct PowerShell entry points; their Windows lifecycle was not exercised.
  The reviewed scripts contain process signals, forced termination, and
  `rm -rf` cleanup under a textual `/tmp/` prefix check. That check is not a
  resolved-path containment check and must not substitute for this environment's
  filesystem safety requirements.
- The companion defaults to loopback, but supports binding other interfaces.
  The upstream README discloses a default remote logo request that reports the
  Superpowers version, with a telemetry opt-out. No companion was started and
  no such telemetry was activated here.

The current [upstream README](https://github.com/obra/superpowers/blob/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/README.md)
describes Codex support through the full plugin. This finding concerns the
requested isolated repository skill, not a claim that Superpowers cannot work
in Codex. No silent rewrite or older version was substituted.

## Initial installation validation results

- Both installer commands exited **0**.
- The bundled `skill-creator/scripts/quick_validate.py` exited **0** for each
  installed folder and reported `Skill is valid!`. Required metadata, supported
  keys, naming, description length, and unfinished scaffold checks passed.
- Neither the default nor bundled Python initially had PyYAML, so the validator
  could not import it. PyYAML **6.0.3** was installed with `--no-deps --target`
  into a temporary directory, and supplied to the validator through a
  subprocess-only `PYTHONPATH`. Validation used Python's `-X utf8` flag. No
  global Python environment or repository dependency manifest was changed.
  The temporary protocol schemas and validation dependencies were removed after
  the checks.
- The actual installed executable, **codex-cli 0.163.0-alpha.11.2**, was queried
  through a fresh stdio app-server using `initialize` and
  `skills/list` with `cwds: ["D:/Projects/REDLINE"]` and `forceReload: true`.
  Both installed skills were returned with **scope `repo`, enabled `true`**,
  their exact local `SKILL.md` paths, and **zero skill errors**. No model turn or
  application implementation was started. The audit-owned server was stopped.
- The same loader showed the preserved user-scoped `mars-data-integrity` and
  personal `frontend-design`; it returned no `brainstorming` or `writing-plans`.
- All four installed skill/license files matched the pinned upstream bytes and
  are ordinary files. Directory basenames match frontmatter names, the license
  reference resolves, and neither installed skill has missing supporting files.
- SHA-256 comparisons confirmed `AGENTS.md`, the project specification, the
  existing `mars-data-integrity/SKILL.md`, and the personal frontend skill were
  unchanged. Git whitespace and scope checks were also run before committing.
- No package scripts, application code, lint configuration, TypeScript checks,
  unit tests, build, or running application existed in this repository at the
  audit. Application checks and feature smoke tests are therefore unavailable
  and outside this skills-only task. Whole-plugin/other-agent upstream test
  harnesses were not run for these extracted instruction-only packages.

### Installed file hashes (SHA-256)

| File relative to `.agents/skills/` | SHA-256 |
| --- | --- |
| `verification-before-completion/SKILL.md` | `2befe7fc55bcadaa3d97dd9e8efeb633d2561c0ebe74c5a8b17c4d9e7e4520b3` |
| `verification-before-completion/LICENSE` | `a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400` |
| `frontend-design/SKILL.md` | `d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3` |
| `frontend-design/LICENSE.txt` | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` |
| `writing-plans/SKILL.md` | `a6c67c1900064347c2a329990dd3c555657c51c3ec53b259a08aa01a2c26139a` |
| `writing-plans/LICENSE` | `a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400` |

## writing-plans installation validation

The follow-up installation on 24 October 2026 added only
`writing-plans/SKILL.md`, `writing-plans/LICENSE`, and changes to this audit.

- The pinned installer command above exited **0**. Both new files matched the
  upstream bytes and their hashes above. Directory name and metadata match;
  there are no missing local references, scripts, or symlinks in the package.
- `quick_validate.py` exited **0** and reported `Skill is valid!`. PyYAML 6.0.3
  was downloaded as a wheel into an OS temporary directory and imported directly
  from that wheel for this check. No package was installed into the repository
  or either Python environment. Reproduce the validator check with:

```powershell
python -m pip download --no-deps --only-binary=:all: --disable-pip-version-check --dest C:/Users/LOQ/AppData/Local/Temp/redline-writing-plans-audit-dqe96xob PyYAML==6.0.3
python -X utf8 -c "import sys, runpy; sys.path.insert(0, 'C:/Users/LOQ/AppData/Local/Temp/redline-writing-plans-audit-dqe96xob/pyyaml-6.0.3-cp314-cp314-win_amd64.whl'); sys.argv = ['C:/Users/LOQ/.codex/skills/.system/skill-creator/scripts/quick_validate.py', 'D:/Projects/REDLINE/.agents/skills/writing-plans']; runpy.run_path(sys.argv[0], run_name='__main__')"
```

- The actual Codex app-server was started with `codex app-server --stdio` and
  sent `initialize`, `initialized`, then this loader request:

```json
{"id":2,"method":"skills/list","params":{"cwds":["D:/Projects/REDLINE"],"forceReload":true}}
```

  It returned `writing-plans` at
  `D:/Projects/REDLINE/.agents/skills/writing-plans/SKILL.md`, **scope `repo`,
  enabled `true`, pluginId `null`**, with **zero loader errors**. Existing local
  skills and the user-scoped Mars integrity skill remained discoverable. The
  later dependencies in the table were absent, except the existing verification
  skill. Closing stdin let the audit server exit normally with code **0**;
  no process signal or termination command was issued.
- Preservation hashes were checked for all pre-existing repository files except
  this intentionally updated README, and both existing personal skill folders.
  Only the approved skill and audit paths were staged; Git diff, status, and
  whitespace checks were reviewed before the checkpoint commit.
- No companion script, telemetry functionality, process termination command, or
  explicit cleanup command was run. The small validation wheel, preservation
  snapshot, and loader result remain in the OS temporary audit directory above.
  No application build/test was added or run; there is no application in this
  repository, and no model turn was started to exercise future planning behavior.

## Use and remaining limits

The skills are available for repository discovery and normal matching; no
explicit-only invocation policy was added. Invoke them by their skill name and,
where the selector is ambiguous, specify the repository-local path.

The loader check proves discovery and metadata compatibility. It does not prove
future model adherence or application design quality. No future design or
verification task was simulated by modifying application code. If the desktop
selector has not refreshed, use a new turn or restart Codex as documented.

Recommended next step: use the installed verification workflow on the next
authorized REDLINE milestone. Reconsider brainstorming only after separately
deciding whether to adopt its dependent suite and approval/companion workflow,
or requesting an explicitly documented Codex-specific adaptation.
