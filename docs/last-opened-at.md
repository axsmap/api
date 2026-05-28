# User lastOpenedAt

`users.lastOpenedAt` is the source of truth for the last time a logged-in user opened or used AXS Map.

The field is only updated through `markUserOpened` in `src/helpers/user-activity.js`. That helper uses the native Mongo collection and sets only `lastOpenedAt`, so it does not update Mongoose `updatedAt`.

Update points:

- `POST /auth/sign-in` after password login succeeds.
- `POST /auth/google` after Google login succeeds.
- `POST /auth/facebook` after Facebook login succeeds.
- `POST /auth/token` after a refresh token is accepted.
- `GET /users/profile` when the authenticated web or mobile app loads the current user profile.
- `PUT /users/opened` when a client explicitly marks the authenticated user as opened.

Do not call `markUserOpened` from admin syncs, Salesforce syncs, imports, profile edits, review updates, or generic user writes. Those flows may update `updatedAt`, but they must not change `lastOpenedAt`.
