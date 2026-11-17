# English and Arabic localization

## Scope and release criteria

Use one application and one financial model. Arabic is Modern Standard Arabic, not a translated fork. English remains available everywhere. Do not merge or publish until the user approves the completed PR.

The completed implementation must include the everyday-finance workspace, record/activity editors, account controls, Falc, early-access registration, prototype outreach administration, design guide, legacy portfolio routes, navigation, accessible names, dialogs, notices, and human-readable reports. User-entered names, notes, imported data, institution names, tickers, and currency codes are not translated or rewritten.

## Current implementation checkpoint

This is an unfinished refactor, not a release-ready Arabic version.

- Implemented: language infrastructure, paired catalogs, Arabic font, root direction, navigation, common dialogs, and core Home/Assets/Debts/Activity/Reports/Settings copy. A language switch is available inside dialogs so an unsaved form can retain its values.
- Implemented guards: catalog/parameter parity, literal missing-key checks, uncatalogued literal-copy detection in migrated components, category coverage, actual Arabic plural selection, unchanged financial precision/documents, and language preference precedence. These guards are not a claim that the still-untranslated screens are covered.
- Remaining: record/activity editor copy, account controls, Falc UI and bounded Arabic conversations, public registration/admin, design guide, legacy routes, remaining error notices/accessibility labels, and the final cross-feature browser pass.
- No merge or production deployment is authorized by this checkpoint. Existing public account/email/AI configuration is unchanged.

### 1. Shared foundation

- Use i18next and react-i18next with explicit semantic message IDs and feature namespaces.
- Maintain matching English/Arabic catalogs. Keep interpolation values named, and use Arabic's zero/one/two/few/many/other plural forms where sentences depend on counts.
- Resolve an explicit `?lang=en|ar` first, then the saved language, then a supported browser language. Fall back to English. Keep the preference separate from financial records.
- Apply `html.lang`, `html.dir`, and Radix direction context together. Bundle the Arabic font locally.
- Provide a discoverable English / العربية switch in desktop and mobile navigation. Switching must not clear a form, replace records, alter currency, change an attribution channel, or trigger a financial write.

### 2. Screen migration

- Translate whole sentences rather than concatenating translated fragments. Use named interpolations, not positional placeholders. For emphasis use `Trans` with explicitly reviewed React component slots, never raw HTML or `dangerouslySetInnerHTML`.
- Translate UI metadata by stable category/activity IDs, never by changing stored enum values.
- Preserve API paths, document schema, storage keys, revisions, financial precision, permissions, and existing ownership/session guards.
- Preserve exact backend deletion-confirmation tokens; explain them in translated prompts. Display emails, tickers, URLs, ISO dates, and numeric input as isolated LTR content where necessary.
- Falc must understand a documented bounded Arabic vocabulary as well as English. Arabic saves require an equally explicit confirmation; changing language must never save a draft. Optional AI must receive the requested response language without gaining additional tools or permissions.
- Localize known service notices at the presentation boundary. Unrecognized technical errors receive safe localized guidance; never translate arbitrary user data or pretend an unavailable service succeeded.

### 3. RTL and formatting

- Prefer logical spacing, borders, positioning, and text alignment. Mirror directional navigation arrows only, not logos, asset marks, charts, or all SVGs.
- Test actual RTL dialogs and portals, not just the sidebar.
- Use the selected display locale with `Intl`. Keep Gregorian dates explicit for financial comparisons and ISO dates in storage.
- Keep Latin financial digits in this first bilingual release and explain numeric entry. Currency codes remain unmodified and displayed currency units must stay unambiguous. Accept Arabic text for names/notes and normalized Arabic digits in conversational input. Changing the UI language never changes the base currency or exchange rate.
- Localize printed reports and human-facing CSV headings. Keep JSON backup field names, IDs, values, and schema language-neutral and interoperable.

### 4. Verification

- Catalog checks: English/Arabic key parity, interpolation parity, missing-key detection, and required Arabic plural categories.
- Pure tests: unchanged money precision/calculations, language-independent backups, Arabic Falc extraction, and explicit-confirmation boundaries.
- Full existing typecheck/build/test suite must pass.
- Browser tests: English → Arabic → English, refresh persistence, RTL desktop/mobile layout and dialogs, no horizontal overflow, mixed Arabic/English/tickers/currencies, retained draft values, and unchanged financial totals.
- Use an isolated API fixture for registration/outreach/account screenshots. Do not generate real visits, registrations, emails, accounts, or cloud financial writes during localization tests.
- Inspect browser evidence, review the complete diff, and publish a PR with verified results and remaining limitations. Mock-provider evidence is not live-provider verification.

## Maintenance rules

1. Add a stable message ID to both catalogs in the same change. Editing copy must not rename the ID.
2. Keep financial/domain code independent of React and the active browser language.
3. Never use DOM text replacement, automatic translation of stored data, duplicate Arabic components, or a CSS transform on the entire page.
4. Add coverage tests for new namespaces and new count-dependent messages. Do not add English fallback text as a substitute for an Arabic translation.
5. Include desktop/mobile English and RTL checks when changing shared layout, forms, charts, or financial display.
6. Keep a small terminology glossary. Prefer everyday language: الأصول (assets), الديون (debts), صافي الثروة (net worth), القيمة التقديرية (estimated value), الأموال المُقرضة (money lent), اكتتاب عام (IPO), حفظ في السحابة (save to cloud). Do not imply a live price, guaranteed value, or investment recommendation.

## Deployment boundary

This refactor does not configure Supabase, activate production email or account deletion, add an AI key, or authorize a database migration. Those existing release gates remain separate. Supabase-sent signup/recovery emails are provider templates, not frontend messages; their Arabic/bilingual copy must be configured and independently verified before claiming an end-to-end Arabic email flow. Static social-link previews are served before JavaScript; per-language SEO/OG rendering would require a separately scoped server-rendered landing-page change, not a false promise from client-side metadata.
