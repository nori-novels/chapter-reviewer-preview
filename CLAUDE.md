# Chapter Reviewer Preview

## Global Constraints

- The public repository is `nori-novels/chapter-reviewer-preview`; verify the active GitHub identity is exactly `BDZendure` before creating it or pushing.
- Work on `staging`. Do not push to or merge into `main`.
- Serve the full-screen reviewer at `/` with no landing page or login.
- Include only chapter 25 of `obsessed` as a static, reviewed fixture.
- Include no authentication, Supabase client, API route, analytics client, environment variable, staging URL, internal UUID, model configuration, original prompt, or admin Git history.
- All editable state is browser-memory state and resets on reload.
- The exact guarded-action toast is `This function is not available in the preview.`
- The Retranslate fields are titled `Prompt 1`, `Prompt 2`, and `Prompt 3` and all start with the exact synthetic prompt defined in the implementation plan.
- Application interactions make no data or mutation network requests after the static application assets load.
- Treat every committed fixture value as permanently public.

## Verification

Run these commands before publishing:

```bash
npm run test
npm run lint
npm run build
npm run scan:public
npm run test:e2e
```
