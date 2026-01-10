---
title: "Phase 4: Storage & Cleanup"
status: done
priority: P2
effort: 1.5w
phase: 4
last_updated: 2026-01-10
---

# Phase 4: Storage & Cleanup

> **Previous**: [Phase 3: Backend Migration](./phase-03-backend-drizzle-migration.md) | **Next**: [Phase 5: Testing](./phase-05-testing-validation.md)

## Overview

- **Date**: 2026-01-10
- **Priority**: P2 (Important)
- **Effort**: 1.5 weeks
- **Status**: ✅ Completed
- **Prerequisite**: Phase 3 completed (Backend migrated to Drizzle)

---

## Key Insights từ Analysis

1. **Firebase Storage** - Đang dùng cho entry images (`entry_image_url`)
2. **upload.controller.ts** - Uses `firebase-admin/storage`
3. **Cloudinary** - Also configured, used for some image uploads
4. **Firebase Admin SDK** - Còn dùng cho Storage, cần remove sau migrate

---

## Requirements

### Functional
- [x] Migrate Firebase Storage to Supabase Storage
- [x] Update upload.controller.ts
- [ ] Migrate existing images (if needed) - Deferred to Phase 5
- [ ] Remove Firebase Admin SDK dependency - Keep for now, remove in Phase 6
- [x] Clean up unused code

### Non-Functional
- [x] No broken image URLs (new uploads use Supabase)
- [x] Maintain upload functionality
- [x] Proper file organization in Supabase

---

## Architecture Changes

```
BEFORE:
┌─────────────────────────────────────────────────────────────┐
│ upload.controller.ts                                        │
│      ↓                                                      │
│ Firebase Storage (firebase-admin/storage)                   │
│      ↓                                                      │
│ gs://benxe-management.appspot.com/dispatch-images/          │
└─────────────────────────────────────────────────────────────┘

AFTER:
┌─────────────────────────────────────────────────────────────┐
│ upload.controller.ts                                        │
│      ↓                                                      │
│ Supabase Storage (@supabase/supabase-js)                   │
│      ↓                                                      │
│ https://[project].supabase.co/storage/v1/object/public/    │
│      → dispatch-images/                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Code Files

| File | Purpose | Action |
|------|---------|--------|
| `server/src/controllers/upload.controller.ts` | File upload | Refactor for Supabase |
| `server/src/config/database.ts` | Firebase init with storage | Remove storage config |
| `server/src/routes/upload.routes.ts` | Upload routes | Keep, update controller |
| `server/src/middleware/upload.ts` | Multer config | Keep as-is |

---

## Implementation Steps

### Step 1: Create Supabase Storage Bucket (Day 1)

```sql
-- In Supabase Dashboard > Storage
-- Create bucket: dispatch-images (public)

-- Or via SQL
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispatch-images', 'dispatch-images', true);

-- Set RLS policy (allow authenticated uploads)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dispatch-images');

CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dispatch-images');
```

### Step 2: Create Storage Service (Day 1-2)

```typescript
// server/src/services/storage.service.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const BUCKET_NAME = 'dispatch-images'

export const storageService = {
  /**
   * Upload file to Supabase Storage
   */
  async upload(
    file: Express.Multer.File,
    folder: string = 'entries'
  ): Promise<string> {
    const timestamp = Date.now()
    const ext = file.originalname.split('.').pop()
    const fileName = `${folder}/${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Storage upload error:', error)
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Return public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  },

  /**
   * Delete file from Supabase Storage
   */
  async delete(fileUrl: string): Promise<void> {
    // Extract path from URL
    const url = new URL(fileUrl)
    const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET_NAME}/`)
    const filePath = pathParts[1]

    if (!filePath) {
      console.warn('Could not extract file path from URL:', fileUrl)
      return
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      console.error('Storage delete error:', error)
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  },

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(filePath.split('/').slice(0, -1).join('/'), {
        search: filePath.split('/').pop(),
      })

    if (error) return false
    return data.length > 0
  },
}
```

### Step 3: Update Upload Controller (Day 2-3)

```typescript
// server/src/controllers/upload.controller.ts
import { Request, Response } from 'express'
import { storageService } from '../services/storage.service'

