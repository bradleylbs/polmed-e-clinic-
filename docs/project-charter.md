# Palmed Clinic ERP Project Charter

## 1. Project Overview
- **Project Name:** Palmed Clinic ERP Modernisation
- **Sponsor:** Palmed Clinic Executive Steering Committee (awaiting formal sign-off)
- **Project Manager:** To be confirmed by Palmed Clinic PMO
- **Prepared By:** Delivery Team (October 16, 2025)
- **Version:** 0.9 (working draft pending stakeholder validation)
- **Current State Snapshot:** Proof-of-concept backend and frontend modules exist, but end-to-end journeys, offline reconciliation, and compliance controls are still under construction. No production deployment is in place yet.

## 2. Background and Business Need
Palmed Clinic operations are expanding into mobile and satellite locations, creating pressure on clinical workflows, member engagement, and Medscheme reporting. The existing tooling is fragmented across spreadsheets, standalone desktop apps, and manual email workflows, leading to inconsistencies, compliance risks, and limited visibility into patient care. The Palmed Clinic ERP initiative aims to deliver a unified, offline-capable platform that integrates clinical, administrative, and reporting processes while meeting POPIA and Medscheme obligations.

**Reality Check (October 2025):** The initiative is still in a build-and-validate phase. Several modules (patient portal, sync endpoints, Medscheme integrations) are only partially implemented or pending rewrite. Formal business case approval is in progress and budgets have not been locked. This charter reflects planned intent, not completed work.

## 3. Project Purpose and Objectives
- Provide a mobile-first ERP that supports online and offline clinical encounters.
- Deliver secure patient and staff portals with role-based access control.
- Automate reporting and data exchange with Medscheme and chronic care partners.
- Strengthen compliance with POPIA, HPCSA, and Medscheme accreditation standards.
- Reduce manual reconciliations by digitising inventory, appointments, billing, and referrals.

**Status:** Objectives remain aspirational. Current prototypes cover authentication, partial patient portal wiring, and preliminary clinical workflow components. Offline sync, Medscheme integrations, and comprehensive compliance controls are still outstanding.

## 4. Scope Definition
### In Scope
- Backend API (Flask) covering authentication, patient portal functions, clinical workflow, inventory, sync, and reporting (currently incomplete with several endpoints flagged for rewrite).
- Next.js frontend for staff operations, patient portal access, and offline features (UI shells exist; data flows are still being stabilised).
- Offline data capture: IndexedDB persistence, sync queue, service worker, and conflict handling (client libraries drafted; server reconciliation pending redesign).
- Azure deployment pipelines (Static Web Apps, App Service/Container, Azure MySQL) – YAML definitions exist but have not achieved a successful production deployment.
- Integration touchpoints: Medscheme alerting, chronic disease programme logging, document management (mostly placeholders and database scaffolding).
- Security hardening: JWT rotation, device registration, audit logging, vulnerability scanning (policies drafted; implementation in progress).

### Out of Scope (Initial Release)
- Full Medscheme API transport (stubbed until credentials available).
- SMS/Email campaign automation outside clinical notifications.
- Native mobile apps (focus remains PWA responsive experience).
- Integration with third-party billing clearing houses beyond Medscheme requirements.

## 5. Deliverables
1. **Backend Services:** Hardened Flask API with documented endpoints, unit/integration tests, and observability hooks. *(Current status: APIs exist but lack full coverage, tests, and monitoring.)*
2. **Frontend Applications:** Staff console, patient portal, and offline manager components with UX sign-off. *(Current status: Components under active development; UX review outstanding.)*
3. **Data Layer:** Azure MySQL schema (79+ tables) with migration scripts and seed data packs. *(Current status: Schemas generated; data quality and migration rehearsal pending.)*
4. **Offline Runtime:** IndexedDB stores, service worker, background sync, conflict resolution workflow. *(Current status: Client-side queue implemented; server-side reconciliation and conflict handling incomplete.)*
5. **Security & Compliance Package:** Policies for role-based access, audit trails, POPIA consent flows, and encryption guidance. *(Current status: Policies drafted; technical enforcement and audits outstanding.)*
6. **Deployment Assets:** Azure DevOps pipelines, infrastructure configuration, runbooks, and rollback procedures. *(Current status: Pipelines configured but not fully validated end-to-end.)*
7. **Documentation:** Technical architecture, API reference, SOPs for clinic staff, training materials, and support playbooks. *(Current status: Draft documentation in progress; comprehensive SOPs not yet delivered.)*

## 6. Success Criteria and KPIs
- 95% of clinical encounters completed end-to-end within the ERP without fallback to paper.
- <2% sync failure rate during network constrained operations (tracked via sync_status table).
- Reduction of manual Medscheme reconciliation time by 60% compared to 2024 baseline.
- Zero critical security findings in independent penetration testing prior to go-live.
- Staff satisfaction score of at least 4.2/5 in pilot user surveys.
- SLA: 99.5% uptime target for hosted services with documented incident response.

**Honesty Note:** These KPIs are targets only. Baseline metrics, measurement tooling, and validation plans still need definition. Current builds do not yet demonstrate performance or reliability anywhere near these thresholds.

