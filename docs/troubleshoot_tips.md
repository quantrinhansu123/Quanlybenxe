# Troubleshooting Tips

## Rule #1: ISOLATE BEFORE FIX (The "Null Object" Rule)

### When to Apply
When you see errors like:
- `Cannot read properties of null/undefined (reading 'X')`
- `X is not defined`
- Data unexpectedly missing/null after an operation

### The Rule: Don't fix what you assume - verify what you know

**STOP and ask:** "Why is this object null in the first place?"

### 3-Step Process

#### Step 1: Reproduce Locally (< 5 minutes)
Create a minimal script to reproduce the exact issue:
```javascript
// debug-issue.js
import { yourFunction } from './dist/module.js';

async function test() {
  const result = await yourFunction(knownInput);
  console.log('Result:', result);
  console.log('Is null?:', result === null);
}
test();
```

**DO NOT deploy to production until you can reproduce locally.**

#### Step 2: Binary Search the Data Flow (< 10 minutes)
Trace the data through each layer:

```
Database → Query Layer → Business Logic → Response
   ↓           ↓              ↓            ↓
  EXISTS?   RETURNS?       TRANSFORMS?   SENDS?
```

Test each layer independently:
```javascript
// Layer 1: Does data exist in DB?
const raw = await db.ref('collection/id').once('value');
console.log('DB has data:', raw.exists());

// Layer 2: Does query layer return it?
const { data } = await queryBuilder.from('collection').eq('id', id).single();
console.log('Query returns:', data);

// Layer 3: Does transform work?
const transformed = transform(data);
console.log('Transform returns:', transformed);
```

#### Step 3: Find the Breaking Layer
The bug is in the layer where:
- Input is VALID
- Output is NULL/WRONG

Then READ THE CODE of that specific layer before making any assumptions.

### Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | Do This Instead |
|--------------|----------------|-----------------|
| Fix the symptom (add null checks) | Hides the real bug | Find why it's null |
| Assume the cause without verifying | Wastes time on wrong fixes | Reproduce first |
| Deploy → Test → Fix loop | Slow feedback (3-5 min/cycle) | Test locally (seconds) |
| Fix multiple things at once | Can't tell which fix worked | One change at a time |
| Read error message superficially | Miss the real clue | Ask "WHY is X null?" |

### Real Example

**Error:** `Cannot read properties of null (reading 'plate_number')`

**Wrong approach (took 1 hour):**
1. Assumed "join not working" → fixed all join syntax
2. Assumed "spread order wrong" → fixed spread order
3. Assumed "null check missing" → added null checks
4. Still broken...

**Right approach (would take 10 minutes):**
1. Script: Does `db.ref('vehicles/id')` return data? → YES
2. Script: Does `queryBuilder.eq('id', id).single()` return data? → NO
3. Read queryBuilder code → Found `limitToFirst(1)` applied BEFORE filter
4. Fix the actual bug

### Checklist Before Any Fix

- [ ] Can I reproduce this locally with a simple script?
- [ ] Have I verified data exists at the source?
- [ ] Have I tested each layer independently?
- [ ] Do I know EXACTLY which layer is breaking?
- [ ] Have I READ the code of the breaking layer?
- [ ] Am I fixing the ROOT CAUSE, not a symptom?

---

## Rule #2: AVOID RATE LIMITING (The "Slow Down" Rule)

### When to Apply
When you see:
- Login fails with correct credentials
- No error message displayed but action doesn't complete
- Repeated API calls suddenly stop working
- Automation scripts fail after running multiple times

### The Rule: Servers protect themselves from abuse - respect their limits

### Common Scenarios

#### Scenario 1: Automated Login Scripts
**Problem:** Running Puppeteer/automation scripts that login repeatedly causes rate limiting.

