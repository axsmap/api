# `lastOpenedAt` — operating notes

## What it is

A Date field on the `User` schema that tracks **real app-open events** — when an
authenticated user genuinely opens or re-opens the AXS Map app.

Distinct from existing fields:

| Field | When set | Semantics |
|---|---|---|
| `lastLogin` | Sign-in flows | Last successful password / social sign-in |
| `lastActivityTime` | ⚠️ **Every authenticated API call** (`helpers/index.js:isAuthenticated`) | Way too noisy — every background poll updates this. Source of the May 2026 user-status bug. |
| **`lastOpenedAt`** | **Sign-in flows + token refresh** | Real app-open signal. Used by future Salesforce User Status logic. |

## Where it IS set (only these places)

| File | When |
|---|---|
| `routes/auth/sign-in.js` | Successful email+password sign-in |
| `routes/auth/apple-sign-in.js` | Successful Apple sign-in (new or existing user) |
| `routes/auth/google-sign-in.js` | Successful Google sign-in (new or existing user) |
| `routes/auth/facebook-sign-in.js` | Successful Facebook sign-in (new or existing user) |
| `routes/auth/generate-token.js` | Successful refresh-token → new JWT (the AXS Map app was re-opened after the previous JWT expired) |

Every update logs to stdout:
```
[app-open] sign-in: userId=<id> lastOpenedAt=2026-05-23T18:00:00.000Z
[app-open] google-sign-in (existing): userId=<id> lastOpenedAt=...
[app-open] token-refresh: userId=<id> lastOpenedAt=...
```

This is the audit trail — easy to grep for in CloudWatch / log aggregators.

## Where it is NOT set (and must NEVER be set)

- ❌ `helpers/index.js:isAuthenticated` middleware — this was the trap with
  `lastActivityTime`. Setting any "user activity" field on every API request
  means even silent background polling counts as activity. **Do not extend this.**
- ❌ Any of the AWS Lambda sync functions (`axs-map-sync-users` etc.) — they
  don't read or write this field. Confirmed by code grep.
- ❌ Admin bulk scripts in `src/scripts/db/*` — `import-users.js`,
  `update-users-avatars.js`, `migrate-scores.js` — none touch this field.
- ❌ MongoDB Atlas Triggers — they fire change events to AWS EventBridge but
  don't update the source doc.
- ❌ Salesforce → MongoDB direction — there is no sync in that direction today.

## How to verify before/after a deploy

```bash
cd "/Users/saffiullah/AXS Map API"

# Snapshot — read schema definition and population counts
node src/scripts/verify-last-opened-at.js

# Watch a specific user in real time (do this BEFORE signing in via the app):
node src/scripts/verify-last-opened-at.js --watch --user me@example.com

# Then sign in via the app or POST /auth/sign-in. You should see a single line:
#   [<time>] lastOpenedAt changed: <old> → <new>
# If you see multiple updates from a single sign-in, or updates with no sign-in,
# something else is writing the field — find and remove the writer.
```

## Salesforce side

The matching SF field already exists:

| SF Object | Field | Type | Population (as of 2026-05-23) |
|---|---|---|---|
| `Contact` | `Last_App_Opened_At__c` | Date/Time | 0 Contacts populated |

It exists but is **not yet synced** — per this ticket's scope ("Do not change
Salesforce User Status logic in this ticket"), the Lambda is NOT mapping
`lastOpenedAt` → `Last_App_Opened_At__c` yet. Seeding now would let the User
Status flow start consuming it, which is the next ticket's work.

When the next ticket lands, it must:

1. **Add FLS to the integration's permission set.** The Lambda's run-as user
   uses `AXS_Map_AWS_Lambda_Integration` perm set, which currently has **no**
   FLS for `Last_App_Opened_At__c`. Without this, the sync would fail with
   `INSUFFICIENT_ACCESS`. The deploy is one block in:
   `force-app/main/default/permissionsets/AXS_Map_AWS_Lambda_Integration.permissionset-meta.xml`

   ```xml
   <fieldPermissions>
       <editable>true</editable>
       <field>Contact.Last_App_Opened_At__c</field>
       <readable>true</readable>
   </fieldPermissions>
   ```

2. **Add the field to the Lambda payload** in
   `/Users/saffiullah/AXS Map AWS/lambdas/sync-users/index.js:buildContact()`.
   IMPORTANT: use the same omit-when-Mongo-absent pattern that was applied to
   `lastActivityTime__c` in the recent fix — otherwise we'd recreate the May
   2026 bulk-overwrite bug:

   ```js
   // Only include if Mongo has a value — never fall back to Date.now() or
   // any default; omit the field entirely if Mongo has nothing to say.
   const opened = core.toDateTime(document.lastOpenedAt);
   if (opened) {
     contact.Last_App_Opened_At__c = opened;
     core.logDebug('users: setting Last_App_Opened_At__c from Mongo', { mongoId, value: opened });
   }
   ```

3. **Run the audit script** to confirm the perm set now grants the field:
   `node "/Users/saffiullah/AXS Map AWS/scripts/audit-lambda-perms.js"`

4. **Update the User Status flow** to read `Last_App_Opened_At__c` instead of
   `lastActivityTime__c`. The flow is at
   `Setup → Flows → Welcome Email Trigger Flow on Contact` (or whichever
   actually contains the active/inactive logic).
