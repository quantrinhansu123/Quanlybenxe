# Cutover Checklist

## Firebase to Supabase Migration - Production Cutover

**Migration Date**: _____________
**Migration Lead**: _____________
**Rollback Contact**: _____________

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

---

**Migration Status**: ⏳ Pending / ✅ Complete / ❌ Rolled Back
