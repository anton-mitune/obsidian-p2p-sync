## US-018: Settings & Onboarding UX

Title: Settings & Onboarding UX

Summary:
As a new user, I want a simple onboarding flow and clear settings so I can get started with secure syncing quickly.

Acceptance Criteria:
- On first install, the plugin explains features and asks to enable discovery and generate keys.
- Defaults are safe (E2EE enabled, discovery on LAN, internet sync disabled, local logging enabled).
- Advanced options are available in settings.
- Onboarding shows minimal steps to pair and perform initial sync.
- Settings are organized by category (Connection, Sync, Privacy, Logging).

High-level Tech Spec:
- JS UI with onboarding wizard; call into Rust engine to generate keys and start discovery.
- Persist onboarding completion flag; provide "Get Started" walkthrough with steps and links to docs.
- Settings panel with tabs for different configuration areas.
