# Account Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable ordinary mini-program users to register and log in with phone number and password while keeping WeChat login and admin login isolated.

**Architecture:** Reuse the existing `TutorApi.register`, `TutorApi.passwordLogin`, and JSON-backed user fields. Open only ordinary user routes under `/api/auth`, then add mini-program login/register UI wiring that reuses the existing `redirectAfterAuth` onboarding flow.

**Tech Stack:** Node.js built-in test runner, custom Node HTTP API, WeChat Mini Program WXML/WXSS/JS, local JSON persistence plus `database/schema.sql` baseline.

## Global Constraints

- Do not modify WeChat payment, WeChat phone authorization, or admin web login behavior.
- Do not store plaintext passwords.
- Ordinary user tokens must remain separate from admin tokens.
- Preserve current identity selection and profile completion redirect rules.

---

### Task 1: Backend User Register/Login Routes

**Files:**
- Modify: `server/test/api.test.js`
- Modify: `server/src/api.js`

**Interfaces:**
- Produces: `POST /api/auth/register`
- Produces: `POST /api/auth/login`

- [ ] Write failing tests for user registration, login, duplicate phone, wrong password, lockout, and admin-account isolation.
- [ ] Run `npm test` and verify the new tests fail before implementation.
- [ ] Expose `/api/auth/register` and `/api/auth/login` in `TutorApi.authRoutes`.
- [ ] Run `npm test` and verify all tests pass.

### Task 2: Mini-Program Login UI

**Files:**
- Modify: `miniprogram/pages/login/login.wxml`
- Modify: `miniprogram/pages/login/login.js`
- Modify: `miniprogram/pages/login/login.wxss`

**Interfaces:**
- Consumes: `POST /api/auth/login`
- Consumes: existing `redirectAfterAuth(data, redirect)`

- [ ] Add account/password fields and login handler.
- [ ] Keep WeChat login unchanged.
- [ ] Add a register entry pointing to `/pages/register/register`.

### Task 3: Register Page Compatibility

**Files:**
- Modify: `miniprogram/pages/register/register.js`

**Interfaces:**
- Consumes: `POST /api/auth/register`

- [ ] Ensure successful registration stores token/user and follows onboarding redirect.
- [ ] Ensure validation matches backend password rules and demo SMS code.

### Task 4: Verification

**Files:**
- No production changes.

- [ ] Run `npm test`.
- [ ] Run `git diff --check`.
- [ ] Report modified files and remaining constraints.
