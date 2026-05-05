# Usage

## Purpose

This document explains how hotel staff and internal support should use the current application.

It reflects the current Phase 1 behavior:

- staff sign in;
- hotel-scoped dashboard access;
- Telegram guest conversations in the inbox;
- knowledge base management;
- AI draft generation with human approval before send.

## Who Can Use What

There are three practical access modes in the current app.

### 1. Hotel admin

Can use:

- dashboard overview;
- inbox;
- knowledge base;
- Telegram settings.

This is the main operational role for setup and daily work.

### 2. Manager

Can use:

- dashboard overview;
- inbox.

Managers cannot manage Telegram settings and cannot manage the knowledge base.

### 3. Super admin

Internal support access is controlled through `SUPER_ADMIN_EMAILS`.

Super admins can inspect Telegram settings for a target hotel by opening:

```text
/dashboard/settings/telegram?hotelId=<hotel-uuid>
```

## Sign In

Open:

```text
/sign-in
```

Enter:

- your staff email;
- your password.

After successful sign-in, the app redirects to:

```text
/dashboard
```

If the account exists in Supabase Auth but has no active membership in `public.hotel_users`, the user is redirected to the access denied screen.

## Main Areas of the App

The navigation currently contains:

- `Overview`
- `Inbox`
- `Knowledge` for hotel admins only
- `Telegram`

## 1. Overview

Route:

```text
/dashboard
```

Purpose:

- confirms that authentication works;
- shows the resolved user, hotel, hotel user, and role;
- gives quick links to the inbox and knowledge base.

Use this page to verify that the correct hotel context is active before doing operational work.

## 2. Telegram Settings

Route:

```text
/dashboard/settings/telegram
```

Use this page to:

- connect a Telegram bot;
- rotate a bot token;
- add or update a webhook secret;
- view the generated webhook URL;
- deactivate the integration.

### How to connect the bot

1. Open the Telegram settings page as a hotel admin.
2. Fill in:
   - Integration name
   - Bot token
   - Optional webhook secret
3. Submit the form.

The app will:

- verify the bot token with Telegram;
- store the token securely;
- generate a webhook path token;
- show the webhook URL that must be registered in Telegram.

### What you should see after success

The page should show:

- integration name;
- bot username;
- webhook token;
- status `active`;
- last verified timestamp;
- webhook URL.

### What the webhook secret does

If you provide a webhook secret, Telegram must send the same `secret_token` when calling the webhook.

This adds a second validation layer on top of the path token in the URL.

## 3. Inbox

Route:

```text
/dashboard/inbox
```

This is the main operational workspace.

The page includes three areas:

1. inbox list on the left;
2. conversation detail and timeline in the middle;
3. guest summary, reply composer, and AI drafts on the right.

### Inbox filters

Available filters:

- `All`
- `Unread`
- `Assigned to me`

Use them to focus on:

- every conversation;
- only conversations with unread guest messages;
- only conversations currently assigned to your hotel user.

### Opening a conversation

When you open a conversation, you can see:

- guest display name and Telegram username;
- language if known;
- current status;
- current assignee;
- unread count;
- last activity timestamp;
- full timeline of renderable messages.

### Conversation status

Available statuses:

- `new`
- `open`
- `pending`
- `closed`

Use them as a lightweight workflow marker:

- `new`: just arrived or not yet processed;
- `open`: actively handled;
- `pending`: waiting for staff or guest follow-up;
- `closed`: completed.

### Assignment

You can assign a conversation to:

- yourself;
- another hotel staff user;
- nobody, by setting it back to unassigned.

This is especially useful with the `Assigned to me` filter.

## 4. Reply Composer

The reply composer is shown on the right side of the inbox when a conversation is selected.

It is always human-approved in the current phase.

The app does not auto-send outbound replies on its own.

### Two reply modes

The composer supports:

- `Draft-backed`
- `Manual reply`

#### Draft-backed

Use this when the AI draft panel already contains a useful suggestion.

Flow:

1. Select a draft with `Use draft`.
2. The draft text is loaded into the composer.
3. Edit the text if needed.
4. Click `Send reply`.

#### Manual reply

Use this when:

- there is no draft;
- the draft is not appropriate;
- the topic is sensitive or transactional and you want a fully manual answer.

Flow:

1. If a draft is selected, click `Write manually`.
2. Type the final text yourself.
3. Click `Send reply`.

### Send behavior

On successful send:

- the message is stored as an outbound message;
- the timeline shows it as a hotel staff message;
- related audit events are written;
- a success banner is shown.

On failure:

- the app classifies the result as retryable or ambiguous;
- the failed attempt is not shown as if it were delivered;
- the operator sees failure feedback instead of a fake success state.

