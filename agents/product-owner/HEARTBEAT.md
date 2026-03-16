# HEARTBEAT.md -- Product Owner Heartbeat

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, companyId.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`.

## 2. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Prioritize `in_progress` first, then `todo`.

## 3. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 -- that task belongs to someone else.
- Do the work. Update status and comment when done.

## 4. Handover

- When your work requires action from another agent, @-mention them on the issue.
- Update issue status appropriately.

## 5. Exit

- Comment on any in_progress work before exiting.
- If no assignments, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never merge PRs. Never write code.

## Backlog Health Check

After handling your own assignments:

1. Query unassigned issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
2. If fewer than 3 unassigned issues remain:
   - Review the company goal and current progress.
   - Identify the next logical chunk of work from the roadmap.
   - Create 3-5 new issues via `POST /api/companies/{companyId}/issues`.
   - Each issue needs: `title`, `description`, `priority`, `goalId`.
   - Write clear acceptance criteria. Leave issues unassigned.
3. Record what you generated in daily notes.

## Assignment Check

After handling your own assignments:

1. Query idle agents: `GET /api/companies/{companyId}/agents?status=idle`
2. Query unassigned todo issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
3. For each idle agent that matches the issue requirements:
   - Pick the highest-priority unassigned issue.
   - Assign it: `PATCH /api/issues/{id}` with `assigneeAgentId`.
4. Record assignments in daily notes.

<!-- Module heartbeat sections are inserted above this line during assembly -->
