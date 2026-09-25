# Production readiness roadmap

Complete these items in order. Do not launch publicly until every item in the
final launch gate is complete.

## 1. Product and legal boundaries

- [ ] Define the initial product as private carpool coordination for trusted
  groups, not a public transportation marketplace.
- [ ] Confirm the supported countries, age policy, group types, and whether
  minors may be represented by adult-managed participant profiles.
- [ ] Decide the launch limits for participants, groups, imports, vehicles, and
  automatically optimized rides.
- [ ] Obtain attorney-reviewed Terms of Service, Privacy Policy, consent
  language, acceptable-use policy, retention policy, and incident contact
  process.
- [ ] Document that the About-page notice supplements but does not replace the
  formal legal documents.

**Exit gate:** the product boundary and launch jurisdictions are written down,
and qualified counsel has approved the required user-facing policies.

## 2. Isolated infrastructure

- [ ] Create separate Supabase projects for development, staging, and
  production.
- [ ] Create separate Vercel projects for development previews, staging, and
  production.
- [ ] Give each environment unique credentials, domains, quotas, email
  configuration, mapping-provider keys, and push keys.
- [ ] Restrict production access and document who can read secrets or customer
  data.
- [ ] Add environment validation that fails startup when required values are
  missing or point at an unexpected project.

**Exit gate:** no Carpool Together environment shares credentials, storage, or
database resources with another application.

## 3. Database model and invariants

- [ ] Review and apply the initial schema only to the Carpool Together
  development project.
- [ ] Add invitations with intended recipient, role, expiry, revocation, and
  single-use token handling.
- [ ] Add versioned consent records for transportation, location processing,
  photographs, and guardian authority.
- [ ] Add import batches, source identifiers, row outcomes, idempotency keys,
  and safe undo metadata.
- [ ] Add event recurrence, occurrence overrides, cancellations, plan
  revisions, ordered trip stops, and driver acceptance history.
- [ ] Add audit events, notification preferences, outbox jobs, delivery
  attempts, and retention timestamps.
- [ ] Enforce one active rider assignment per event leg.
- [ ] Enforce passenger capacity and stale-revision checks transactionally.
- [ ] Prevent cross-group foreign-key references with composite constraints.
- [ ] Prevent a group from becoming ownerless.

**Exit gate:** database tests prove that duplicate assignments, over-capacity
trips, stale acceptance, and cross-group references fail atomically.

## 4. Authentication and tenant authorization

- [ ] Implement verified Supabase Auth sign-in and sign-out.
- [ ] Add account recovery, account deletion, and session revocation.
- [ ] Implement global profiles and many-to-many group memberships.
- [ ] Implement self-service private group creation with one initial owner.
- [ ] Implement contact-bound invitations and explicit participant-management
  grants.
- [ ] Define and enforce owner, admin, coordinator, and member permissions.
- [ ] Complete Row Level Security policies for every read and write operation.
- [ ] Ensure membership removal immediately revokes future access.
- [ ] Add automated direct-database tests for cross-group isolation.
- [ ] Add private Storage policies for logos and participant images.

**Exit gate:** one user can switch between two groups, and API, database,
Storage, and realtime tests prove that neither group can access the other.

## 5. Server data-access layer

- [ ] Create server-only modules for identity, groups, participants, events,
  carpools, imports, media, and notifications.
- [ ] Authorize every operation by authenticated user, requested group, role,
  and participant-management grant.
- [ ] Return minimal data-transfer objects instead of raw database rows.
- [ ] Validate all external input and produce explicit typed errors.
- [ ] Require idempotency keys for retryable commands.
- [ ] Return conflict responses for stale revisions.
- [ ] Use the service-role credential only in narrowly scoped background or
  administrative operations.
- [ ] Mark private responses as non-cacheable.

**Exit gate:** the client has no direct privileged database path, and every
server operation has authorization and error-path tests.

## 6. Persisted groups and roster

- [ ] Replace fictional group data with persisted groups and memberships.
- [ ] Persist group name, timezone, constrained accessible colors, logo, and
  icon.
