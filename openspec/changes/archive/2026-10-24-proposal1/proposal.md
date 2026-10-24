# Proposal

## Why

Coworking-space members need a simple, mobile-friendly way to reserve meeting rooms without double bookings. The existing two-hour daily booking limit is too restrictive because time booked in one room incorrectly prevents a member from reserving a different room later that day.

## What Changes

- Provide a client-side meeting-room booking page that shows room availability for today and the current week.
- Allow members to create bookings in 30-minute increments between 08:00 and 20:00 by entering their name, without authentication.
- Prevent overlapping bookings for the same room.
- Enforce a two-hour daily limit separately for each member and each room, rather than across all rooms.
- Persist bookings locally in the browser.

## Capabilities

### New Capabilities

- `room-booking`: Display meeting-room availability and create validated room bookings, including conflict prevention and per-room daily booking limits.

### Modified Capabilities

- None.

## Impact

- Affects the React user interface, booking domain rules, and browser `localStorage` persistence.
- Adds no backend, authentication system, external API, or runtime dependency.
