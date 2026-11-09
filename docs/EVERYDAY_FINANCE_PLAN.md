# FalconEye: everyday-finance product and UI implementation plan

## Product promise

Your money, wherever it is. One clear picture.

Initial audience: people managing personal or family savings across formal and informal assets without one dependable overview. Financial expertise is not a prerequisite.

Not a broker, payment service, financial adviser, or guaranteed live valuation service.

## Experience architecture

- Overview: recorded assets, debts, estimated net worth, access, incomplete valuations.
- My assets: searchable and filterable records, guided category-specific entry and editing.
- My debts: outstanding liabilities, not original borrowing.
- Activity: contributions, withdrawals, repayments, income, fees, dated valuations.
- Reports: print, CSV, JSON backup, methodology, limitations.
- Settings: display currency, dated exchange rates, data controls, explicit cloud actions.
- Falc: persistent conversational entry, local explanations, editable drafts, explicit save confirmation.
- Welcome: preserve consented interest registration; never silently turn leads into accounts.
- Admin outreach: separate internal reporting; current historical tracking gaps are not reconstructable.
- Design guide: visual, printable UX blueprint, not fabricated user-research results.

## Visual language

Keep Wingline identity; warm cream, navy/teal, and gold accents. High-contrast text, readable hierarchy, consistent icons beside labels. Avoid relying on color alone.

Desktop: predictable primary navigation. Mobile: reachable primary actions, responsive lists and forms. Large touch targets; no full-page horizontal overflow. Preserve keyboard focus, dialog labels, reduced motion, visible validation, loading and empty states.

Use plain language: "What you paid", "Current value", "Value as of", "What you owe", "How quickly you can access it". No unqualified health score.

## Financial model

Separate assets, liabilities, events, and valuations conceptually. Persist a versioned document with optimistic concurrency for the first implementation; split into relational entities when query/audit requirements justify it.

Categories: cash, gold, stocks, funds, crypto, IPOs, private investments, money lent, bonds/sukuk, property, debts.

Unknown values remain null. Record original currency. Only convert using a known positive exchange rate with an explicit date. Missing currencies exclude those records from converted totals and flag the summary incomplete.

Gold: weight and purity, purchase cost, manually supplied estimated resale value; no automatic inclusion of making charges as recoverable value.

IPOs: application versus allocation. Do not record the same application funds and allotted shares twice. Refunds must be reflected consistently, not added as free investment gains.

Private investments: distinguish equity, loans, and gifts. Gifts are excluded from assets. Principal, repayment, and distributions mean different things.

Property: clearly explain whether recorded value is the user's share; never apply ownership percentage twice. Mortgage remains a separate liability.

Activity must have documented effects. Cash transfers and distributions must not create fabricated profit. Portfolio performance cannot be inferred from incomplete cash-flow history.

## Falc interaction contract

1. User types a description or activates browser dictation.
2. Local guided mode parses only supported patterns and asks for missing details.
3. Optional AI mode sends the displayed conversation to the configured provider only after explicit opt-in.
4. Assistant prepares a draft; no arbitrary function execution, SQL, trades, bank actions, or autonomous writes.
5. Editable review card displays category, name, currency, cost, value, date and relevant agreement details.
6. Explicit "Confirm and save" validates and records the entry.
7. App reports success only after the store accepts it.

No claim that a keyword guide is a language model. No microphone activation without user action. Browser speech may use a provider; disclose that before recording. Do not store audio.

## Cloud and privacy release gate

Existing portfolio data is local to the browser. Secure cloud accounts require Supabase Auth configuration plus the reviewed migration.

- HttpOnly session cookies, secure in production, SameSite and origin checks.
- Verify sessions with Supabase rather than trusting client-supplied user IDs.
- Scope all financial reads and writes to the authenticated owner.
- Enable row-level security; deny anonymous access.
- Validate documents, lengths, categories, finite amounts and dates.
- Reject sample uploads as personal records.
- Explicit upload/download, no silent overwrite; revisions prevent concurrent last-write-wins.
- Do not log secrets, passwords, session tokens, conversation content or financial records.
- Account recovery and full account deletion must be accurately described and verified; deleting financial records is not deleting a Supabase identity.
- Protect admin data before a public financial-data beta.
- Back up and test restoration before applying production schema changes.

Never apply migrations or change the live deployment as part of an unapproved merge.

## Migration and reversibility

Preserve `falcon-eye:v1` unchanged. New local storage uses a versioned separate key. Preserve non-empty owned portfolios. Label samples and require an explicit start-own-records action. Preserve deliberate empty resets. Never auto-upload browser data.

Roll back application code without dropping user data. Do not drop new tables during an application rollback. Export the browser document and database records first.

## Acceptance criteria

- Beginner can add gold, an IPO, a private investment, and a debt without ticker knowledge.
- Unknown values and missing exchange rates cannot silently become zero.
- Gold purity, debt balances, gifts and FX calculate consistently.
- Each supported activity has tested effects and no duplicate application.
- Samples never silently mix with personal records.
- Browser records survive refresh; old source data remains intact.
- Exported figures agree with displayed figures.
- Authentication failure cannot return another user's financial document.
- Anonymous/cross-origin writes fail; stale revisions conflict rather than overwrite.
- Assistant drafts cannot save without confirmation.
- Mobile and keyboard flows work.

## Expansion backlog: not falsely represented as complete

Household invitations and role-based sharing; private document uploads with malware/type/size controls; live market/gold feeds and terms; automatic FX; Arabic translation with RTL review; historical net-worth snapshots; reminders; durable distributed rate limiting; observability and privacy policy review; verified backup/restore drill; small invited beta and actual usability measurements.

These require provider configuration, security verification, and/or evidence from real users. They are not justified as working merely because a screen exists.

## Pilot

Invite 10–15 people with genuinely scattered finances. Ask each to record three real assets and a debt if applicable, explain their position, then return and update it. Set success criteria before examining results. Record misunderstandings and repeat use, not just registrations.
