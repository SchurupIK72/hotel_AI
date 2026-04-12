# PH1-01 - Tenant Foundation and Staff Access

> **Created:** 2026-04-12
> **Phase:** Phase 1 - AI Copilot Foundation
> **Priority:** P0
> **Status:** Draft
> **Depends on:** none

---

## Summary

This feature creates the tenant-safe application foundation for all Phase 1 work.

It defines how hotel staff authenticate, how a signed-in user is bound to exactly one hotel in the pilot rollout, how access is restricted by `hotel_id`, and how the rest of the backend can safely rely on tenant-scoped data access.

Without this feature, Telegram ingestion, inbox access, knowledge management, and AI Copilot behavior cannot be implemented safely.

---

## Product Intent

The product starts with one pilot hotel, but the codebase must behave like a multi-tenant system from day one.

This feature exists to enforce that rule in the data model, auth flow, and server-side access layer.

### Must-have outcomes

- staff can sign in through Supabase Auth;
- every staff session resolves to one active `hotel_id`;
- protected pages and APIs reject unauthenticated access;
- staff cannot read or mutate data from another hotel;
- tenant-scoped access helpers exist before later feature work begins.

### Out of scope

- self-serve hotel registration;
- billing or subscriptions;
- multi-hotel switching for one user;
- guest auth;
- public hotel portals.

---

## Roles and Access Model

### Roles in scope

- `super_admin`
- `hotel_admin`
- `manager`

### Pilot rule

For Phase 1, a non-super-admin staff user belongs to exactly one hotel at a time through `hotel_users`.

### Role permissions

`super_admin`

- can inspect all hotels and internal system data;
- is intended for platform operators, not hotel staff;
- can bypass hotel-specific admin UI restrictions when using internal tooling.

`hotel_admin`

- can access all staff-facing screens for their hotel;
- can manage hotel staff membership and hotel-level settings in later features;
- can read all hotel conversations and knowledge records.

`manager`

- can access staff-facing screens for their hotel;
- can read and operate on hotel conversations allowed by later feature scopes;
- cannot cross tenant boundaries.

### Access invariants

- every request is either `super_admin` scoped or `hotel_id` scoped;
- tenant scope is resolved on the server, never trusted from the client;
- reusable backend helpers must not accept raw client-provided `hotel_id` as authority.

---

## Data Model Requirements

### Required tables

`hotels`

- `id uuid pk`
- `name text not null`
- `slug text unique not null`
- `default_language text null`
- `timezone text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`hotel_users`

- `id uuid pk`
- `hotel_id uuid not null references hotels(id)`
- `auth_user_id uuid not null`
- `role text not null check (role in ('hotel_admin','manager'))`
- `full_name text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique(hotel_id, auth_user_id)`

### Internal admin assumption

`super_admin` does not need to live in `hotel_users` for Phase 1. It may be represented through a separate server-side allowlist or an auth claim resolved only in internal code.

### Required indexes

- `hotel_users(auth_user_id)`
- `hotel_users(hotel_id, role)`
- `hotels(slug)`

---

## Auth and Session Contracts

### Authentication provider

- Supabase Auth is the only auth provider for Phase 1 staff access.

### Session resolution contract

For every authenticated server request, the backend must be able to resolve:

- `auth_user_id`
- `role_type` as `super_admin` or `hotel_user`
- `hotel_id` for hotel users
- `hotel_user_id` for hotel users
- `hotel_role` as `hotel_admin` or `manager` for hotel users

### Required server-side access result

```ts
type AccessContext =
  | {
      kind: "super_admin";
      authUserId: string;
    }
  | {
      kind: "hotel_user";
      authUserId: string;
      hotelId: string;
      hotelUserId: string;
      hotelRole: "hotel_admin" | "manager";
    };
