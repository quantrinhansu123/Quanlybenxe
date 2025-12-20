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

## Rule #2: [Add more rules as you discover them]