## 5. AI Draft Panel

The draft panel sits next to the reply composer.

It can be in one of these states:

- not available yet;
- empty;
- ready;
- error.

### When drafts are ready

You will see:

- multiple saved draft variants;
- source type;
- confidence label;
- creation time;
- model name when present.

Typical draft patterns:

- `knowledge-backed` for supported informational requests;
- `clarification-needed` for cautious fallback cases;
- empty or suppressed state for unsupported topics.

### Generate or refresh drafts

Use:

- `Generate drafts`
- `Refresh drafts`

This is useful when:

- the conversation changed;
- you updated the knowledge base;
- you want a fresh suggestion before replying.

## 6. Knowledge Base

Route:

```text
/dashboard/knowledge
```

Available to hotel admins only.

Use this page to manage:

- FAQ items;
- policy items.

### FAQ items

Best for:

- breakfast hours;
- check-in and check-out information;
- amenities;
- location and general hotel services.

### Policy items

Best for:

- operational rules;
- exception handling boundaries;
- late checkout policy;
- other structured hotel rules.

### Draft vs published

Each item has a publish state:

- `draft`
- `published`

Important rule:

- only published items are intended to support later retrieval and AI assistance;
- draft items remain unavailable to downstream retrieval behavior.

### Typical workflow

1. Create an FAQ or policy item.
2. Edit the content until it is correct.
3. Publish the item.
4. Use inbox draft generation again if you want updated AI suggestions.

## How the App Behaves on Different Guest Requests

### Supported informational requests

Examples:

- breakfast hours;
- amenities;
- general hotel policies already present in knowledge.

Expected behavior:

- inbound message appears in the inbox;
- retrieval can find approved evidence;
- drafts are generated;
- staff selects or edits a draft;
- staff sends the final reply.

### Low-evidence informational requests

Examples:

- questions where the hotel has little or no published knowledge.

Expected behavior:

- the app may still generate cautious fallback drafts;
- the wording should avoid invented facts;
- staff should review carefully before sending.

### Unsupported or sensitive requests

Examples:

- refunds;
- booking changes;
- policy exceptions;
- disputes.

Expected behavior:

- the system may suppress AI drafts;
- staff should answer manually;
- no hidden auto-send should happen.

## Suggested Daily Workflow for Hotel Staff

1. Sign in.
2. Open `Inbox`.
3. Start with `Unread`.
4. Open the newest guest conversation.
5. Review the guest message and any existing draft.
6. If needed, refresh drafts.
7. Choose a draft or write manually.
8. Send the final approved reply.
9. Update status and assignment.
10. Repeat for the next conversation.

## Suggested Admin Workflow

For hotel admins:

1. Confirm Telegram integration is active.
2. Review inbound activity in the inbox.
3. Update FAQ and policy items when staff answers repeat often.
4. Publish only content that is safe for future reuse.
5. Periodically test draft quality by refreshing drafts on real conversations.

## Troubleshooting

### I can sign in, but I get access denied

Likely cause:

- the user exists in Supabase Auth but has no active `hotel_users` membership.

Fix:

- check the `public.hotel_users` row;
- confirm `is_active = true`;
- confirm the correct hotel role is assigned.

### The Telegram page says no integration is configured

Likely cause:

- no active bot was saved yet;
- the previous integration was deactivated;
- token verification failed.

Fix:

- save the integration again as hotel admin;
- confirm the bot token is valid;
- re-register the webhook if the URL changed.

### Guest messages do not appear in the inbox

Check:

1. the webhook is registered in Telegram;
2. the webhook URL exactly matches the URL shown in the app;
3. `APP_BASE_URL` points to the real public HTTPS domain;
4. the bot is active and reachable;
5. the guest sent a supported text message.

### A draft is missing

Possible reasons:

- the topic is unsupported;
- the knowledge base has no published evidence;
- retrieval returned no relevant evidence;
- draft generation was intentionally suppressed.

In that case:

- write the reply manually;
- if appropriate, add approved content to the knowledge base for future use.

### Sending a reply failed

The system distinguishes between:

- retryable failure;
- ambiguous failure.

Operator guidance:

- retryable means Telegram clearly rejected delivery or the request can be attempted again safely;
- ambiguous means delivery could not be confirmed, so verify before sending again blindly.

## Useful Internal Links

- [LOCAL_SETUP.md](./LOCAL_SETUP.md)
- [Deploy.md](./Deploy.md)
- [.ai/specs/phase1/ph1-10-release-handoff-evidence.md](./.ai/specs/phase1/ph1-10-release-handoff-evidence.md)
