# Quick Reference: Auto Punch-Out Feature

## 🎯 What Was Implemented

**When an employee is punched in and closes their browser tab, they are automatically punched out.**

---

## 📍 Where It Works

### Frontend
- **File**: `app/employee/dashboard/client.tsx`
- **Functions**:
  - `performAutoPunchOut()` - Lines 440–528
  - `handlePageHide()` - Lines 546–559
  - `handleBeforeUnload()` - Lines 534–540

### Backend
- **File**: `app/api/employee/auto-punch-out/route.ts`
- **Endpoint**: `POST /api/employee/auto-punch-out`
- **Action**: Updates attendance table with logout_time

---

## 🔧 How It Works

```
1. Employee closes tab
2. Browser fires "pagehide" event
3. handlePageHide() is triggered
4. performAutoPunchOut() sends request via:
   - sendBeacon() [Primary]
   - keepalive fetch [Fallback]
   - localStorage [Last resort]
5. Wait 100ms
6. performAutoLogout() clears auth
7. Backend records punch-out in database
```

---

## 🧪 How to Test

```bash
# 1. Start app
pnpm dev

# 2. Login as employee
# 3. Click "Drag to start work" to punch in
# 4. Open DevTools (F12) → Console
# 5. Close the tab (Ctrl+W or X button)
# 6. Look for: [auto-punch-out] ✅ sendBeacon invoked
# 7. Check database: attendance table should have logout_time
```

---

## 📊 Expected Console Output

```
[auto-punch-out] beforeunload event - marked maybe_unload flag
[auto-punch-out] pagehide event triggered - performing auto punch-out
[auto-punch-out] Initiating auto punch-out { trigger: "pagehide", ... }
[auto-punch-out] Payload being sent: { timestamp: "...", trigger: "pagehide", source: "tab-close" }
[auto-punch-out] ✅ sendBeacon invoked, result: true
[auto-punch-out] Auto punch-out completed. Beacon sent: true
```

✅ = Punch-out sent successfully
❌ = Method failed, trying next
💾 = Stored offline, will sync later

---

## ⚙️ Key Configuration

```typescript
// In client.tsx
const AUTO_PUNCH_OUT_TIMEOUT = 2000  // Timeout for fetch request
// Delay before logout (CRITICAL!)
setTimeout(() => performAutoLogout(), 100)  // Line 552
```

**Why 100ms delay is critical:**
- Allows `sendBeacon()` to queue the request
- Allows `fetch()` to complete network call
- Prevents auth logout from blocking the request

---

## 🚨 If It's Not Working

| Issue | Check |
|-------|-------|
| No console logs | Is `isPunchedIn = true`? Is employee actually punched in? |
| `❌ sendBeacon failed` | OK! System tries fetch next. |
| `❌ Keepalive fetch failed` | Network issue or auth expired. Check `pendingPunchOut` in localStorage |
| Database not updated | Check `/api/employee/auto-punch-out` logs for errors |
| Auth already cleared | 100ms delay wasn't enough - increase to 200ms if needed |

---

## 📋 Event Details

| Event | Fires On | Use |
|-------|----------|-----|
| **pagehide** | Tab close, refresh, navigate, window close | ✅ Used for punch-out |
| **beforeunload** | Refresh, close, navigate | ❌ Not used (fires on refresh too) |
| **visibilitychange** | Tab switch, minimize, app switch | ❌ Not used (removed) |
| **blur** | App switch, window minimize | ❌ Not used |

---

## 🔄 Three Fallback Methods

```typescript
// Priority 1: sendBeacon - Most reliable, no response needed
navigator.sendBeacon("/api/employee/auto-punch-out", blob)
// ✅ Works even if page is unloading
// ✅ No need to wait for response
// ✅ Browser ensures it sends before closing

// Priority 2: Fetch with keepalive - Alternative
fetch("/api/employee/auto-punch-out", {
  keepalive: true,  // Ensures request continues even during unload
  credentials: "include"  // Send auth cookies
})
// ✅ Works if sendBeacon not available
// ✅ Can get response
// ❌ May not complete if browser closes too fast

// Priority 3: localStorage - Offline fallback
localStorage.setItem("pendingPunchOut", JSON.stringify(pending))
// ✅ Works even if offline
// ❌ Requires user to reopen tab for sync
```

---

## 📝 Implementation Checklist

- ✅ `performAutoPunchOut()` with 3-priority fallback
- ✅ `handlePageHide()` with 100ms timeout before logout
- ✅ `handleBeforeUnload()` for reload detection
- ✅ Event listeners attached when `isPunchedIn = true`
- ✅ Event listeners cleaned up on unmount
- ✅ Duplicate prevention via `punchOutSentRef` flag
- ✅ Console logging with status indicators (✅ ❌ 💾)
- ✅ API endpoint accepts and saves punch-out
- ✅ Offline pending punch-out support
- ✅ Audit logging for all punch-outs

---

## 🎓 Code Review Points

**What Changed**:
1. Replaced `beforeunload`-based punch-out with `pagehide`-based
2. Added 100ms delay between punch-out and logout
3. Improved logging with status indicators
4. Added 3-priority fallback system

**What Stayed Same**:
- API endpoint structure
- Database schema
- Authentication flow
- Heartbeat mechanism

**What Was Removed**:
- Browser confirmation prompt (`returnValue = ""`)
- `visibilitychange` event punch-out
- Manual app-switch detection

---

## 🚀 Deploy Checklist

- [ ] Review `AUTO_PUNCH_OUT_IMPLEMENTATION.md`
- [ ] Test tab close scenario
- [ ] Check console logs
- [ ] Verify database updates
- [ ] Check for any auth errors
- [ ] Monitor performance (should be <100ms total)
- [ ] Deploy to staging first
- [ ] Test in production-like environment
- [ ] Monitor Supabase logs for errors

---

## 📞 Support

If punch-out isn't working:
1. Check browser console for `[auto-punch-out]` logs
2. Verify employee is actually punched in
3. Check Supabase API logs
4. Check localStorage for `pendingPunchOut` (offline indicator)
5. Look for auth errors (401 Unauthorized)
6. Increase timeout if network is slow

---

Last Updated: 2024
Status: ✅ Complete & Ready for Testing