- [ ] Persist participants separately from authenticated accounts.
- [ ] Implement self, guardian, and delegate management grants.
- [ ] Support multiple participant pickup associations and per-ride overrides.
- [ ] Provide meeting-point alternatives to home addresses.
- [ ] Add explicit empty, loading, error, revoked-access, and stale-data states.
- [ ] Clear old group state and subscriptions immediately when switching groups.

**Exit gate:** authenticated users can create, configure, leave, and switch
groups without private data leaking into another group or offline cache.

## 7. Privacy, consent, and media

- [ ] Capture versioned consent before processing precise locations or photos.
- [ ] Limit exact pickup visibility to authorized managers and assigned drivers
  during a defined operational window.
- [ ] Add consent withdrawal and participant-management dispute handling.
- [ ] Validate media content, size, and dimensions.
- [ ] Re-encode uploaded images and remove EXIF and location metadata.
- [ ] Store media privately and serve it through authorized short-lived access.
- [ ] Implement user data export, participant removal, group deletion, and
  retention jobs.
- [ ] Ensure logs, analytics, notifications, and offline caches exclude
  addresses, contact lists, and invitation tokens.

**Exit gate:** privacy tests cover consent, revocation, media access, retention,
export, and deletion.

## 8. Roster import

- [ ] Add CSV upload and pasted-spreadsheet input.
- [ ] Add column mapping, preview, row selection, and validation.
- [ ] Escape exports and previews against spreadsheet-formula injection.
- [ ] Detect possible duplicates without automatically merging by name or
  address.
- [ ] Support source-system IDs and idempotent repeat imports.
- [ ] Preserve user-confirmed data during re-import.
- [ ] Keep invitations separate from participant creation.
- [ ] Delete raw import files after the documented retention period.
- [ ] Provide created, skipped, conflicted, and failed row summaries.

**Exit gate:** repeating the same import creates no duplicates, sends no
unsolicited invitations, and can safely undo untouched imported records.

## 9. Events and attendance

- [ ] Implement one-off events with zero, one, or two transportation legs.
- [ ] Implement weekly recurrence using local wall-clock time and an IANA
  timezone.
- [ ] Materialize stable event instances over a rolling planning horizon.
- [ ] Support edits to one occurrence or this-and-following occurrences.
- [ ] Preserve exceptions, assignments, and historical records during edits.
- [ ] Keep attendance separate from needing transportation.
- [ ] Add standing attendance and ride preferences as explicit opt-ins.
- [ ] Add absence ranges, event-specific overrides, and cancellations.
- [ ] Test daylight-saving transitions and ambiguous local times.

**Exit gate:** recurrence and exception tests pass across supported timezones,
including daylight-saving changes.

## 10. Manual multi-vehicle carpools

- [ ] Add approved driver profiles and authenticated driver accountability.
- [ ] Add vehicles with usable passenger capacity and suitability information.
- [ ] Add per-leg driver offers and rider requests.
- [ ] Count every transported participant against capacity.
- [ ] Support multiple vehicles and individual rider assignments per leg.
- [ ] Support ordered pickup stops and navigation-provider handoff.
- [ ] Require drivers to accept the exact trip revision.
- [ ] Require reconfirmation after material changes.
- [ ] Detect overlapping driver commitments across groups without revealing
  another group’s details.
- [ ] Preserve manual operation when automated suggestions are unavailable.

**Exit gate:** a group can coordinate a complete event manually, and concurrent
actions cannot overfill a vehicle or double-book a driver.

## 11. Carpool suggestions

- [ ] Define hard constraints for seats, approved drivers, equipment, timing,
  participant permissions, and maximum journey limits.
- [ ] Add configurable driver detour and rider journey limits.
- [ ] Integrate an authorized geocoding provider behind an adapter.
- [ ] Integrate a directed road-time matrix provider behind an adapter.
- [ ] Require user confirmation of geocoded pickup points.
- [ ] Replace the straight-line demonstration heuristic with a deterministic
  constrained assignment algorithm.
- [ ] Maximize covered requests before optimizing distance and fairness.
- [ ] Preserve locked and accepted trips during recalculation.
- [ ] Explain every unassigned request and important planning assumption.
- [ ] Add provider timeout, quota, cost, and failure fallbacks.
- [ ] Require coordinator review and driver acceptance before marking rides
  covered.

