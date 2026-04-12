# Save the Pre-Development Review as a Separate Document

## Summary
- Save the current assessment as a new standalone document, not inside `readme.md` or `Architecture.md`.
- Preferred path: `docs/pre-development-review.md`.
- Preferred format: short review document with assessment, key risks, recommended improvements, and locked assumptions before implementation.

## Document Contents
- Title:
  - `Pre-Development Review`
- Short intro:
  - purpose of the review;
  - scope: current architecture/instructions/roadmap docs;
  - date and context: pre-implementation alignment.
- Assessment section:
  - strengths of the current direction;
  - what is already aligned across docs.
- Critical issues section:
  - encoding/mojibake problems;
  - mismatch between Phase 1 foundation spec and Copilot milestone;
  - missing concrete contracts and operational decisions.
- Recommended improvements section:
  - canonical document ownership;
  - Phase 1 re-scope as Copilot;
  - runtime ownership between app, Supabase, and n8n;
  - tenant-safety rules made explicit;
  - conversation lifecycle definitions;
  - KB governance;
  - acceptance/evaluation policy.
- Assumptions section:
  - English as canonical docs language;
  - single-hotel pilot with tenant-safe contracts;
  - Phase 1 includes KB-backed suggested replies;
  - n8n is not core domain owner.

## Placement and Cross-Links
- Create `docs/` if it does not exist yet.
- Add a short link from `readme.md` to the new review doc in the documentation area or near the milestone/architecture sections.
- Optionally add a short reference from `Architecture.md` noting that the review captured pre-build gaps and alignment decisions.

## Test Plan
- Confirm the new document does not duplicate the whole architecture doc.
- Confirm it is actionable and scoped to “before we start building”.
- Confirm the chosen recommendations match current decisions:
  - single-hotel pilot;
  - English canonical docs;
  - Phase 1 = Copilot, not infra-only.

## Assumptions
- The next execution step will be to create `docs/pre-development-review.md`.
- The content should be based on the review already produced, with light editing for document readability rather than a full rewrite.
