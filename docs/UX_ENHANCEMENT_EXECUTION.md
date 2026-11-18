# Everyday-finance experience improvements

## Goal and boundaries

Make the existing financial picture understandable without finance expertise.
Preserve stored documents, identifiers, calculations, legacy data, registration,
outreach and all three display languages. No database or deployment changes.

The existing store already rejects personal additions to a sample. Improve that
blocked path with an explicit transition before entry; do not weaken the guard.

## Implementation sequence

1. Trust and clarity: distinguish included stale values from excluded missing
   values/rates; link each affected record to editing; explain browser-only
   storage; make sample-to-personal entry explicit and preserve drafts.
2. Easier entry: visible category choices, details and final review; accurate
   requiredness, expandable optional details, persistent navigation controls.
   Keep category-specific financial validation and explicit saves.
3. Home and Reports: compact language choice, money-first hierarchy, one review
   destination, contextual next actions, proportional allocation bars and one
   download menu. Keep storage and sample qualifications visible.
4. Falc and navigation: clearer missing-information guidance and direct recovery
   from sample mode without losing a draft; mobile Reports access; move team
   links out of everyday navigation. Increase readable text and touch targets.
5. Verify: financial/review regression tests, localization guards and full build;
   isolated desktop/mobile browser checks including Arabic, retained drafts,
   explicit save, affected-record links and unchanged owned records.

## Review findings mapped to scope

- F01 financial meaning: shared review classification and explicit explanations.
- F02 requiredness: per-field required markers, no blanket optional section.
- F03 sample boundary: upfront, confirmed transition; store guard unchanged.
- F04 storage trust: local-only warning/backup and unavailable account state.
- F05 Home hierarchy: compact languages, shorter hero, review and backup actions.
- F06 readability: readable support copy and comfortable control targets.
- F07 entry: guided stages, familiar categories, optional details collapsed.
- F08 Reports: plain-language summary, actionable review, consolidated downloads.
- F09 Falc: recovery and focused questions, preserving explicit confirmation.
- F10 navigation: Reports reachable on mobile; team links under Settings.
- F11 languages: paired semantic copy, formal preserved, simple overrides only.
- F12 return value: actionable review of existing records, no invented reminders,
  historical trends, scores, live prices or returns.

## Acceptance and deferred evidence

- Old included values and missing excluded values never share an ambiguous count.
- Unknown value remains null; gifts remain excluded; no financial formula changes.
- Sample addition cannot save into the sample or clear it without confirmation.
- Entry retains values through Back/Next and language changes; review never saves.
- Existing records remain editable and persisted with the same IDs.
- Home, Reports, forms and Falc remain usable at mobile widths in all languages.
- Account/email/AI availability is not represented as configured by this work.
- Publish a reviewable PR with actual checks and visual evidence, not a direct
  production merge.

Native-speaker review, five-person usability research, verified live account
flows, authenticated administration and operational restore testing remain
separate release gates. Test success is not evidence of adoption or usability.
