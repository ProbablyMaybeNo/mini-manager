# Gallery card creation

Gallery card creation builds on the existing gallery posting flow and provides a shared editor across gallery, project, and recipe pages.

- Gallery has **Create**, including a sign-in entry for visitors.
- Project pages, sub-project pages, the project inspector, and recipe pages open the shared editor via **Share card**. The existing photo Share button also opens the editor.
- Choose an active project/sub-project to fill the title, project name, total model count, parent project, attached recipe, notes, and uploaded photos. The first project photo is selected automatically. Multiple recipes can be selected by name.
- **Create new — blank card** clears the source details. All card details can be entered in the modal; recipes can be selected from the library or built by adding catalog paints.
- Source projects and recipes are preserved. Posting creates a separate recipe snapshot; keeping that snapshot in the recipe library is optional. Upload retries update that same snapshot with any edits.
- The card contains the Mini Mainframe logo and website address. Square and Story PNGs export at 1080px wide. Photos are contained so heads and bases are not cropped. Paint names sit alongside swatches.
- Compact cards allow up to 12 paints and 240 characters of technique notes. Larger source recipes must be reduced before export/posting; overflowing layouts produce an explanation instead of a clipped export.

## Validation

- `npm run build -- --webpack` passed against an isolated local SQLite database.
- `npm run typecheck` and `npm run lint -- --quiet` passed.
- 41 integration tests passed across gallery post actions, moderation submission actions, and gallery listing queries.
- 15 share-card layout unit tests passed.
- `qa_gallery_composer.spec.ts` passed against the local production build. It exercised project/sub-project autofill, blank reset, selecting an existing recipe, adding a catalog paint inside the modal, choosing a local photo, all three page entry points, mobile sizing, and actual Square/Story PNG downloads.
- Exported images and desktop/mobile screenshots were visually inspected. Test images use a bundled logo fixture, not a real user's model photo.

No live public card was posted. Vercel Blob upload and paid image moderation were not exercised end to end; their existing action guards remain covered by integration tests.

## Deployment requirement

This branch includes the existing gallery migration `0042_stormy_mikhail_rasputin.sql` (`hidden_from_library`). The normal production build applies this additive migration before building the application.

## Browser test reproduction

Use a disposable local database shared by the local server and Playwright. Set `GALLERY_TEST_DATABASE_URL` to that `file:` database, `PLAYWRIGHT_BASE_URL` to the local server URL, and `PLAYWRIGHT_SKIP_WEBSERVER=1`. For `next start`, also set `GALLERY_PRODUCTION_BUILD=1`; this seeds a test session only in the explicitly supplied local database. Run:

```text
npx playwright test tests/e2e/qa_gallery_composer.spec.ts --project=chromium --workers=1
```
