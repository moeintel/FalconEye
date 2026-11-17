# English and Arabic localization

## Scope and release criteria

Use one application and one financial model. Arabic is Modern Standard Arabic, not a translated fork. English remains available everywhere. Do not merge or publish until the user approves the completed PR.

The completed implementation must include the everyday-finance workspace, record/activity editors, account controls, Falc, early-access registration, prototype outreach administration, design guide, legacy portfolio routes, navigation, accessible names, dialogs, notices, and human-readable reports. User-entered names, notes, imported data, institution names, tickers, and currency codes are not translated or rewritten.

## Current implementation checkpoint

The bilingual implementation is in a draft PR. It has not been merged or published.

- Implemented: shared language infrastructure and paired catalogs; Arabic font and RTL; every everyday-finance page; record/activity editors; private-account controls; Falc UI and bounded Arabic entry; registration/outreach; design guide; legacy routes; shared dialogs and notification accessibility labels. A language switch is available inside dialogs so an unsaved form can retain its values.
- Automated guards cover namespace/key/interpolation/rich-text-slot parity, Arabic plural categories, literal missing keys, uncatalogued JSX text in migrated files, required page/component participation, category metadata, financial precision/document invariants, language precedence, Arabic draft extraction, and exact confirmation commands.
- The full build and regression suite must pass on the final source. Cross-feature browser verification uses sample records and isolated provider/outreach fixtures, never production data. See the PR's current verification section for actual completed checks and remaining gaps.
- Existing public account/email/AI configuration is unchanged. Mock-account checks never prove a live Supabase email flow or configured production AI. Release still requires the user's approval.

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
- The modern financial-records CSV has translated headings and a UTF-8 BOM for Arabic spreadsheet support; unknown migrated dates display as unknown, not 1970. The legacy import/export CSV is a round-trip machine format: preserve its original English field names and enum tokens, and translate its surrounding UI instead.

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

### Adding or reviewing a change

- Add complete sentences to the appropriate paired feature namespace, use them through `useTranslation`, and run `node --test tests/localization.test.mjs`. Keep identifiers stable even when wording changes.
- Keep transient notices/errors as message IDs or canonical recognized service messages, then translate when rendering. Do not store translated UI feedback in financial records. Historical chat text remains as originally written; switching languages does not rewrite the conversation.
- Falc's pure guide imports the same assistant JSON catalogs with Node-compatible JSON attributes. Its guide responses, examples, generated notes, and command instructions live there, not in a second translation dictionary. The runtime excludes that namespace from the attribute-free glob to keep bundler imports consistent.
- Supported Arabic guided input includes category keywords, Arabic/Persian digits, ISO dates or «اليوم», stated cost/current value, selected currency names/codes, gold weight/karat, IPO status, and private agreement types. It is deliberately bounded, not a claim of unrestricted natural-language understanding. «نعم» alone never saves. Exact confirmation phrases are tested against the catalogs; changing them requires a matching parser/test review.
- Review both languages at desktop/mobile widths after layout changes, including portal menus and unsaved forms. Run `pnpm build` before committing. For isolated browser tests, start `node tests/support/run-account-fixture.mjs <allowed-origin> --localization` and route only that test endpoint's `/api` to its fixture port; its outreach totals are explicitly synthetic test data.
- Unknown technical failures receive safe localized guidance; recognized warnings retain recovery/backup instructions. Do not translate raw server output, user-entered data, database values, or secret values. Supabase email templates remain a separate provider configuration.

## Deployment boundary

This refactor does not configure Supabase, activate production email or account deletion, add an AI key, or authorize a database migration. Those existing release gates remain separate. Supabase-sent signup/recovery emails are provider templates, not frontend messages; their Arabic/bilingual copy must be configured and independently verified before claiming an end-to-end Arabic email flow. Static social-link previews are served before JavaScript; per-language SEO/OG rendering would require a separately scoped server-rendered landing-page change, not a false promise from client-side metadata.
