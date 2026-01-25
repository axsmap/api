# Frontend Integration Guide: Inactivity Tracking System

## Overview
This system archives inactive user accounts after 1 year and allows users to reactivate them. The flow is designed to be secure and prevent account takeover.

## Security Model
The reactivation flow requires **two-factor verification**:
1. **Something they know (email)**: User must attempt login with their email first
2. **Something they prove (password)**: User must provide their current password to complete reactivation

This prevents attackers from reactivating accounts without knowing the password.

### Alternative Recovery: Forgot Password
Users can also reactivate archived accounts using the **Forgot Password** flow:
- Archived users can request a password reset email
- Completing the reset will automatically reactivate their account
- This is secure because it requires access to the user's email

---

## API Changes

### 1. Sign-In Responses for Archived Users

When a user attempts to sign in and their account is archived, the API returns:

**Regular Sign-In (POST /auth/sign-in)**
```json
{
  "status": 403,
  "body": {
    "general": "Account is archived due to inactivity",
    "isArchived": true,
    "requiresReactivation": true,
    "userId": "507f1f77bcf86cd799439011"
  }
}
```

**Google Sign-In (POST /auth/google-sign-in)**
```json
{
  "status": 403,
  "body": {
    "general": "Account is archived due to inactivity",
    "isArchived": true,
    "requiresReactivation": true,
    "userId": "507f1f77bcf86cd799439011"
  }
}
```

**Facebook Sign-In (POST /auth/facebook-sign-in)**
```json
{
  "status": 403,
  "body": {
    "general": "Account is archived due to inactivity",
    "isArchived": true,
    "requiresReactivation": true,
    "userId": "507f1f77bcf86cd799439011"
  }
}
```

> **Note**: Social login users (Google/Facebook) should use the **Forgot Password** flow to reactivate, since they may not have a password set.

---

### 2. Reactivate Account Endpoint

**POST /auth/reactivate-account**

Allows archived users to reactivate their account by verifying their identity with their current password.

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "currentPassword": "their-old-password",
  "newPassword": "new-secure-password-123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Optional Fields** (can be updated during reactivation):
- `email` - Update email address
- `disabilities` - Disability information
- `gender` - Gender
- `zip` - Zip code
- `phone` - Phone number
- `showDisabilities` - Privacy setting
- `showEmail` - Privacy setting
- `showPhone` - Privacy setting
- `aboutMe` - Bio/description
- `birthday` - Date of birth
- `race` - Race/ethnicity
- `disability` - Disability type

**Success Response (200):**
```json
{
  "general": "Account reactivated successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "507f1f77bcf86cd799439011abc123..."
}
```

**Error Responses:**

| Status | Scenario | Response |
|--------|----------|----------|
| 400 | Missing userId | `{ "userId": "User ID is required" }` |
| 400 | Missing currentPassword | `{ "currentPassword": "Current password is required" }` |
| 400 | Invalid newPassword | `{ "newPassword": "New password must be at least 8 characters" }` |
| 400 | Invalid userId or password | `{ "general": "Invalid credentials" }` |
| 400 | Social login user | `{ "general": "This account was created with social login..." }` |

---

## Frontend Implementation

### Step 1: Update Sign-In Handler

```javascript
const handleSignIn = async (email, password, rememberMe) => {
  try {
    const response = await api.post('/auth/sign-in', { email, password, rememberMe });
    // Handle successful login
    storeTokens(response.data);
    redirectToDashboard();
  } catch (error) {
    if (error.response?.status === 403 && error.response?.data?.isArchived) {
      // Store userId for reactivation flow
      const { userId } = error.response.data;
      redirectToReactivation({ userId, email });
    } else {
      showError(error.response?.data?.general || 'Login failed');
    }
  }
};
```

### Step 2: Create Reactivation Page

```jsx
// ReactivateAccountPage.jsx
import { useState } from 'react';

const ReactivateAccountPage = () => {
  const { userId, email } = useLocation().state || {};
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reactivate-account', {
        userId,
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        firstName: formData.firstName,
        lastName: formData.lastName
      });
      
      // Store tokens and redirect
      storeTokens(response.data);
      showSuccess('Account reactivated successfully!');
      redirectToDashboard();
    } catch (error) {
      setErrors(error.response?.data || { general: 'Reactivation failed' });
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return <Redirect to="/sign-in" />;
  }

  return (
    <div className="reactivate-page">
      <h1>Reactivate Your Account</h1>
      <p>Your account was archived due to inactivity. Enter your current password to reactivate it.</p>
      
      {errors.general && <Alert type="error">{errors.general}</Alert>}
      
      <form onSubmit={handleSubmit}>
        <Input
          label="Current Password"
          type="password"
          value={formData.currentPassword}
          onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
          error={errors.currentPassword}
          helperText="Enter the password you used before your account was archived"
        />
        
        <Input
          label="New Password"
          type="password"
          value={formData.newPassword}
          onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
          error={errors.newPassword}
          helperText="8-30 characters"
        />
        
        <Input
          label="Confirm New Password"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
          error={errors.confirmPassword}
        />
        
        <Input
          label="First Name"
          type="text"
          value={formData.firstName}
          onChange={(e) => setFormData({...formData, firstName: e.target.value})}
          error={errors.firstName}
        />
        
        <Input
          label="Last Name"
          type="text"
          value={formData.lastName}
          onChange={(e) => setFormData({...formData, lastName: e.target.value})}
          error={errors.lastName}
        />
        
        <Button type="submit" loading={loading}>
          Reactivate Account
        </Button>
      </form>
      
      <p className="social-login-note">
        If you originally signed up with Google or Facebook and cannot reactivate,
        please <a href="/contact">contact support</a>.
      </p>
    </div>
  );
};
```

