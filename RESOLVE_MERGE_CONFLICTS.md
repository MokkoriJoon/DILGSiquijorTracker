# 🔧 Resolving GitHub Merge Conflicts

## Problem
You're seeing a merge conflict in `api/scheduler.ts` when trying to merge your PR.

## Solution: Step-by-Step Guide

### Option 1: Resolve via GitHub Web Interface (RECOMMENDED)

#### Step 1: Go to Your Pull Request
1. Open your PR on GitHub
2. You'll see a message: "This branch has conflicts that must be resolved"
3. Click the **"Resolve conflicts"** button

#### Step 2: Review the Conflicts
You'll see something like this:
```
<<<<<<< main
(old code from main branch)
=======
(new code from your branch)
>>>>>>> your-branch-name
```

#### Step 3: Keep Your Version
Since your version is the correct one (with the auto-scheduler), **delete the conflict markers** and keep your code:

**Remove these lines:**
- `<<<<<<< main`
- Everything between `=======` and `>>>>>>> your-branch-name`
- `=======`
- `>>>>>>> your-branch-name`

**Keep only your code** (the new scheduler code with better logging)

#### Step 4: Mark as Resolved
1. Click **"Mark as resolved"** for each conflicted file
2. Click **"Commit merge"**
3. GitHub will create a merge commit

#### Step 5: Wait for Checks
- GitHub will run the checks again
- If all checks pass, you can merge the PR

---

### Option 2: Resolve via Command Line

If you prefer using the terminal:

```bash
# 1. Make sure you're on your feature branch
git checkout your-branch-name

# 2. Fetch latest changes from main
git fetch origin

# 3. Merge main into your branch
git merge origin/main

# 4. You'll see conflict markers in api/scheduler.ts
# 5. Open the file in your editor
code api/scheduler.ts  # or use your preferred editor

# 6. Remove conflict markers and keep your code
# 7. Stage the resolved file
git add api/scheduler.ts

# 8. Commit the merge
git commit -m "Merge main branch and resolve conflicts"

# 9. Push to GitHub
git push origin your-branch-name
```

---

### Option 3: Create a Fresh PR (Cleanest Approach)

If the conflicts are too messy, start fresh:

```bash
# 1. Go to main branch
git checkout main

# 2. Pull latest changes
git pull origin main

# 3. Create a new branch with a clear name
git checkout -b feature/auto-scheduler-v2

# 4. Copy your changes from the old branch
# (You'll need to reapply the changes manually)

# 5. Commit and push
git add .
git commit -m "Add auto-scheduler and dashboard enhancements"
git push origin feature/auto-scheduler-v2

# 6. Create a new PR on GitHub
```

---

## 📋 What to Keep in api/scheduler.ts

Your version should look like this (with the enhanced logging):

```typescript
/**
 * Vercel Serverless Function: Scheduler API
 * 
 * This runs automatically via Vercel Cron at:
 * - 12:01 AM (Midnight)
 * - 8:01 AM (Morning)
 * - 12:01 PM (Noon)
 * - 5:01 PM (Evening)
 * 
 * It handles:
 * 1. Marking overdue tasks
 * 2. Generating new recurring task instances
 * 3. Sending reminder notifications
 */

import { SchedulerService } from '../src/services/scheduler';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  try {
    console.log('[Cron] ========================================');
    console.log('[Cron] Running scheduled task generation...');
    console.log('[Cron] Time:', new Date().toISOString());
    console.log('[Cron] ========================================');
    
    const result = await SchedulerService.generateInstances();
    
    console.log('[Cron] ========================================');
    console.log('[Cron] Scheduler completed successfully!');
    console.log('[Cron] Generated:', result.generated, 'instances');
    console.log('[Cron] Errors:', result.errors.length);
    console.log('[Cron] ========================================');

    if (result.errors.length > 0) {
      console.error('[Cron] Errors encountered:', result.errors);
    }
    
    res.status(200).json({
      success: true,
      message: 'Scheduler executed successfully',
      timestamp: new Date().toISOString(),
      generated: result.generated,
      errorCount: result.errors.length,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Cron] ========================================');
    console.error('[Cron] Scheduler FAILED!');
    console.error('[Cron] Error:', error);
    console.error('[Cron] ========================================');
    
    res.status(500).json({
      success: false,
      error: 'Scheduler failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 🎯 About the PR Number (#47 vs #48)

The PR number is assigned by GitHub automatically when you create a new PR. If you're seeing #47 instead of #48, it means:

- **PR #47** already exists (maybe from a previous attempt)
- You need to either:
  - **Update PR #47** by pushing new commits to the same branch
  - **Close PR #47** and create a new PR #48

### To Update PR #47:
```bash
# Make sure you're on the same branch as PR #47
git checkout your-branch-name

# Make your changes
# ...

# Commit and push
git add .
git commit -m "Fix merge conflicts and update scheduler"
git push origin your-branch-name
```

### To Create PR #48:
```bash
# Close PR #47 on GitHub first

# Create a new branch
git checkout main
git pull origin main
git checkout -b feature/new-attempt

# Make your changes
# ...

# Commit and push
git add .
git commit -m "Add auto-scheduler and dashboard enhancements"
git push origin feature/new-attempt

# Create new PR on GitHub (this will be #48)
```

---

## ✅ Checklist Before Merging

- [ ] All conflict markers removed (`<<<<<<<`, `=======`, `>>>>>>>`)
- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Vercel deployment succeeds
- [ ] No TypeScript errors
- [ ] Scheduler API endpoint works
- [ ] Public dashboard shows overdue/urgent tasks correctly

---

## 🚀 After Resolving Conflicts

Once conflicts are resolved:

1. **Wait for GitHub checks to pass**
   - Build check
   - Vercel deployment
   - Any other CI/CD checks

2. **Review the changes one more time**
   - Make sure all your features are included
   - Check that no code was accidentally removed

3. **Merge the PR**
   - Click "Merge pull request"
   - Choose "Squash and merge" for a clean history
   - Add a merge commit message

4. **Verify on Production**
   - Check that the auto-scheduler is running
   - Verify the public dashboard shows overdue/urgent tasks
   - Test the scheduler manually if needed

---

## 🆘 Still Having Issues?

If you're still stuck:

1. **Take a screenshot** of the conflict
2. **Share the error message** from GitHub
3. **I can help you resolve it** step by step

Just let me know what you're seeing and I'll guide you through it!

---

**Status:** Ready to resolve conflicts  
**Recommendation:** Use Option 1 (GitHub Web Interface) for easiest resolution