/**
 * Upload dispatch entry image
 */
export const uploadEntryImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WebP allowed.' })
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (req.file.size > maxSize) {
      return res.status(400).json({ error: 'File too large. Maximum 5MB allowed.' })
    }

    // Upload to Supabase Storage
    const imageUrl = await storageService.upload(req.file, 'entries')

    return res.json({
      success: true,
      url: imageUrl,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return res.status(500).json({ error: 'Failed to upload image' })
  }
}

/**
 * Delete uploaded image
 */
export const deleteImage = async (req: Request, res: Response) => {
  try {
    const { url } = req.body

    if (!url) {
      return res.status(400).json({ error: 'No URL provided' })
    }

    await storageService.delete(url)

    return res.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return res.status(500).json({ error: 'Failed to delete image' })
  }
}
```

### Step 4: Add Supabase Client Dependency (Day 3)

```bash
cd server
npm install @supabase/supabase-js
```

### Step 5: Migrate Existing Images (Day 4-5)

```typescript
// server/src/scripts/migrate-storage.ts
import { firebaseDb } from '../config/database'
import { getStorage } from 'firebase-admin/storage'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrateStorage() {
  console.log('Starting storage migration...')

  // Get all dispatch records with images
  const records = await firebaseDb.get('dispatch_records')

  if (!records) {
    console.log('No records found')
    return
  }

  const recordsWithImages = Object.entries(records)
    .filter(([_, record]: [string, any]) => record.entry_image_url)
    .map(([id, record]: [string, any]) => ({
      id,
      imageUrl: record.entry_image_url,
    }))

  console.log(`Found ${recordsWithImages.length} records with images`)

  let migrated = 0
  let failed = 0

  for (const record of recordsWithImages) {
    try {
      // Skip if already Supabase URL
      if (record.imageUrl.includes('supabase.co')) {
        console.log(`  - ${record.id}: Already migrated`)
        continue
      }

      // Download from Firebase
      const response = await fetch(record.imageUrl)
      if (!response.ok) {
        console.log(`  - ${record.id}: Failed to download (${response.status})`)
        failed++
        continue
      }

      const buffer = await response.arrayBuffer()
      const ext = record.imageUrl.split('.').pop()?.split('?')[0] || 'jpg'
      const fileName = `entries/migrated-${record.id}.${ext}`

      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from('dispatch-images')
        .upload(fileName, Buffer.from(buffer), {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        })

      if (error) {
        console.log(`  - ${record.id}: Upload failed - ${error.message}`)
        failed++
        continue
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('dispatch-images')
        .getPublicUrl(data.path)

      // Update database record
      await db
        .update(dispatchRecords)
        .set({ entryImageUrl: urlData.publicUrl })
        .where(eq(dispatchRecords.id, record.id))

      console.log(`  ✓ ${record.id}: Migrated`)
      migrated++
    } catch (error) {
      console.error(`  ✗ ${record.id}: Error -`, error)
      failed++
    }
  }

  console.log(`\nMigration complete!`)
  console.log(`  Migrated: ${migrated}`)
  console.log(`  Failed: ${failed}`)
}

migrateStorage().catch(console.error)
```

### Step 6: Remove Firebase Dependencies (Day 6-7)

```typescript
// 1. Update server/src/config/database.ts
// Remove Firebase Storage initialization

// BEFORE:
// storageBucket: `${projectId}.firebasestorage.app`

// AFTER: Remove this line entirely or keep for backward compat during transition
```

```bash
# 2. Remove Firebase dependencies (after verification)
# Note: Do this ONLY after confirming all Storage is migrated

# First, check for any remaining firebase imports
grep -r "firebase-admin" server/src --include="*.ts" | grep -v node_modules

# If clean, remove:
# npm uninstall firebase-admin firebase-functions
# (Do this in Phase 6 after full validation)
```

### Step 7: Cleanup Unused Files (Day 7-8)

```bash
# Files to delete after migration

# Firebase config (keep database.ts for now, remove in Phase 6)
rm server/src/config/firestore.ts
rm server/src/config/dual-write.ts

# Firebase REST client
rm server/src/lib/firebase-rest.js

# Old migration scripts
rm server/src/scripts/migrate-rtdb-to-firestore.ts
rm server/src/scripts/rollback-firestore-to-rtdb.ts
rm server/src/scripts/migrate-old-rtdb-to-firestore.ts
rm server/src/scripts/migrate-from-old-firebase.ts

# Sheets sync (already removed in Phase 3)
# Verify these are gone:
ls server/src/services/*-sync.service.ts
ls server/src/scripts/sync-*-from-sheets.cjs
```

### Step 8: Update Environment Variables (Day 8)

```env
# .env - Final configuration

# Supabase (Primary)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# Cloudinary (Keep for other images if used)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# JWT
JWT_SECRET=...

# REMOVE or Comment out:
# RTDB_URL=... (no longer needed)
# SERVICE_ACCOUNT_PATH=... (no longer needed)
```

### Step 9: Update .env.example (Day 8)

```env
# .env.example

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/quanlybenxe

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth
JWT_SECRET=your-jwt-secret

# Cloudinary (optional - for image uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## Supabase Storage Configuration

### Bucket Structure

```
dispatch-images/
├── entries/           # Entry photos
│   ├── 2026-01/
│   └── 2026-02/
├── migrated/          # Images migrated from Firebase
└── temp/              # Temporary uploads
```

### RLS Policies

```sql
-- Policy: Allow authenticated upload
CREATE POLICY "upload_policy" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dispatch-images');

-- Policy: Allow public read
CREATE POLICY "read_policy" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dispatch-images');

-- Policy: Allow authenticated delete (own files)
CREATE POLICY "delete_policy" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'dispatch-images');
```

---

## Todo Checklist

### Storage Migration
- [ ] Create Supabase Storage bucket
- [ ] Configure RLS policies
- [ ] Install @supabase/supabase-js
- [ ] Create storage.service.ts
- [ ] Update upload.controller.ts
- [ ] Test upload functionality
- [ ] Migrate existing images
- [ ] Verify all images accessible

### Cleanup
- [ ] Remove firestore.ts
- [ ] Remove dual-write.ts
- [ ] Remove firebase-rest.js
- [ ] Remove old migration scripts
- [ ] Update environment variables
- [ ] Update .env.example
- [ ] Update README.md with new setup instructions

### Verification
- [ ] All image URLs working
- [ ] Upload/delete working
- [ ] No Firebase imports remaining (except temporary)
- [ ] CI/CD updated (if applicable)

---

## Success Criteria

1. **Storage bucket** created and configured
2. **All images** accessible from Supabase URLs
3. **Upload functionality** working
4. **No Firebase Storage** dependencies
5. **Cleanup complete** - unused files removed

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Broken image URLs | Medium | High | Keep old URLs valid during transition |
| Upload failures | Low | Medium | Test thoroughly before deploy |
| Missing files during migrate | Low | Medium | Track failed migrations |

---

## Security Considerations

1. **Service Role Key** - Only server-side, never expose to client
2. **RLS Policies** - Configured to prevent unauthorized access
3. **File Validation** - Type and size checks in upload controller
4. **Signed URLs** - Use for sensitive content (not needed for public images)

---

## Next Steps

Sau khi hoàn thành Phase 4:
1. Proceed to [Phase 5: Testing & Validation](./phase-05-testing-validation.md)
2. Run comprehensive tests
3. Performance benchmarks
