# Self Tracker: standing rules for AI coding assistants
Project: local-first Windows desktop fitness app (Electron, HTML/CSS/JS). The user and Claude plan and review; you write the code.

## Language
- Reply to the user in Vietnamese only.
- Write all repository content (code, comments, docs, UI text, commit messages) in English.

## Before coding
- Inspect existing code first. Reuse components. No duplicate functionality.
- Follow the task's FILES lists exactly. Touch nothing else.
- Add no new dependency unless the task says so. Never delete working features.
- Electron security: contextIsolation true, nodeIntegration false, expose only what is needed through preload.
- Never invent nutrition values, prices or sources. Never commit secrets.

## After every task (always do all of these)
1. Run the task's TEST yourself and fix problems.
2. Update stage5-progress.html: set the task's status in ST to "WAITING FOR USER" (never "DONE" yourself) and add or refresh its LOG entry with files and notes. Change nothing else in that file.
3. Update the Progress section of README.md (done and next task).
4. Update ARCHITECTURE.md or DATA-SOURCES.md if the task changed what they describe.
5. Commit only this task's files with message "<TASK-ID>: <summary>" and push to origin main.
6. Report: files changed, what was implemented, tests performed, errors, assumptions.

## Status words (only these)
NOT STARTED, READY, IN PROGRESS, WAITING FOR USER, TESTING, BLOCKED, DONE
- When the user writes "DONE <ID>": set ST to "DONE", LOG done to today's date and test to "pass"; update README; commit "<ID>: mark done"; push.
- When the user writes "FAIL <ID>: <what happened>": set ST to "IN PROGRESS", write the problem in LOG notes, fix it, then repeat the steps above.
