# Guide: Handling Product Feature Upgrades

You should follow this guide to approach a feature upgrade task based on a product requirement document

---

## Step 1: Understand the Requirement and Plan High-Level Approach

- make a directory to store tmp files. name it by the upgrade requirement.
- Read the provided product requirement document and clarify any ambiguity by asking the user if needed.
- Read backend/BACKEND_TECHNICAL_DESIGN.md and frontend/FRONTEND_TECHNICAL_DESIGN.md to get a total picture
- Identify which modules, components, or files are relevant to this feature.
- Based on architecture and file structure, plan the overall approach and write it to overall_plan.md
- Output a summary including:
  - Modules and files to modify
  - Expected behaviors or outcomes

---

## Step 2: Analyze Code and Create a Detailed Upgrade Plan

- Read all related files identified in Step 1 (overall_plan.md). 
- Read backend/BACKEND_TECHNICAL_DESIGN.md and frontend/FRONTEND_TECHNICAL_DESIGN.md to get a total picture
- Understand current logic, dependencies, and edge cases.
- Propose a detailed upgrade plan, including:
  - Specific files and functions to modify
  - What changes are needed (add/remove/update logic)
  - Any required interface adjustments
- write this plan to detailed_plan.md

---

## Step 3: Implement the Code Changes

- Follow the upgrade plan strictly( in detailed_plan.md )
- When developing backend, follow the guide in `backend/BACKEND_TECHNICAL_DESIGN.md`
- When developing frontend, follow the guide in `frontend/FRONTEND_TECHNICAL_DESIGN.md`
- Maintain code consistency using those guide.
- Write modular, testable, and documented code.
- Make clear, atomic commits with descriptive messages.

---

## Step 4: Self-Review and Initial Testing

- Review the updated code:
  - Did it follow the original upgrade plan( in detailed_plan.md )?
  - Are edge cases and errors handled?
- If you find issues, fix them directly and update your plan if needed.

---

## Step 5: Build and Runtime Verification

- Build the project to verify that compilation passes if any.
- Run the project to ensure it starts correctly and logs no runtime errors.
- If errors occur:
  - Analyze logs
  - Isolate cause (code logic or environment)
  - Fix and re-test

---

## Step 6: Write and Execute Tests

- For each updated function or module:
  - Write unit or integration tests that verify correctness and handle edge cases.
  - follow the guide in `backend/BACKEND_TESTING_DESIGN.md` if you are writing backend tests.
  - follow the guide in `frontend/FRONTEND_TESTING_DESIGN.md` if you are writing frontend tests.
  - Use the team’s test framework and naming conventions.
- Run tests for the changed scope only.
- If tests fail:
  - First fix test code bugs.
  - If business logic fails, fix the actual implementation.

---

## Step 7: Regression Testing

- Run all tests (unit, integrationd).
- Ensure no regressions are introduced.
- Fix any side-effects or unexpected behaviors.

---

## Final Output Summary

At the end of the process, the AI agent must provide:
- A description of all code changes
- List of tests written or updated
- Test results (pass/fail)
- Any assumptions or questions for human review

and write to upgrade_summary.md

---

## References

- BACKEND Development Guide: `backend/BACKEND_TECHNICAL_DESIGN.md`
- FRONTEND Development Guide: `frontend/FRONTEND_TECHNICAL_DESIGN.md`

- BACKEND Test Development Guide: `backend/BACKEND_TESTING_DESIGN.md`
- FRONTEND Test Development Guide: `frontend/FRONTEND_TESTING_DESIGN.md`