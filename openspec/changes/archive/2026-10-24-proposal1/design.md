# Design

## Context

This is a static React and TypeScript application with no backend. See `proposal.md` for the motivation. Booking behavior must be testable independently of the interface, operate on a phone, and retain data only in the current browser.

## Goals / Non-Goals

**Goals:**

- Represent the three fixed meeting rooms and their attributes.
- Show a week-oriented availability view that works on narrow screens.
- Validate time ranges, room conflicts, and the two-hour per-member, per-room, per-day limit before persistence.
- Preserve bookings across reloads in the same browser.

**Non-Goals:**

- Authentication, cross-device sharing, server-side storage, recurring bookings, room displays, cancellation, and editing bookings.

## Decisions

### Keep booking rules in a framework-independent domain module

Use typed booking and room models plus pure functions to validate a proposed booking against existing bookings. The quota calculation will group bookings by member name, room identifier, and local calendar date, then reject only if the proposed booking would make that group's total duration exceed two hours.

This keeps the per-room limit explicit and unit-testable. Putting validation only in form components was considered, but would duplicate logic and make edge cases difficult to test.

### Use fixed room configuration and half-hour time values

Define the small (4 seats), medium (8 seats), and large (14 seats, projector) rooms as static client-side configuration. Store booking dates and start/end times in a consistent local-date representation; generate selectable slots from 08:00 through 20:00 in 30-minute steps.

Static configuration fits the fixed room inventory. A configurable room-management interface was considered but is outside this change.

### Persist one versioned booking collection in localStorage

Read bookings from a dedicated localStorage key when the application starts and write the validated collection after a new booking is added. Treat malformed or unknown stored data as empty data rather than allowing it to break the booking page.

localStorage satisfies the client-only requirement and needs no runtime dependency. A remote service or browser database was considered but would introduce infrastructure or complexity beyond the product scope.

### Build availability from bookings rather than persisting slots

The UI will derive a room's occupied and available time ranges for the displayed week from the booking collection. The booking form will expose only valid, unoccupied time choices and still validate on submit.

Derived availability avoids duplicated state. Persisting independent slot state was considered but could drift from booking records.

## Risks / Trade-offs

- [Names are not authenticated, so another person can reuse a name] → Display the entered name as the booking owner and accept this limitation until authentication is in scope.
- [Browser-local data is not shared across devices or browsers] → Keep the limitation explicit in the UI and defer shared storage to a future change.
- [Local dates and daylight-saving changes can make date/time handling error-prone] → Use explicit local calendar dates and 30-minute time strings, with domain tests around day boundaries and operating hours.
- [Existing localStorage values could be malformed] → Validate parsed values and fall back safely to an empty collection.

## Migration Plan

No deployed data migration is required. New installations begin with no bookings. If a prior booking key exists during development, invalid data is ignored rather than migrated.
