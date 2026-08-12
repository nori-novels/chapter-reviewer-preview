# Chapter Reviewer Preview

This repository is a public, frontend-only static preview of the Nori Novels chapter reviewer. It will display a reviewed public fixture and has no authentication, backend service, or runtime environment configuration.

Every fixture value is permanently public. Do not add private operational data, credentials, staging details, prompts, or identifiers.

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run test && npm run lint && npm run build && npm run scan:public && npm run test:e2e
```

## Preview behavior

Title and chapter edits, find and replace, comparison preferences, QA navigation, glossary-term copying, and Retranslate exploration stay in the browser. Reloading the page resets chapter edits to the committed public fixture.

The preview intentionally shows `This function is not available in the preview.` for Previous chapter, Next chapter, a non-current chapter-index selection, Save changes, Approve, Edit glossary, Retry translation submission, Close chapter review, the main backdrop, and Escape at the full-screen reviewer boundary. Cancel, the Retranslate close button, its backdrop, and Escape inside Retranslate only close that local modal.