## 7. Stakeholders
- **Executive Sponsor:** Palmed Clinic COO
- **Steering Committee:** Finance Director, Clinical Lead, IT Manager, Medscheme Liaison
- **Product Owner:** Clinical Operations Lead
- **Technical Teams:**
  - Backend Engineering (Python/Flask)
  - Frontend Engineering (React/Next.js)
  - DevOps & Infrastructure (Azure)
  - QA & Compliance (Manual/Automated Testing, POPIA Officer)
- **External Stakeholders:** Medscheme Chronic Disease Team, Mobile Clinic Partners, CSI Programme Liaisons.

## 8. Milestones and Timeline
| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| M1: Discovery & Requirements Lock | Nov 1, 2025 | Finalise detailed requirements, data mapping, integration scope. *(At risk: requirements documents still evolving.)* |
| M2: Core Platform Alpha | Dec 15, 2025 | Backend APIs, staff dashboard, basic patient portal, initial offline sync. *(At risk: backend sync rewrite pending, QA capacity constrained.)* |
| M3: Beta Pilot (Mobile Clinics) | Jan 31, 2026 | Field pilot with offline workflows, Medscheme logging, security testing. *(Dependent on resolving sync and Medscheme integrations.)* |
| M4: Compliance & Integration Hardening | Mar 15, 2026 | POPIA audits, Medscheme certification, incident response rehearsals. *(Requires earlier milestones to land on time.)* |
| M5: Production Launch | Apr 30, 2026 | Go-live with phased clinic rollout, training, support desk ready. *(Contingent on stakeholder approval and successful pilot.)* |
| M6: Post Go-Live Optimisation | Jun 30, 2026 | KPI review, backlog prioritisation, integration expansion planning. |

## 9. Budget and Resources
- **Estimated Budget Envelope:** R8.5M over 18 months (licensing, development, testing, training, support). *Budget is indicative and yet to be approved by finance.*
- **Resource Allocation:**
  - 4 FTE backend engineers, 3 FTE frontend engineers, 2 FTE DevOps, 2 QA analysts, 1 Security/Compliance officer, 1 Project Manager. *Only half of these roles are currently staffed; recruitment/contracting is underway.*
  - Contingency fund (15%) earmarked for integration changes and infrastructure scaling.
- **Funding Source:** Palmed Clinic capital budget with Medscheme co-funding for chronic programme features. *Funding agreements pending.*

## 10. Risks and Mitigations
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Delayed Medscheme API credentials | High | Medium | Maintain mock services, escalate via sponsor, design abstraction for late binding. |
| Offline sync conflicts causing data integrity issues | High | Medium | Implement server-side validation, conflict dashboards, pilot stress testing. *(Current reality: sync endpoints require rewrite; offline conflict handling not yet implemented.)* |
| Regulatory non-compliance (POPIA/HPCSA) | High | Low | Continuous compliance reviews, data minimisation, legal sign-off, audit logging. |
| Infrastructure outages in remote clinics | Medium | High | Enhance offline-first design, local data caching, sync retry strategies, support hotline. |
| Scope creep from CSI initiatives | Medium | Medium | Enforce change control, maintain product backlog, time-box discovery. |
| Talent attrition | Medium | Low | Cross-train team, maintain documentation, align with HR retention plans. |

## 11. Assumptions and Constraints
- Medscheme provides API documentation and credentials at least 60 days before production go-live. *Currently unconfirmed.*
- Azure subscription, resource groups, and security policies remain consistent with current environment baselines.
- Clinics will adopt recommended hardware (tablets/laptops) capable of running the PWA offline-first experience.
- POPIA consent workflows will be co-designed with legal and approved before patient portal launch. *Legal engagement pending.*
- Third-party integrations beyond Medscheme require separate change requests and budget approvals.
- Dedicated change champions will be available within each clinic region to drive adoption. *Not yet appointed.*

## 12. Governance Structure
- **Steering Committee Meetings:** Monthly; chaired by Executive Sponsor.
- **Project Board:** Weekly status, risk review, and decision log maintained in Azure DevOps.
- **Change Control Board:** PM, Product Owner, and Technical Lead approve scope/budget changes.
- **Reporting:** Bi-weekly progress reports, KPI dashboards, security posture updates.
- **Quality Gates:** Code reviews, automated test suites, security scans, UAT sign-offs per milestone.

## 13. Communication Plan
- Weekly project update email to stakeholders.
- Bi-weekly show-and-tell demos for end-user feedback.
- Dedicated Teams channel for cross-functional collaboration and incident triage.
- Knowledge base updates in Confluence/SharePoint for SOPs and training materials.

## 14. Approval Signatures
- **Executive Sponsor:** ________________________ Date: ___________
- **Project Manager:** _________________________ Date: ___________
- **Product Owner:** __________________________ Date: ___________
- **IT Security Lead:** ________________________ Date: ___________

> *This working draft has not yet been approved. Signatures should only be collected once scope, funding, and timelines are validated.*

---
*This charter establishes the mandate and governance framework for the Palmed Clinic ERP project. Updates require steering committee approval and a tracked revision history.*
