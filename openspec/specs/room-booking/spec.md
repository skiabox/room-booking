# room-booking Specification

## Purpose

Provides reliable local room availability and booking for coworking-space members while preventing booking conflicts and excessive use of an individual room.

## Requirements

### Requirement: Room availability is visible
The system SHALL show the small, medium, and large meeting rooms and their booking availability for today and the current week.

#### Scenario: Member views the current week
- **WHEN** a member opens the booking page
- **THEN** the system displays each room and its booked and available time slots for today and the current week

### Requirement: Member can create a room booking
The system SHALL allow a member to enter their name and reserve one available room for a time range composed of 30-minute increments between 08:00 and 20:00.

#### Scenario: Valid booking is created
- **WHEN** a member supplies a name, selects an available room, and selects an in-hours time range aligned to 30-minute increments
- **THEN** the system records the booking and shows the selected room as unavailable for that range

#### Scenario: Booking request is outside operating hours
- **WHEN** a member attempts to reserve time before 08:00, after 20:00, or not aligned to a 30-minute increment
- **THEN** the system rejects the request and explains that bookings must use 30-minute increments from 08:00 through 20:00

### Requirement: Overlapping room bookings are prevented
The system SHALL reject a booking that overlaps an existing booking for the same room.

#### Scenario: Member requests an occupied time
- **WHEN** a member attempts to reserve a room for any time that overlaps an existing booking in that room
- **THEN** the system does not create the booking and explains that the room is unavailable

### Requirement: Daily booking limit is per room
The system SHALL limit each member to a total of two booked hours per individual room per calendar day, without counting bookings in other rooms toward that room's limit.

#### Scenario: Member reaches the daily limit for one room
- **WHEN** a member already has two booked hours in a room on a calendar day and attempts another booking in that room on that day
- **THEN** the system rejects the booking and explains the two-hour per-room daily limit

#### Scenario: Member books another room after reaching a room limit
- **WHEN** a member has two booked hours in one room on a calendar day and reserves available time in a different room on that day
- **THEN** the system permits the booking if the member's total time in that different room remains at most two hours

### Requirement: Bookings persist in the browser
The system SHALL retain created bookings in browser-local storage and restore them when the page is reopened in the same browser.

#### Scenario: Member reopens the booking page
- **WHEN** a member reopens the booking page in the same browser after a booking was created
- **THEN** the system displays the previously created booking in the relevant room and time slot
