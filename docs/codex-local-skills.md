# Codex Local Skills

This repository keeps its custom Codex skills in `.codex/skills`.

The current Codex setup does not automatically load repo-local skills from that folder. The active custom skills directory for this machine is `C:\Users\Solley\.codex\skills`, so the repo skills need to be synced there.

## Sync repo skills into Codex

Run this command from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-codex-skills.ps1
```

What the script does:

- finds every subdirectory in `.codex/skills` that contains `SKILL.md`;
- copies each skill into `C:\Users\Solley\.codex\skills\<skill-name>`;
- overwrites existing installed copies with the repo version;
- writes an ownership marker into each installed skill;
- updates a manifest in `C:\Users\Solley\.codex\skills\.repo-sync-manifests\hotelAI.json`.

## Remove only repo-synced skills

If you want to remove only the skills installed from this repository, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\remove-codex-synced-skills.ps1
```

The cleanup script reads the manifest and removes only skills marked as owned by this repository.

## Notes

- Restart Codex after syncing. New or updated skills are not guaranteed to appear in the current session.
- The repo-local `skill-creator` intentionally overrides the globally available skill with the same name on this machine.
- `.codex/skills/SKILL_ANATOMY.MD` is reference documentation, not an installable skill, so it is skipped by the sync script.
- The source of truth remains `.codex/skills`; the global Codex directory is just the runtime install location.
