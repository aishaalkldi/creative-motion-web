# Development Authentication Bypass

## Overview

A temporary frontend-only authentication bypass to allow MVP UI development without waiting for the backend login system to be fully functional.

## Features

- ✅ **Dev mode only** - Only works when `NODE_ENV === 'development'`
- ✅ **Frontend only** - No backend changes required
- ✅ **Production safe** - Completely disabled in production builds
- ✅ **Non-invasive** - Existing auth code remains untouched
- ✅ **Easy to remove** - Clean separation for future cleanup

## How to Use

### Option 1: From Login Page

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to any protected route (e.g., `/clinician`)

3. You'll be redirected to `/login`

4. Click the **"🛠️ Dev Bypass (Skip Backend Login)"** button

5. You'll be redirected to the clinician dashboard with a mock session

### Option 2: Programmatic Usage

```typescript
import { setupDevAuthSession, isDevBypassEnabled } from '@/app/lib/dev-auth';

// Check if dev bypass is available
if (isDevBypassEnabled()) {
  // Set up mock authentication
  setupDevAuthSession();
  
  // Navigate to protected route
  router.push('/clinician');
}
```

## Mock User Details

The dev bypass creates a mock therapist user:

```typescript
{
  id: 999,
  full_name: "Dr. Dev Therapist",
  email: "dev@creative-motion.local",
  is_active: true,
  created_at: <current timestamp>
}
```

## How It Works

1. **Token Storage**: Creates a special dev token (`dev_bypass_token_*`) and stores it in:
   - `localStorage` (key: `cm_access_token`)
   - Cookie (key: `cm_token`)

2. **Middleware Recognition**: The Next.js middleware recognizes dev bypass tokens in development mode and allows access to protected routes

3. **Session Persistence**: The mock session persists across page reloads until:
   - You clear localStorage/cookies
   - You restart the dev server
   - You switch to production mode

## What's Modified

### New Files
- `app/lib/dev-auth.ts` - Dev bypass logic

### Modified Files
- `middleware.ts` - Added dev bypass token recognition
- `app/login/page.tsx` - Added dev bypass button

## Removal Plan

When the backend auth is ready:

1. Remove the dev bypass button from `app/login/page.tsx`
2. Remove dev bypass check from `middleware.ts`
3. Delete `app/lib/dev-auth.ts`
4. Delete this documentation file

## Troubleshooting

### Dev bypass button doesn't appear
- Ensure `NODE_ENV=development`
- Check that you're on the `/login` page
- Clear browser cache and reload

### Still getting redirected after clicking bypass
- Check browser console for errors
- Verify localStorage has `cm_access_token` with value starting with `dev_bypass_token_`
- Check cookies for `cm_token`

### Protected routes still require login
- Ensure middleware is recognizing the dev token
- Restart the development server
- Clear all cookies and try again

## Notes

- This bypass **does NOT** work for actual backend API calls that require JWT validation
- Backend endpoints will still return 401/403 errors if called
- This is purely for frontend navigation and UI development
- The mock user ID (999) should not conflict with real user IDs in your database