**Exit gate:** constraint, determinism, fairness, provider-failure, and
concurrency tests pass against representative group sizes.

## 12. Notifications and background processing

- [ ] Implement a transactional outbox.
- [ ] Add per-user, per-group notification preferences.
- [ ] Send invitations through verified email delivery.
- [ ] Add opt-in push subscriptions owned by the global user.
- [ ] Batch routine updates and promptly process urgent cancellations.
- [ ] Use authenticated group-qualified deep links.
- [ ] Keep lock-screen text generic and free of private details.
- [ ] Add retry leases, bounded attempts, idempotency, and dead-letter
  visibility.
- [ ] Run jobs through secured scheduled workers.

**Exit gate:** delivery, retry, duplicate-processing, expired-subscription, and
urgent-cancellation tests pass.

## 13. Security hardening

- [ ] Add CSRF or strict origin protection to authenticated mutations.
- [ ] Add rate limits for sign-in, group creation, invitations, imports,
  geocoding, suggestions, and uploads.
- [ ] Add Content Security Policy and other secure response headers.
- [ ] Add dependency, secret, and static security scanning in CI.
- [ ] Threat-model invitations, guardian grants, location disclosure, uploads,
  service credentials, and background workers.
- [ ] Complete an independent security review.
- [ ] Resolve all critical and high-severity findings before launch.

**Exit gate:** the approved threat model and security review have no unresolved
critical or high-severity findings.

## 14. Quality and accessibility

- [ ] Add unit tests for matching, recurrence, permissions, retention, and
  import rules.
- [ ] Add integration tests against disposable Supabase projects.
- [ ] Add API contract and error-path tests.
- [ ] Add Chromium and WebKit end-to-end tests for primary mobile flows.
- [ ] Add automated accessibility checks and manual keyboard and screen-reader
  review.
- [ ] Test slow networks, offline transitions, expired sessions, and revoked
  membership.
- [ ] Load-test configured launch limits and matrix-provider batching.
- [ ] Test installed-app navigation and push behavior on real iOS and Android
  devices.

**Exit gate:** required CI checks pass consistently and no known severity-one
accessibility issue remains.

## 15. Operations and recovery

- [ ] Add redacted structured logs, request IDs, job IDs, and audit correlation.
- [ ] Track authorization failures, queue delay, notification failures,
  unmatched reasons, suggestion acceptance, and provider costs.
- [ ] Configure alerts for elevated failures, stalled jobs, quota usage, and
  backup problems.
- [ ] Enable managed backups and point-in-time recovery.
- [ ] Define recovery-point and recovery-time objectives.
- [ ] Complete and document a restore drill.
- [ ] Create support, privacy-request, incident-response, and provider-outage
  runbooks.
- [ ] Assign owners for infrastructure, support, privacy, and security.

**Exit gate:** the team can detect an incident, restore service and data, and
process a privacy request using tested runbooks.

## 16. CI/CD and release controls

- [ ] Require typecheck, unit tests, lint, production build, database tests,
  end-to-end tests, and security scans before merge.
- [ ] Validate migrations against a fresh database and an upgraded staging
  database.
- [ ] Add preview deployments for pull requests.
- [ ] Protect the production environment and require explicit approval.
- [ ] Document database and application rollback procedures.
- [ ] Automate dependency updates with controlled review.
- [ ] Verify that development and staging secrets cannot reach production.

**Exit gate:** a release can be promoted, observed, and rolled back without
manual database improvisation.

## 17. Pilot and launch

- [ ] Run the complete workflow with synthetic data.
- [ ] Run a small, adult-led private pilot with explicit consent.
- [ ] Measure onboarding completion, import conflicts, uncovered rides, driver
  acceptance, suggestion edits, notification delivery, and support volume.
- [ ] Resolve pilot findings and rerun affected acceptance tests.
- [ ] Verify legal, privacy, security, accessibility, and operational sign-off.
- [ ] Verify tenant isolation and restore tests immediately before launch.
- [ ] Publish support and privacy contact information.
- [ ] Enable conservative quotas and expand group creation gradually.

**Final launch gate:** all prior exit gates are complete, production recovery is
proven, and named owners approve legal, security, privacy, operations, and
product readiness.
