import { nameKey } from './name';
import type { Result } from './result';
import type { RoomId } from './rooms';
import { athensDate, athensSlotIndex, windowDates } from './time';

/** A reservation. Dates are Athens 'YYYY-MM-DD'; slots are ints 0..23; slotCount 1..4. */
export interface Booking {
  readonly id: string;
  readonly roomId: RoomId;
  readonly date: string;
  readonly startSlot: number;
  readonly slotCount: number;
  readonly name: string;
}

/** A Booking to create; the caller generates the id. */
export type BookingRequest = Booking;

export type DomainError =
  | { readonly code: 'name_required' }
  | { readonly code: 'bad_length' }
  | { readonly code: 'outside_grid' }
  | { readonly code: 'outside_window' }
  | { readonly code: 'in_past' }
  | { readonly code: 'not_found' }
  | { readonly code: 'not_owner' }
  | { readonly code: 'overlap'; readonly conflicts: readonly Booking[] }
  | { readonly code: 'allowance_exceeded'; readonly remainingMinutes: number };

export interface CreatedBooking {
  readonly bookings: readonly Booking[];
  readonly created: Booking;
}

const MAX_SLOTS = 4;
const SLOTS_PER_DAY = 24;
const DAILY_ALLOWANCE_SLOTS = 4;
const MINUTES_PER_SLOT = 30;

/**
 * Validates a request and returns a new list with the Booking appended.
 * Check order: name, length, grid, window, past, overlap, allowance. First failure wins.
 */
export function createBooking(
  bookings: readonly Booking[],
  request: BookingRequest,
  now: Date,
): Result<CreatedBooking, DomainError> {
  const name = request.name.trim();
  if (nameKey(name) === '') return fail({ code: 'name_required' });

  const { startSlot, slotCount } = request;
  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > MAX_SLOTS) {
    return fail({ code: 'bad_length' });
  }
  if (!Number.isInteger(startSlot) || startSlot < 0 || startSlot + slotCount > SLOTS_PER_DAY) {
    return fail({ code: 'outside_grid' });
  }

  if (!windowDates(now).includes(request.date)) return fail({ code: 'outside_window' });

  if (request.date === athensDate(now) && startSlot <= athensSlotIndex(now)) {
    return fail({ code: 'in_past' });
  }

  const end = startSlot + slotCount;
  const conflicts = bookings
    .filter(
      (b) =>
        b.roomId === request.roomId &&
        b.date === request.date &&
        b.startSlot < end &&
        startSlot < b.startSlot + b.slotCount,
    )
    .sort((a, b) => a.startSlot - b.startSlot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (conflicts.length > 0) return fail({ code: 'overlap', conflicts });

  const key = nameKey(name);
  const booked = bookings
    .filter(
      (b) =>
        b.date === request.date &&
        b.roomId === request.roomId &&
        nameKey(b.name) === key,
    )
    .reduce((sum, b) => sum + b.slotCount, 0);
  if (booked + slotCount > DAILY_ALLOWANCE_SLOTS) {
    const remaining = Math.max(0, DAILY_ALLOWANCE_SLOTS - booked);
    return fail({ code: 'allowance_exceeded', remainingMinutes: remaining * MINUTES_PER_SLOT });
  }

  const created: Booking = { ...request, name };
  return { ok: true, value: { bookings: [...bookings, created], created } };
}

function fail(error: DomainError): Result<never, DomainError> {
  return { ok: false, error };
}
