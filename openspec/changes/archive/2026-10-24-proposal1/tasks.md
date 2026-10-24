# Tasks

## 1. Booking domain rules

- [x] 1.1 Define typed fixed-room configuration for the small, medium, and large rooms, and verify unit tests cover their capacities and projector attribute.
- [x] 1.2 Implement framework-independent booking models and validation for member names, local dates, 30-minute increments, and the 08:00-20:00 operating window; verify unit tests cover valid and invalid boundaries.
- [x] 1.3 Implement room-conflict detection and verify unit tests reject overlapping ranges while permitting adjacent ranges and bookings in different rooms.
- [x] 1.4 Implement the two-hour daily limit grouped by member, room, and calendar day; verify unit tests reject a third hour in one room while permitting up to two hours in another room on the same day.

## 2. Browser persistence

- [x] 2.1 Add a versioned localStorage booking repository that restores and saves validated bookings, and verify repository tests cover round trips and malformed stored data.

## 3. Booking interface

- [x] 3.1 Build a mobile-responsive availability view for today and the current week using derived room bookings, and verify component tests render occupied and available time ranges for all rooms.
- [x] 3.2 Build the name, room, date, and time-range booking flow; connect it to domain validation and persistence; verify component tests show successful bookings and each validation error.
- [x] 3.3 Present room capacity and projector information where members choose a room, and verify the interface remains usable at a phone-sized viewport.

## 4. Integration verification

- [x] 4.1 Run `npm run verify` and manually confirm that a booking survives a page reload, double booking is blocked, and two hours in one room does not block an eligible booking in another room.
