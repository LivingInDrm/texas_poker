# 🧠 Agent Workflow: Product Feature Upgrade

This document defines the workflow that the AI agent must follow to complete a product upgrade task, based on a requirement document and existing technical design files.

---

## Step 1: Understand the Requirement and Plan High-Level Approach
> **Do not write any code yet.**

**Objective**: Understand what needs to be upgraded and outline which modules and files are involved.


### Actions:

1. Create a working directory named after the task (e.g., `upgrade-add-user-stats/`).
2. Read the product requirement document.
3. If any part is ambiguous or unclear, ask the user for clarification.
4. Read the following technical design documents:
   - `backend/BACKEND_TECHNICAL_DESIGN.md`
   - `frontend/FRONTEND_TECHNICAL_DESIGN.md`
5. Identify which modules, components, or files are involved.
6. Write your high-level understanding to `overall_plan.md` inside the task directory.

### Output: `overall_plan.md` structure

```markdown
# Overall Upgrade Plan

## Goal
Summarize the business objective.

## Affected Modules
- backend/xxx/
- frontend/components/xxx.tsx

## High-Level Actions
- Add new field to API request schema
- Render new field in frontend UI
- Update database write logic
```

---

## Step 2: Analyze Codebase and Create a Detailed Upgrade Plan
> **Do not write code yet.**


**Objective**: Fully understand relevant code and plan exact changes.

### Actions:
1. Read all relevant source code referenced in `overall_plan.md`.
2. Trace existing logic, API interactions, edge cases, and dependencies.
3. Think carefully (`think`, `think hard`, `ultrathink`) about what needs to change.
4. Write a concrete, scoped plan in `detailed_plan.md`.


### Output: `detailed_plan.md` structure

```markdown
# Detailed Upgrade Plan

## Backend

- Modify `user_service.py`: add logic for tracking stats
- Update DB schema: add `daily_stats` field to user model

## Frontend

- Add new prop to `UserCard.tsx`
- Display stats in `UserProfile.tsx`

## External Dependencies

- Add new migration: `user_add_stats.sql`
```

---

## Step 3: Implement the Code Changes

**Objective**: Modify the code according to plan.

### Actions:

1. Follow the steps in `detailed_plan.md`.
2. For backend code:
   - Follow `backend/BACKEND_TECHNICAL_DESIGN.md` conventions.
3. For frontend code:
   - Follow `frontend/FRONTEND_TECHNICAL_DESIGN.md` conventions.
4. Ensure code is:
   - Modular
   - Testable
   - Properly documented
5. Make atomic commits with descriptive messages.

---

## Step 4: Self-Review and Initial Testing

**Objective**: Ensure the code matches the plan and is logically correct.

### Actions:

1. Review all modified files:
   - Do they align with the plan?
   - Are all edge cases and failure conditions covered?
2. If any issues are found:
   - Fix the issue
   - Update `detailed_plan.md` if needed

---

## Step 5: Build and Runtime Verification

**Objective**: Ensure the app compiles and runs successfully.

### Actions:

1. Build the project (backend and frontend).
2. Start the application.
3. Check for any runtime or console errors.
4. If errors occur:
   - Read logs
   - Diagnose root cause
   - Fix and re-run

---

## Step 6: Write and Execute Tests

**Objective**: Write tests to validate new functionality and prevent regressions.

### Actions:

1. For each modified function/module:
   - Write unit or integration tests.
2. Follow:
   - `backend/BACKEND_TESTING_DESIGN.md`
   - `frontend/FRONTEND_TESTING_DESIGN.md`
3. Follow the project's testing framework and naming conventions.
4. Run only relevant tests.
5. If tests fail:
   - If due to test code: fix the test
   - If due to logic: fix the implementation

---

## Step 7: Regression Testing

**Objective**: Ensure no existing functionality is broken.

### Actions:

1. Run the full test suite (unit + integration).
2. Fix any regressions or side-effects.

---

## Step 8: Summarize the Task

**Objective**: Report final outcome and share reasoning with the user.

### Actions:

1. Write a final report to `upgrade_summary.md`

### Output: `upgrade_summary.md` structure

```markdown
# Upgrade Summary

## 1. Overview
- Task: Add user stats tracking
- Time: 2025-06-20 15:42
- Commits: 5
- Files modified: 8

## 2. Tests
- Unit tests added: 4
- Updated tests: 3
- All tests passed: ✅

## 3. Assumptions
- Daily stats are computed only on login
- `UserCard` is only used in profile page

## 4. Open Questions
- Should inactive users be excluded from stats?
```

---

## Reference Documents

- 📘 Backend Design Guide: `backend/BACKEND_TECHNICAL_DESIGN.md`
- 🎨 Frontend Design Guide: `frontend/FRONTEND_TECHNICAL_DESIGN.md`
- 🧪 Backend Test Guide: `backend/BACKEND_TESTING_DESIGN.md`
- 🧪 Frontend Test Guide: `frontend/FRONTEND_TESTING_DESIGN.md`

---

## Optional: Task Status Log

Write status after each step to `progress_log.md`, e.g.:

```text
[✓] Step 1 complete — 2025-06-20 14:05
[✓] Step 2 complete — 2025-06-20 14:45
[✓] Step 3 complete — 2025-06-20 15:12 (3 commits)
```