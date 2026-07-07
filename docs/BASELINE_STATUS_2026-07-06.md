# Baseline Status - 2026-07-06

## Purpose

This file records the baseline before the next development phase for the Zhengzhou tutor mini program.

The goal of this step is to lock the current state, verify existing tests, and make the next work easier to compare against. No business logic was intentionally changed in this step.

## Branch

- Current branch: `codex/baseline-20260706`
- Workspace: `/Users/yuanhaotian/Desktop/家教`

## Pre-existing Working Tree Changes

The workspace already contained uncommitted changes before this baseline record was created. They were not reverted.

Current changed paths observed at the start of this step:

- `miniprogram/app.json`
- `miniprogram/pages/index/index.js`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`
- `miniprogram/utils/local-test.js`
- `server/src/api.js`
- `server/src/store.js`
- `server/src/validators.js`
- `server/test/api.test.js`
- `miniprogram/pages/service/`

## Verification

Command:

```bash
npm test
```

Result:

- Tests: 12
- Passed: 12
- Failed: 0
- Duration: 240.701708 ms

Covered test areas:

- Public teacher list hides pending teachers.
- WeChat login, role selection, and parent profile completion.
- Development mock openid identity behavior.
- New user role selection guard.
- Teacher application with student card and optional trust fields.
- Parent appointment and order lifecycle.
- Account/password user auth routes are not exposed.
- Complaint submission and admin handling.
- Admin phone account login.
- Admin teacher approval, privacy, configs, and recommendation.
- Parent unlocks teacher contact once and views unlocked contact details.
- Approved teacher unlocks parent requirement and records contact log.

## Current Known Baseline

The project currently includes:

- WeChat mini program frontend under `miniprogram/`.
- Local Node.js backend under `server/`.
- Mock or development-mode support for WeChat login and phone binding.
- Admin APIs for teacher approval, parent privacy handling, configs, recommendation, complaints, and unlock records.
- Contact unlock business tests for parent-to-teacher and teacher-to-parent flows.

## Known Incomplete Areas For Next Steps

These items still need product-grade completion and should be handled in later steps:

- Replace development mock WeChat login with real `code2Session` integration.
- Replace mock phone binding with real WeChat phone number authorization flow.
- Add or complete frontend pages for contact unlock, unlock records, and parent requirements where missing.
- Connect real WeChat Pay or clearly separate development mock payment from production.
- Complete backend persistence beyond local JSON if production deployment requires a database.
- Complete admin UI coverage for orders, complaints, reviews, unlock records, parent requirements, and pricing rules.
- Complete file upload handling for teacher avatar and student card images.
- Add production security hardening for secrets, tokens, rate limits, and operation logs.

## Next Suggested Step

Start Step 2: implement the real WeChat login and phone authorization flow while keeping development mock mode available for local testing.
