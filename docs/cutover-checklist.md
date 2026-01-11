# Cutover Checklist

## Firebase to Supabase Migration - Production Cutover

**Status**: ✅ PHASE 3 COMPLETE - ALL CONTROLLERS MIGRATED
**Migration Date**: TBD (Execute after Phase 5 Testing)
**Last Updated**: 2026-01-11

> **Phase 1 Complete:** ETL scripts created and validated
> **Phase 2 Complete:** Cache services migrated to Supabase
> **Phase 3 Complete:** All controllers migrated to Drizzle ORM
> **Next:** Phase 4 (Storage), Phase 5 (Testing), then production cutover

---

## Phase 1: ETL Scripts ✅ COMPLETE

### ETL Scripts Created
- [x] analyze-data.ts - Data quality analysis
- [x] etl-helpers.ts - Batch processing, FK validation, logging
- [x] export-firebase.ts - Export Firebase data to JSON
- [x] migrate-all.ts - Orchestrate full migration
- [x] validate-migration.ts - Post-migration validation
- [x] rollback.ts - Rollback capability
- [x] import-vehicles.ts
- [x] import-drivers.ts
- [x] import-dispatch-records.ts
- [x] import-vehicle-badges.ts
- [x] import-routes.ts
- [x] import-users.ts
- [x] import-vehicle-types.ts
- [x] import-invoices.ts

### NPM Scripts Added
- [x] `npm run etl:analyze` - Analyze exported data quality
- [x] `npm run etl:export` - Export Firebase data
- [x] `npm run etl:migrate` - Execute migration
- [x] `npm run etl:validate` - Validate migration
- [x] `npm run etl:rollback` - Rollback if needed

---

## Pre-Cutover (T-2 hours)

### Data Verification
- [ ] Final Firebase backup exported: `npm run etl:export`
- [ ] Supabase data validated: `npm run etl:validate`
- [ ] Record counts match between Firebase and Supabase
- [ ] Data consistency check passed: `npm run db:validate`

### System Verification
- [ ] All tests passing: `npm test`
- [ ] Build successful: `npm run build`
- [ ] Staging environment verified
- [ ] Smoke tests passed on staging: `npm run smoke-test`

### Team Readiness
- [ ] Team members on standby (Slack/Discord)
- [ ] Rollback procedure reviewed
- [ ] Monitoring dashboards open
- [ ] Database access credentials ready

---

## Cutover (T-0)

### Deployment
- [ ] Production environment variables updated:
  - `DATABASE_URL=postgresql://...`
  - `SUPABASE_URL=https://...`
  - `SUPABASE_SERVICE_ROLE_KEY=...`
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Run smoke tests: `npm run smoke-test -- --url=PRODUCTION_URL`

### Verification
- [ ] Health check endpoint responding: `/health`
- [ ] Login/auth working
- [ ] Dispatch list loading
- [ ] Create new dispatch test
- [ ] Image upload test (if applicable)

### Firebase
- [ ] Set Firebase rules to read-only (if keeping as backup)
- [ ] Or disconnect Firebase config

---

## Post-Cutover (T+1 hour)

### Monitoring
- [ ] Error rate < 0.1%
- [ ] Average response time < 200ms
- [ ] No 5xx errors in logs
- [ ] Database connections stable

### User Verification
- [ ] Check user reports/feedback
- [ ] Test critical user workflows
- [ ] Verify data displays correctly

---

## Post-Cutover (T+24 hours)

### Review
- [ ] Full day of operation analyzed
- [ ] Performance metrics reviewed
- [ ] Any issues documented
- [ ] User feedback addressed

### Decision
- [ ] **STABLE**: Continue with Supabase ✅
- [ ] **ISSUES**: Fix and monitor
- [ ] **CRITICAL**: Execute rollback

---

## Rollback Procedure

### Immediate Rollback (< 5 minutes)

1. Revert to previous deployment:
   ```bash
   git checkout HEAD~1
   git push -f origin main
   ```

2. Or restore Firebase config:
   ```bash
   # Update environment variables back to Firebase
   # Restart server
   ```

### Data Rollback (if data corrupted)

1. Stop all traffic
2. Export current Supabase data for analysis
3. Run: `npm run etl:rollback`
4. Deploy previous version

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Migration Lead | __________ | __________ |
| Backend Dev | __________ | __________ |
| DBA | __________ | __________ |
| Stakeholder | __________ | __________ |

---

## Sign-off

| Phase | Completed | By | Time |
|-------|-----------|-------|------|
| Pre-Cutover | [ ] | _____ | _____ |
| Cutover | [ ] | _____ | _____ |
| Post-Cutover (1h) | [ ] | _____ | _____ |
| Post-Cutover (24h) | [ ] | _____ | _____ |
| Migration Complete | [ ] | _____ | _____ |

---

## Notes

_Add any notes or issues encountered during migration:_

### Outstanding Items (Post-Phase 3)
- **Phase 4 Pending:** Storage migration (Cloudinary → Supabase Storage)
- **Phase 5 Pending:** Testing & validation infrastructure
- `data-query.service.ts` - Uses legacy Firebase RTDB, deferred to separate plan
- `firebase-rest.ts`, `base-repository.ts` - Still used by legacy repositories (deprecated)
- These do not block production deployment

### Phase 3 Completion Summary
- ✅ All core controllers migrated to Drizzle ORM
- ✅ Legacy operator data handling implemented
- ✅ Vehicle badge CRUD fully migrated
- ✅ Data aggregation queries migrated
- ✅ Fleet module controllers migrated
- ✅ Batch update utilities migrated
- ✅ No firebase.from() calls remaining in controllers

---

**Migration Status**: ⏳ Pending / ✅ Complete / ❌ Rolled Back