### Step 3: Handle Social Login Archived Users

For Google/Facebook users, they can use the **Forgot Password** flow to reactivate:

```jsx
const handleGoogleSignIn = async (credential, rememberMe) => {
  try {
    const response = await api.post('/auth/google-sign-in', { credential, rememberMe });
    storeTokens(response.data);
    redirectToDashboard();
  } catch (error) {
    if (error.response?.status === 403 && error.response?.data?.isArchived) {
      // Social login users should use forgot password to reactivate
      showModal({
        title: 'Account Archived',
        message: 'Your account has been archived due to inactivity. You can reactivate it by using the "Forgot Password" feature to set a new password.',
        actions: [
          { label: 'Reset Password', onClick: () => window.location.href = '/forgotten-password' },
          { label: 'Cancel', onClick: () => {} }
        ]
      });
    } else {
      showError(error.response?.data?.general || 'Login failed');
    }
  }
};
```

---

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Login Flow                              │
└─────────────────────────────────────────────────────────────────┘

User attempts login (email/password or social)
                    │
                    ▼
         ┌──────────────────┐
         │  Account Active? │
         └────────┬─────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
       ▼                     ▼
    [YES]                  [NO - Archived]
       │                     │
       ▼                     ▼
  Login Success        Return 403 with:
       │               - isArchived: true
       ▼               - userId: "..."
  Return tokens              │
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
       [Password User]               [Social User]
              │                             │
              ▼                             ▼
     Show Reactivation            Show "Contact Support"
         Form                          Message
              │
              ▼
     User enters:
     - userId (from 403)
     - currentPassword
     - newPassword
     - firstName
     - lastName
              │
              ▼
    POST /auth/reactivate-account
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
    [Valid]      [Invalid]
       │             │
       ▼             ▼
  Account         Show error
  Reactivated     "Invalid credentials"
       │
       ▼
  Return tokens
  (auto logged in)
```

---

## Email Templates

Users will receive these emails from the inactivity system:

### 1. Inactivity Warning Email (sent at 11 months of inactivity)
Subject: "Your AXS Map account will be archived soon"

Content explains:
- Account will be archived in 30 days if they don't log in
- Link to sign in

### 2. Account Archived Email (sent when archived at 12 months)
Subject: "Your AXS Map account has been archived"

Content explains:
- Account is now archived
- They can reactivate by signing in and using their current password
- No data has been deleted

---

## Validation Rules

### Reactivation Request Validation

| Field | Rules |
|-------|-------|
| `userId` | Required, string, exactly 24 characters (MongoDB ObjectId) |
| `currentPassword` | Required, string |
| `newPassword` | Required, string, 8-30 characters |
| `firstName` | Required, string, letters only, max 24 characters |
| `lastName` | Required, string, letters only, max 36 characters |

---

## Testing

### Test Scenarios

1. **Archived user login (password)**
   - User attempts sign-in with archived account
   - Should receive 403 with `isArchived: true` and `userId`

2. **Successful reactivation via endpoint**
   - User provides correct userId + currentPassword
   - Account reactivated, tokens returned

3. **Wrong current password**
   - User provides wrong currentPassword
   - Should receive 400 "Invalid credentials"

4. **Social login archived user**
   - User attempts Google/Facebook sign-in
   - Should receive 403 with archived message
   - Redirect to forgot password flow

5. **Invalid userId**
   - User provides non-existent userId
   - Should receive 400 "Invalid credentials"

6. **Forgot password reactivation (NEW)**
   - Archived user requests password reset via `/auth/forgotten-password`
   - Email is sent successfully (archived users are NOT excluded)
   - User resets password via `/auth/reset-password`
   - Account is automatically reactivated
   - `lastLogin` is updated
   - `isArchived` is set to `false`
   - `inactivityEmailSent` is reset to `false`

7. **Active user forgot password**
   - Active user resets password
   - `lastLogin` is updated (resets inactivity timer)
   - Inactivity flags are cleared

---

## Questions?

Contact the backend team for any integration questions.
