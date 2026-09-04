# Accessibility and responsive review

Worksheet steps 50–51, reviewed September 4, 2026.

## Scope and results

The list, detail card, create form, and edit/image manager were checked at
320, 768, and 1440 CSS pixels in English, German, and Russian. Regression
fixtures include a 216-character unbroken title, long Markdown links and code,
and failed images with long descriptions/filenames. No real records are changed.

- Fixed image retry labels overflowing their cards and the page. Long interface
  words can wrap; preformatted code and the table retain their own scroll regions.
- Gave the search field a preferred width so it wraps onto another line instead
  of shrinking to a sliver beside the language selector.
- Separated darker control boundaries from light decorative card borders.
  The shared control border is tested against its white background at a minimum
  3:1 contrast ratio; axe checks rendered text contrast and semantic issues.
- Added a reduced-motion override for animations, transitions, and smooth scrolling.
  A test injects a transition and verifies that the preference suppresses it.
- Checked headings, landmark/field labels, content languages, alt-text fallback,
  required/error announcements, visible keyboard focus, native modal behavior,
  cancellation focus restoration, and translation-tab navigation.

The dedicated keyboard regression uses Tab, Shift+Tab, Enter, Escape, and typing
to reach the skip link, table region, delete action, edit route, slug field, and
unsaved-change dialog. Background controls remain unreachable while the native
delete modal is open. Existing tests cover form validation, submission, image
operations, navigation protection, and pending/failure states.

The new layout matrix checks document overflow and overflow inside cards,
sections, fieldsets, and figures, with zero axe violations in tested states.
A supplementary create-form check uses a 200% root font size at 320 pixels.
Phone, tablet, and desktop screenshots were visually inspected. This is a
layout stress test, not a substitute for browser zoom or assistive technology.

## Repeat the checks

From the project folder in WSL:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
cd frontend
npm run check
npm run test:e2e
```

For the focused review: `npx playwright test e2e/ux-quality.spec.ts`.
Screenshots and failure traces are generated under `frontend/test-results/`
and are ignored by Git. All browser API traffic uses test fixtures.

## Review limitations and release checks

This review covers Chromium automation and source/screenshot inspection, not a
WCAG conformance certification. Screen-reader output, real phone touch behavior,
OS high-contrast settings, Firefox/Safari, and native browser zoom have not been
manually verified. Before wider release, repeat the following with real content:

1. Use only the keyboard to create, edit, upload an image, cancel deletion, and
   delete a disposable definition. Verify focus remains visible throughout.
2. With NVDA and a supported browser, check landmarks, language pronunciation,
   field errors, upload status, and dialog announcements.
3. Check browser zoom at 200% and 400%, including long translations and galleries.
   Only the table and code blocks should need local horizontal scrolling.
4. Check phone touch targets and gallery proportions on an actual device.

The criteria informing the review are W3C's
[Reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and
[Non-text Contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
These allow a distinction between meaningful two-dimensional content and ordinary
text, and between interactive control boundaries and decorative lines.
