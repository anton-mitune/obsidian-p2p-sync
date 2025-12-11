## US-010: Status, Logs, and Notifications

Title: Status, Logs, and Notifications

Summary:
As a user, I want transparent status and logs so I can understand the plugin's activity and diagnose issues.

Acceptance Criteria:
- Plugin status indicator shows overall state (Idle, Syncing, Conflict, Error).
- Recent sync logs are viewable with timestamps, events, and brief messages.
- Important notifications (conflicts, pairing requests, transfer failures) appear in Obsidian UI.
- Logs are persisted locally and configurable in plugin settings (log level, retention).

High-level Tech Spec:
- JS UI components inside Obsidian show status and logs; subscribe to engine events.
- Keep a rotating in-memory log and persist recent events to local storage for audit.
- Use Obsidian's notification API for urgent messages.
- Expose log settings in plugin configuration (verbosity, clear logs action).
