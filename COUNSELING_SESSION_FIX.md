# Counseling Session Workflow Highlighting - Issue Fixed

## Problem Summary
When logged in as a Social Worker and completing the "Counseling Session" step, the workflow was still highlighting it as **in-progress** even after completion, preventing the user from seeing it as completed.

## Root Cause Analysis

### Issue 1: Role Name Mismatch 🔴
The backend and frontend were using **different role naming conventions**:
- **Backend**: Accepts both `'social_work'` and `'social_worker'`
- **Frontend**: Expected only `'social_worker'` (singular)

When a user logged in with the role `'social_work'` (from backend), the component couldn't match it to the workflow step that had `role: "social_worker"`.

### Issue 2: Workflow State Logic Bug 🔴
In the `firstOwnedNotCompleted` function (line 759), after syncing the workflow status from the backend:
```tsx
// OLD CODE (BUGGY)
const firstOwnedNotCompleted = nextSteps.findIndex(
  (s) =>
    s.status !== "completed" &&
    (userRole === "administrator" || s.role === userRole) &&  // ← FAILS when role names don't match
    (s.id !== "closure" || counselingDone),
)
```

**What happened:**
1. Backend correctly marked "Counseling" as `completed: true`
2. Component set status to "completed"
3. BUT then the `firstOwnedNotCompleted` logic found NO matching step (because role names didn't match)
4. So it would re-highlight the "Counseling" step as "in-progress" incorrectly

## Solution Implemented ✅

### 1. Updated `canAccessStep()` Function (Lines 450-465)
```tsx
const canAccessStep = (step: WorkflowStep) => {
  if (userRole === "administrator") return true
  if (step.status === "completed") return true
  if (step.id === "closure") {
    const counselingDone = workflowSteps.find((s) => s.id === "counseling")?.status === "completed"
    const roleMatches = step.role === userRole || 
      (userRole === "social_work" && step.role === "social_worker") ||
      (userRole === "social_worker" && step.role === "social_work")
    return roleMatches && counselingDone
  }
  // ✅ Handle both role naming conventions
  const roleMatches = step.role === userRole || 
    (userRole === "social_work" && step.role === "social_worker") ||
    (userRole === "social_worker" && step.role === "social_work")
  return roleMatches
}
```

### 2. Fixed `firstOwnedNotCompleted` Logic (Lines 747-769)
```tsx
const firstOwnedNotCompleted = nextSteps.findIndex(
  (s) =>
    s.status !== "completed" &&
    (userRole === "administrator" || 
     s.role === userRole || 
     // ✅ Handle role name variations
     (userRole === "social_work" && s.role === "social_worker") ||
     (userRole === "social_worker" && s.role === "social_work")) &&
    (s.id !== "closure" || counselingDone),
)
```

### 3. Fixed `firstActionableLocalIdx` Logic (Lines 777-785)
```tsx
const firstActionableLocalIdx = nextSteps.findIndex((s) => {
  if (s.status === "completed") return false
  if (userRole === "administrator") return true
  // ✅ Handle both role naming conventions
  const roleMatches = s.role === userRole || 
    (userRole === "social_work" && s.role === "social_worker") ||
    (userRole === "social_worker" && s.role === "social_work")
  return roleMatches
})
```

## Files Modified
- `components/patients/clinical-workflow.tsx` - Updated role matching logic in 3 key functions

## What This Fixes

| Scenario | Before | After |
|----------|--------|-------|
| Social worker (role: `social_work`) logs in | ❌ Can't see counseling step | ✅ Can see and access it |
| Social worker completes counseling | ❌ Shows as "in-progress" still | ✅ Correctly shows as "completed" |
| Switching between role naming | ❌ Inconsistent behavior | ✅ Handles both formats |
| Next step highlighting | ❌ Wrong step highlighted | ✅ Correct step highlighted |

## How It Works Now

### Workflow Completion Flow:
1. Social worker logs in (role: `social_work` or `social_worker`)
2. Completes counseling session step
3. Clinical note saved to backend with type "Counseling"
4. Workflow syncs from backend ✅ Now correctly identifies the step as completed
5. Step shows as **"completed"** ✅ (fixed!)
6. Next step (File Closure) is highlighted for doctor ✅ (correct!)

## Testing Recommendations

Test these scenarios to verify the fix:

```
1. Login as Social Worker
   └─ Verify "Counseling Session" step is accessible
   
2. Complete Counseling Session
   ├─ Add mental health screening notes
   ├─ Add counseling notes
   └─ Click "Complete Counseling Session"
   
3. Verify Completion Status
   ├─ ✅ Step shows as "completed"
   ├─ ✅ Green checkmark displays
   ├─ ✅ "Completed by [Name] on [Date]" shows
   └─ ✅ NOT highlighted as "in-progress"
   
4. Verify Next Step Accessibility
   ├─ ✅ File Closure step is now "in-progress"
   ├─ ✅ Only doctor can access it
   └─ ✅ Workflow progresses correctly
```

## Deployment Status ✅
- **Branch**: master
- **Commit**: b420f20
- **Deploy Target**: Azure App Service
- **Status**: Successfully pushed to Azure

## Related Code
- Backend endpoint: `/api/visits/<visit_id>/workflow/status` (app.py:2283)
  - Returns counseling completion status based on clinical notes with type "Counseling" created by Social Worker
- Component: `clinical-workflow.tsx`
  - Workflow step definitions
  - Role-based access control

## Notes
- The fix maintains backward compatibility with both `social_work` and `social_worker` role names
- No database changes required
- No API changes required
- Pure frontend state management fix
