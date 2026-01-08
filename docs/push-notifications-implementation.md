# Push Notifications Implementation Documentation

## Table of Contents

1. [Overview](#overview)
2. [Requirements](#requirements)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Notification Service](#notification-service)
6. [API Endpoints](#api-endpoints)
7. [Notification Scenarios](#notification-scenarios)
8. [Implementation Details](#implementation-details)
9. [Configuration](#configuration)
10. [File Structure](#file-structure)
11. [Testing & Deployment](#testing--deployment)

---

## Overview

This document describes the implementation of an automated push notification system for user engagement based on user activity and sign-in behavior. The system tracks user installations, sign-ins, and inactivity periods to send targeted notifications at specific intervals.

**Key Features:**

- Pre-sign-up device tracking
- Post-sign-up user tracking
- Automated notification scheduling
- OneSignal integration (active)
- Firebase Cloud Messaging support (inactive, preserved)

---

## Requirements

### Business Requirements

1. **Backend Field**: `lastSignIn` (not visible to users)
2. **Download but No Sign-In**: After 24 hours, send notification
3. **Inactivity Notifications**:
   - 3 days → "Hey! Miss us? We miss you! Leave a review today!"
   - 7 days → "Was it something I said? Leave a review today!"
   - 14 days → "Remember me? Let's explore today!"
   - 30 days → "Accessibility affects everyone. We'll be here when you get back!"

### Technical Requirements

- Track devices before user sign-up
- Track user sign-in timestamps
- Prevent duplicate notifications
- Support multiple notification services (OneSignal active, Firebase preserved)
- Non-blocking implementation (doesn't break existing flows)

---

## Architecture

### System Flow

```
┌─────────────────┐
│  App Installed │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ POST /devices/register │
│ (No auth required)     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ DeviceInstallation      │
│ (userId = null)         │
└────────┬────────────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│ User Signs Up   │  │ 24h Passes       │
│ / Logs In       │  │ (No sign-in)     │
└────────┬────────┘  └────────┬─────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌──────────────────┐
│ Device Linked   │  │ Notification     │
│ to User         │  │ Sent             │
└────────┬────────┘  └──────────────────┘
         │
         ▼
┌─────────────────┐
│ User Activity   │
│ Tracked         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Inactivity      │
│ Notifications   │
│ (3d, 7d, 14d,   │
│  30d)           │
└─────────────────┘
```

### Components

1. **Device Installation Model**: Tracks devices before user sign-up
2. **User Model Extensions**: Tracks sign-in and notification history
3. **Push Notification Service**: OneSignal (active) / Firebase (inactive)
4. **Notification Scheduler**: Cron job for automated notifications
5. **API Endpoints**: Device registration and token management

---

## Database Schema

### User Model Extensions

**New Fields Added:**

```javascript
{
  lastSignIn: Date,              // Tracks last sign-in (not visible to users)
  fcmToken: String,               // Stores OneSignal player ID
  lastNotificationSent: Date,     // Tracks notification history
  notificationType: String        // Prevents duplicate notifications
}
```

**Field Visibility:**

- `lastSignIn`, `lastNotificationSent`, `notificationType` are excluded from JSON responses
- Only accessible internally for tracking purposes

**Indexes Added:**

- `lastSignIn: 1` - For inactivity queries
- `createdAt: 1` - For download tracking queries

### Device Installation Model

**Schema:**

```javascript
{
  deviceId: String (unique, required),
  platform: String (enum: ['ios', 'android', 'web'], required),
  fcmToken: String (default: null),        // Stores OneSignal player ID
  userId: ObjectId (ref: 'User', default: null),  // null until user signs in
  installedAt: Date (required),
  lastNotificationSent: Date (default: null),
  notificationType: String (enum: [...], default: null)
}
```

**Indexes:**

- `deviceId: 1`
- `userId: 1`
- `installedAt: 1`
- `fcmToken: 1`

**Key Points:**

- `userId` is `null` when device is first installed
- Gets linked to user when they sign up/log in
- Allows tracking of pre-sign-up users

---

## Notification Service

### OneSignal (Active)

**Implementation:**

- Uses OneSignal REST API
- Endpoint: `https://onesignal.com/api/v1/notifications`
- Authentication: Basic Auth with REST API Key

**Payload Structure:**

```json
{
  "app_id": "ONESIGNAL_APP_ID",
  "include_player_ids": ["player_id"],
  "headings": { "en": "Title" },
  "contents": { "en": "Body" },
  "data": { "custom_data": "..." },
  "sound": "default",
  "priority": 10
}
```

**Configuration:**

- `ONESIGNAL_APP_ID` - OneSignal App ID
- `ONESIGNAL_REST_API_KEY` - OneSignal REST API Key

### Firebase Cloud Messaging (Inactive)

**Status:** Code preserved but inactive

**Implementation:**

- Function `sendPushNotificationFCM()` exists but returns `null` immediately
- Original FCM code preserved in comments
- Can be reactivated by uncommenting code

**Configuration:**

- `FCM_SERVER_KEY` - Not currently used (kept for reference)

**To Reactivate Firebase:**

1. Uncomment FCM code in `sendPushNotificationFCM()`
2. Change `sendPushNotification()` to call FCM instead of OneSignal
3. Set `FCM_SERVER_KEY` environment variable

---

## API Endpoints

### 1. Register Device (No Authentication Required)

**Endpoint:** `POST /devices/register`

**Purpose:** Register device installation before user sign-up

**Request Body:**

```json
{
  "deviceId": "unique-device-identifier",
  "platform": "ios" | "android" | "web",
  "fcmToken": "onesignal-player-id" // optional
}
```

**Response:**

```json
{
  "message": "Device registered successfully",
  "device": {
    "deviceId": "...",
    "platform": "...",
    "installedAt": "..."
  }
}
```

**Use Case:** Called immediately after app installation

---

### 2. Update FCM Token (Authenticated)

**Endpoint:** `PUT /users/fcm-token`

**Purpose:** Update user's OneSignal player ID

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "fcmToken": "onesignal-player-id",
  "deviceId": "device-id" // optional, links device to user
}
```

**Response:**

```json
{
  "message": "OneSignal player ID updated successfully"
}
```

**Use Case:** Called when user logs in or token is refreshed

---

### 3. Trigger Notifications (Admin Only)

**Endpoint:** `POST /trigger-notifications`

**Purpose:** Manually trigger notification processing

**Headers:**

```
Authorization: Bearer <admin-token>
```

**Response:**

```json
{
  "message": "Notifications processed successfully",
  "results": {
    "download_24h": 5,
    "inactivity_3d": 10,
    "inactivity_7d": 8,
    "inactivity_14d": 3,
    "inactivity_30d": 2
  }
}
```

**Use Case:** Testing and manual triggers

---

## Notification Scenarios

### Scenario 1: Download but No Sign-In (24 hours)

**Trigger:** Device installed 24 hours ago, no user sign-up

**Process:**

1. Cron job runs daily
2. Finds devices with `userId = null` installed 24h ago
3. Finds users with `lastSignIn = null` created 24h ago
4. Sends notification if not already sent

**Notification:**

- **Title:** "Welcome to AXS Map!"
- **Body:** "Don't forget to sign in! Start mapping today!"

**Tracking:**

- Sets `notificationType = "download_24h"`
- Updates `lastNotificationSent`

---

### Scenario 2: Inactivity After Sign-In

**Triggers:**

- 3 days of inactivity
- 7 days of inactivity
- 14 days of inactivity
- 30 days of inactivity

**Process:**

1. Cron job runs daily
2. Finds users who signed in exactly X days ago
3. Checks if notification already sent for that period
4. Sends notification if not sent

**Notifications:**

| Days | Title                            | Body                                 |
| ---- | -------------------------------- | ------------------------------------ |
| 3    | "Hey! Miss us?"                  | "We miss you! Leave a review today!" |
| 7    | "Was it something I said?"       | "Leave a review today!"              |
| 14   | "Remember me?"                   | "Let's explore today!"               |
| 30   | "Accessibility affects everyone" | "We'll be here when you get back!"   |

**Tracking:**

- Sets `notificationType = "inactivity_Xd"`
- Updates `lastNotificationSent`

---

### Scenario 3: User Signs In Again

**Process:**

1. User signs in via any method (email, Google, Facebook, Apple)
2. `lastSignIn` updated to current timestamp
3. `notificationType` reset to `null`
4. Device linked to user if `x-device-id` header present

**Effect:**

- Resets notification tracking
- User can receive notifications again if they become inactive

---

## Implementation Details

### Sign-In Tracking

**Updated Routes:**

- `POST /auth/sign-in` - Email/password sign-in
- `POST /auth/google-sign-in` - Google OAuth sign-in
- `POST /auth/facebook-sign-in` - Facebook OAuth sign-in
- `POST /auth/apple-sign-in` - Apple Sign-In
- `GET /auth/activate-account/:key` - Account activation

**Behavior:**

- Updates `lastSignIn` timestamp
- Resets `notificationType` to `null`
- Links device to user if `x-device-id` header present
- Non-blocking (sign-in proceeds even if save fails)

---

### Notification Scheduler

**Location:** `src/services/notification-scheduler.js`

**Functions:**

- `checkDownloadButNoSignIn()` - Handles 24h download scenario
- `checkInactiveUsers(days, type, message)` - Handles inactivity scenarios
- `processAllNotifications()` - Processes all notification checks

**Cron Job:**

- **Location:** `src/services/notification-cron.js`
- **Schedule:** Daily at 9:00 AM UTC (configurable)
- **Environment Variable:** `NOTIFICATION_CRON_SCHEDULE`

**Initialization:**

- Starts automatically when server starts
- Can run on startup in development mode

---

### Device Linking

**Automatic Linking:**

- When user signs in with `x-device-id` header
- Updates `DeviceInstallation.userId` from `null` to user ID
- Links all devices with matching `deviceId`

**Manual Linking:**

- Via `PUT /users/fcm-token` with `deviceId` parameter

---

## Configuration

### Environment Variables

**Required:**

```bash
# OneSignal (Active)
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key

# Notification Scheduler
NOTIFICATION_CRON_SCHEDULE=0 9 * * *  # Daily at 9 AM UTC (optional, has default)
```

**Optional:**

```bash
# Development
RUN_NOTIFICATIONS_ON_STARTUP=true  # Run notifications on server start (dev only)

# Firebase (Inactive - kept for reference)
# FCM_SERVER_KEY=your_fcm_server_key  # Not used, but preserved
```

### Cron Schedule Format

Uses `node-cron` format:

- `0 9 * * *` - Daily at 9:00 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight

---

## File Structure

### New Files Created

```
src/
├── models/
│   └── device-installation.js          # Device tracking model
├── helpers/
│   └── push-notifications.js          # Notification service (OneSignal/FCM)
├── services/
│   ├── notification-scheduler.js     # Notification logic
│   └── notification-cron.js            # Cron job setup
└── routes/
    ├── devices/
    │   ├── index.js                    # Device routes
    │   └── register-device.js          # Device registration endpoint
    └── others/
        └── trigger-notifications.js     # Admin trigger endpoint
```

### Modified Files

```
src/
├── models/
│   └── user.js                         # Added notification fields
├── routes/
│   ├── auth/
│   │   ├── sign-in.js                 # Track lastSignIn
│   │   ├── google-sign-in.js          # Track lastSignIn
│   │   ├── facebook-sign-in.js        # Track lastSignIn
│   │   ├── apple-sign-in.js           # Track lastSignIn
│   │   └── activate-account.js        # Set lastSignIn on activation
│   ├── users/
│   │   ├── index.js                   # Added fcm-token route
│   │   └── update-fcm-token.js        # Token update endpoint
│   └── index.js                       # Added /devices route
└── index.js                           # Initialize cron scheduler
```

---

## Testing & Deployment

### Testing Checklist

1. **Device Registration:**

   - [ ] Register device without authentication
   - [ ] Update existing device
   - [ ] Verify device record created with `userId = null`

2. **Sign-In Tracking:**

   - [ ] Verify `lastSignIn` updated on all sign-in methods
   - [ ] Verify `notificationType` reset to `null`
   - [ ] Verify device linking works with `x-device-id` header

3. **Notifications:**

   - [ ] Test 24h download notification (manual trigger)
   - [ ] Test inactivity notifications (3d, 7d, 14d, 30d)
   - [ ] Verify duplicate prevention works
   - [ ] Verify OneSignal integration works

4. **Cron Job:**
   - [ ] Verify cron job runs on schedule
   - [ ] Check logs for notification processing
   - [ ] Verify error handling

### Deployment Steps

1. **Install Dependencies:**

   ```bash
   npm install
   ```

2. **Set Environment Variables:**

   ```bash
   ONESIGNAL_APP_ID=your_app_id
   ONESIGNAL_REST_API_KEY=your_api_key
   NOTIFICATION_CRON_SCHEDULE=0 9 * * *
   ```

3. **Database Migration:**

   - No migration needed (all fields are optional with defaults)
   - Existing users will have `lastSignIn = null` initially
   - Will be populated as users sign in

4. **Verify:**
   - Check server logs for cron initialization
   - Test device registration endpoint
   - Test manual notification trigger (admin)

### Monitoring

**Key Metrics to Monitor:**

- Notification delivery success rate
- Cron job execution logs
- Device registration count
- User sign-in tracking accuracy

**Log Messages:**

- `"Starting notification scheduler..."`
- `"Found X devices/users for notification"`
- `"Sent notification to user/device"`
- `"Notification scheduler completed"`

---

## Troubleshooting

### Common Issues

1. **Notifications Not Sending:**

   - Check OneSignal credentials in environment variables
   - Verify player IDs are valid
   - Check OneSignal dashboard for delivery status

2. **Cron Job Not Running:**

   - Verify `node-cron` is installed
   - Check cron schedule format
   - Review server startup logs

3. **Duplicate Notifications:**

   - Verify `notificationType` tracking is working
   - Check `lastNotificationSent` timestamps
   - Review notification scheduler logic

4. **Device Not Linking:**
   - Verify `x-device-id` header is sent
   - Check device registration exists
   - Review sign-in route logs

---

## Future Enhancements

### Potential Improvements

1. **Notification Preferences:**

   - Allow users to opt-out of specific notification types
   - Timezone-aware scheduling

2. **Analytics:**

   - Track notification open rates
   - A/B testing for notification messages

3. **Multi-language Support:**

   - Localized notification messages
   - Language preference tracking

4. **Advanced Scheduling:**
   - User timezone-based scheduling
   - Optimal send time calculation

---

## Support & Maintenance

### Code Maintenance

- **Notification Messages:** Edit `NOTIFICATION_MESSAGES` in `notification-scheduler.js`
- **Cron Schedule:** Update `NOTIFICATION_CRON_SCHEDULE` environment variable
- **Service Switch:** Modify `sendPushNotification()` in `push-notifications.js`

### Documentation Updates

This document should be updated when:

- New notification scenarios are added
- API endpoints change
- Database schema is modified
- Notification service is switched

---

## Appendix

### Notification Message Configuration

**Location:** `src/services/notification-scheduler.js`

```javascript
const NOTIFICATION_MESSAGES = {
  DOWNLOAD_24H: {
    title: "Welcome to AXS Map!",
    body: "Don't forget to sign in! Start mapping today!",
  },
  INACTIVITY_3D: {
    title: "Hey! Miss us?",
    body: "We miss you! Leave a review today!",
  },
  INACTIVITY_7D: {
    title: "Was it something I said?",
    body: "Leave a review today!",
  },
  INACTIVITY_14D: {
    title: "Remember me?",
    body: "Let's explore today!",
  },
  INACTIVITY_30D: {
    title: "Accessibility affects everyone",
    body: "We'll be here when you get back!",
  },
};
```

### Database Queries

**Find devices for 24h notification:**

```javascript
DeviceInstallation.find({
  userId: null,
  installedAt: { $gte: twentyFiveHoursAgo, $lte: twentyFourHoursAgo },
  fcmToken: { $ne: null },
  $or: [
    { notificationType: { $ne: "download_24h" } },
    { notificationType: null },
  ],
});
```

**Find inactive users:**

```javascript
User.find({
  lastSignIn: { $gte: daysAgoStart, $lte: daysAgoEnd },
  isArchived: false,
  isBlocked: false,
  fcmToken: { $ne: null },
  $or: [
    { notificationType: { $ne: notificationType } },
    { notificationType: null },
  ],
});
```

---

**Document Version:** 1.0  
**Last Updated:** 2025  
**Maintained By:** Development Team