**Symptoms:**
- First few runs work fine
- Later runs fail silently (no error, just doesn't login)
- Manual login in browser still works (different session)

**Solutions:**
1. **Wait 5-10 minutes** before retrying
2. **Restart backend server** to reset rate limit counters
3. **Add delays** between attempts:
   ```javascript
   await sleep(3000); // Wait 3 seconds before login
   await page.click('#login-button');
   await sleep(8000); // Wait 8 seconds for response
   ```
4. **Check if already logged in** before attempting login:
   ```javascript
   // Go directly to protected page first
   await page.goto('/dashboard');
   if (!page.url().includes('login')) {
     console.log('Already logged in!');
   }
   ```

#### Scenario 2: API Rate Limiting
**Problem:** Too many API requests in short time.

**Solutions:**
1. **Add exponential backoff:**
   ```javascript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (e) {
         if (i === maxRetries - 1) throw e;
         await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s...
       }
     }
   }
   ```
2. **Batch requests** instead of individual calls
3. **Cache responses** when possible

### Prevention Checklist
- [ ] Add reasonable delays between automated actions
- [ ] Implement retry logic with backoff
- [ ] Check session/auth state before re-authenticating
- [ ] Don't run automation scripts in tight loops
- [ ] Consider using test accounts with higher limits

---

## Rule #3: UNDERSTAND RLS POLICIES (The "Access Denied" Rule)

### When to Apply
When you see errors like:
- `new row violates row-level security policy`
- `permission denied for table X`
- Data queries return empty results despite data existing
- Inserts/updates fail with no clear error message

### The Rule: Supabase Row Level Security (RLS) controls data access - check policies first

**STOP and ask:** "Does my query have permission to access this data?"

### 3-Step Process

#### Step 1: Verify RLS is Enabled
```sql
-- Check if RLS is enabled on table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'your_table';
```

If `rowsecurity = true`, RLS is ON. All queries need matching policies.

#### Step 2: Check Existing Policies
```sql
-- List all policies for a table
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

Common policy patterns:
- `USING (auth.uid() = user_id)` - User can only see their own data
- `USING (true)` - Anyone can read (public data)
- `WITH CHECK (auth.role() = 'admin')` - Only admins can insert/update

#### Step 3: Test with Service Role Key
Use service role key (bypasses RLS) to confirm data exists:
```typescript
// In server-side code ONLY (NEVER in client)
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, SERVICE_ROLE_KEY) // Bypasses RLS
const { data } = await supabase.from('table').select('*')
console.log('Data exists:', data?.length)
```

If data shows up with service role but not anon key → RLS policy issue.

### Common Solutions

#### Solution 1: Add Missing Policy
```sql
-- Allow authenticated users to read all rows
CREATE POLICY "Enable read for authenticated users"
ON public.vehicles
FOR SELECT
TO authenticated
USING (true);

-- Allow users to insert their own data
CREATE POLICY "Enable insert for users"
ON public.dispatch_records
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

#### Solution 2: Use Service Role for Backend Operations
```typescript
// server/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// For backend operations (bypasses RLS)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role
)

// For client operations (respects RLS)
export const supabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY! // Use anon key
)
```

#### Solution 3: Temporarily Disable RLS (DEV ONLY)
```sql
-- ⚠️ DEVELOPMENT ONLY - NEVER IN PRODUCTION
ALTER TABLE public.your_table DISABLE ROW LEVEL SECURITY;
```

### Prevention Checklist
- [ ] Understand which Supabase key you're using (anon vs service role)
- [ ] Check RLS policies before querying new tables
- [ ] Use service role key for backend trusted operations
- [ ] Use anon key for client-side operations with RLS
- [ ] Test policies with different user roles
- [ ] Document required policies in migration files

### Real Example

**Error:** `SELECT` query returns `[]` despite data existing in Supabase dashboard.

**Wrong approach:**
1. Assume query syntax wrong → rewrite query
2. Assume data not migrated → re-run migration
3. Assume ORM bug → switch to raw SQL

**Right approach:**
1. Check if table has RLS enabled → YES
2. Check policies → Only `INSERT` policy exists, no `SELECT` policy
3. Add `SELECT` policy:
```sql
CREATE POLICY "Enable read for all users"
ON public.vehicles
FOR SELECT
TO public
USING (true);
```
4. Query works ✅

---

## Rule #4: [Add more rules as you discover them]