```

### Failure behavior

- unauthenticated request -> `401`
- authenticated but no valid hotel membership -> `403`
- inactive hotel user -> `403`
- foreign tenant resource access -> `404` or `403`, but must not leak whether the resource exists

---

## RLS and Tenant Safety Requirements

### Required principle

All tenant tables must be safe under both:

- application-layer guards;
- database-level RLS.

### Minimum tables covered in this feature

- `hotels`
- `hotel_users`

### RLS policy goals

For `hotel_users`:

- a hotel user can read their own row;
- a hotel admin can read hotel staff rows for the same hotel;
- no hotel user can read rows from another hotel.

For `hotels`:

- a hotel user can read only their hotel row;
- no hotel user can read other hotels.

### Server-side enforcement goals

- server helpers resolve tenant scope before querying tenant tables;
- backend code uses resolved tenant scope in all repo/service methods;
- later features can import one shared tenant guard layer instead of duplicating checks.

---

## Application Interfaces

### Required routes/pages

Phase 1 auth foundation should provide:

- sign-in page for staff;
- authenticated dashboard shell route;
- middleware or server guard for protected routes;
- logout action.

### Required server helpers

- `getAuthenticatedUser()`
- `getAccessContext()`
- `requireHotelUser()`
- `requireHotelAdmin()`
- `requireSuperAdmin()` or internal equivalent
- `assertSameHotelResource(...)` pattern for later resource checks

### Required repository pattern

Later domain services must be able to depend on one of these safe entry styles:

```ts
type HotelScopedQuery = {
  hotelId: string;
};
```

or a richer context-based variant:

```ts
type HotelAccessContext = {
  authUserId: string;
  hotelId: string;
  hotelUserId: string;
  hotelRole: "hotel_admin" | "manager";
};
```

The exact internal shape can vary, but later features must not invent their own tenant guard pattern.

---

## UI Behavior

### Sign-in

- staff enters email and password;
- successful auth redirects to dashboard shell;
- invalid credentials show a generic auth error;
- no tenant data is exposed before auth completes.

### Dashboard shell gate

- authenticated hotel staff can enter protected dashboard routes;
- unauthenticated users are redirected to sign-in;
- authenticated users without valid hotel membership see an access-denied state.

### Pilot simplification

- no hotel switcher in UI;
- no organization selector after login;
- one resolved hotel context per session.

---

## Implementation Plan

### Stage 1 - Auth and tenant schema

**Goal**

Create the minimum schema and contracts needed to represent hotels and hotel staff membership.

**Tasks**

- add migrations for `hotels` and `hotel_users`;
- define role constraints and unique membership rules;
- document the internal `super_admin` assumption for Phase 1;
- add indexes required for access resolution.

**Expected file areas**

- `supabase/migrations/*`
- `lib/db/*.ts`
- `lib/auth/*.ts`
- `lib/tenants/*.ts`

**Acceptance**

- tables exist with required constraints;
- one auth user can be resolved to one hotel membership;
- schema supports later tenant-scoped features without redesign.

### Stage 2 - Server-side access resolution

**Goal**

Create reusable server helpers that resolve and enforce access context.

**Tasks**

- implement current-user resolution from Supabase session;
- resolve hotel membership from `auth_user_id`;
- build `AccessContext` helpers;
- implement role guard helpers for hotel user and hotel admin access;
- standardize failure behavior for `401`, `403`, and hidden foreign-resource cases.

**Expected file areas**

- `lib/auth/server.ts`
- `lib/auth/guards.ts`
- `lib/tenants/access-context.ts`
- `lib/tenants/guards.ts`

**Acceptance**

- protected server code can require authenticated hotel access from one shared entry point;
- inactive or invalid memberships are rejected consistently.

### Stage 3 - Protected app shell and route gating

**Goal**

Expose a basic staff sign-in flow and protected dashboard shell.

**Tasks**

- add sign-in page;
- add auth-aware dashboard layout or middleware;
- redirect unauthenticated users to sign-in;
- show access-denied state for invalid membership;
- wire logout action.

**Expected file areas**

- `app/(auth)/*`
- `app/dashboard/*`
- `middleware.ts` or equivalent protected-route layer

**Acceptance**

- staff can sign in and reach dashboard shell;
- non-authenticated users cannot access dashboard routes;
- hotel membership is resolved before tenant data is shown.

### Stage 4 - RLS policies and verification

**Goal**

Back the app-layer guards with DB-level tenant restrictions.

**Tasks**

- enable RLS on `hotels` and `hotel_users`;
- add policies aligned with hotel-scoped reads;
- verify service-role usage remains server-only;
- define the access pattern later features must reuse.

**Expected file areas**

- `supabase/migrations/*`
- `lib/db/*.ts`
- `tests/*`

**Acceptance**

- hotel users cannot read other hotels through normal authenticated access;
- app-layer and DB-layer tenant rules are aligned.

---

## Acceptance Criteria

This feature is complete only if:

1. staff can authenticate through Supabase Auth;
2. an authenticated hotel staff user resolves to one active hotel membership;
3. protected dashboard routes require authentication;
4. tenant-scoped access context is available from one shared server helper;
5. hotel users cannot access hotel data outside their `hotel_id`;
6. inactive or invalid hotel memberships are rejected;
7. `hotels` and `hotel_users` are protected by RLS or an equivalent database-level restriction strategy;
8. later features can consume a reusable tenant access pattern without redefining auth rules.

---

## Test Plan

### Unit tests

- access-context resolution for valid hotel user;
- failure when no session exists;
- failure when hotel membership is missing;
- failure when hotel membership is inactive;
- role guard behavior for `hotel_admin` vs `manager`.

### Integration tests

- authenticated hotel user can read only their hotel row;
- authenticated hotel user cannot read another hotel's membership row;
- protected route redirects unauthenticated user;
- authenticated user with broken membership sees access denied.

### Security checks

- verify client code never receives service-role secrets;
- verify tenant scope is server-resolved, not client-authoritative;
- verify foreign-tenant access does not leak resource existence.

---

## Dependencies for Next Features

This feature must be finished before:

- PH1-02 Hotel setup and Telegram integration
- PH1-03 Inbound messaging ingestion
- PH1-04 Conversation workspace UI
- PH1-06 Knowledge base management

Those features may assume that tenant access helpers and staff auth already exist.

---

## Open Assumptions Locked for This Spec

- Phase 1 is a single-hotel pilot, but tenant-safe design is mandatory.
- Staff auth is email/password through Supabase Auth unless changed later.
- `super_admin` is treated as an internal platform concern and is not required in hotel staff UI for this phase.
- A regular staff user belongs to exactly one hotel in Phase 1.
