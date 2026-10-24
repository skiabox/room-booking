import type { DomainError } from './domain/booking';
import { slotLabel } from './domain/time';
import type { StorageError } from './storage/useBookings';

const range = (startSlot: number, slotCount: number): string =>
  `${slotLabel(startSlot)}-${slotLabel(startSlot + slotCount)}`;

/** Plain-language message for every refusal. The only place such strings live. */
export function refusalMessage(error: DomainError | StorageError): string {
  switch (error.code) {
    case 'name_required':
      return 'Please enter your name.';
    case 'bad_length':
      return 'A booking must last between 30 minutes and 2 hours.';
    case 'outside_grid':
      return 'Bookings must fall on 30-minute steps between 08:00 and 20:00.';
    case 'outside_window':
      return 'You can only book from today up to 6 days ahead.';
    case 'in_past':
      return 'That time has already started, so it can no longer be booked or cancelled.';
    case 'not_found':
      return 'That booking no longer exists.';
    case 'not_owner':
      return 'Only the person who made this booking can cancel it.';
    case 'overlap': {
      const who = error.conflicts
        .map((b) => `${range(b.startSlot, b.slotCount)} by ${b.name}`)
        .join(', ');
      return `That room is already booked ${who}. Pick another time or room.`;
    }
    case 'allowance_exceeded':
      return error.remainingMinutes > 0
        ? `That is over your 2-hour daily limit for this room. You have ${error.remainingMinutes} minutes left in this room today.`
        : 'You have used your 2-hour daily limit for this room. You have 0 minutes left in this room today.';
    case 'storage_unavailable':
      return 'Could not save the change on this device. Check that browser storage is enabled.';
  }
}
