import { describe, expect, it } from 'vitest';
import { createBooking, type Booking, type BookingRequest } from './booking';

// 2026-07-15 13:00 Athens (EEST) -> today, current slot 10
const NOW = new Date('2026-07-15T10:00:00Z');
const TODAY = '2026-07-15';

const req = (over: Partial<BookingRequest> = {}): BookingRequest => ({
  id: 'b1',
  roomId: 'small',
  date: '2026-07-16',
  startSlot: 4,
  slotCount: 2,
  name: 'Eleni K.',
  ...over,
});

const code = (over: Partial<BookingRequest>, now: Date = NOW) => {
  const r = createBooking([], req(over), now);
  return r.ok ? 'ok' : r.error.code;
};

describe('createBooking success', () => {
  it('returns a new list with the trimmed Name, casing kept', () => {
    const existing: Booking[] = [req({ id: 'old', name: 'Someone', roomId: 'large' })];
    const snapshot = JSON.stringify(existing);
    const r = createBooking(existing, req({ name: '  Eleni K. ' }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.created).toEqual(req({ name: 'Eleni K.' }));
    expect(r.value.bookings).toEqual([existing[0], r.value.created]);
    expect(r.value.bookings).not.toBe(existing);
    expect(JSON.stringify(existing)).toBe(snapshot);
    expect(existing).toHaveLength(1);
  });
  it('does not mutate the request', () => {
    const request = req({ name: '  Eleni K. ' });
    createBooking([], request, NOW);
    expect(request.name).toBe('  Eleni K. ');
  });
});

describe('name', () => {
  it('refuses blank and whitespace-only Names', () => {
    expect(code({ name: '' })).toBe('name_required');
    expect(code({ name: '   ' })).toBe('name_required');
  });
  it('is checked before every other rule', () => {
    expect(code({ name: '   ', slotCount: 9, startSlot: -1, date: '2020-01-01' })).toBe('name_required');
  });
});

describe('length and grid', () => {
  it('refuses lengths 0 and 5', () => {
    expect(code({ slotCount: 0 })).toBe('bad_length');
    expect(code({ slotCount: 5 })).toBe('bad_length');
  });
  it('refuses non-integer lengths', () => {
    expect(code({ slotCount: 1.5 })).toBe('bad_length');
  });
  it('accepts lengths 1 and 4', () => {
    expect(code({ slotCount: 1 })).toBe('ok');
    expect(code({ slotCount: 4 })).toBe('ok');
  });
  it('refuses a negative start', () => {
    expect(code({ startSlot: -1 })).toBe('outside_grid');
  });
  it('refuses a non-integer start', () => {
    expect(code({ startSlot: 1.5 })).toBe('outside_grid');
    expect(code({ startSlot: Number.NaN })).toBe('outside_grid');
  });
  it('refuses a Booking ending after 20:00', () => {
    expect(code({ startSlot: 21, slotCount: 4 })).toBe('outside_grid');
    expect(code({ startSlot: 23, slotCount: 2 })).toBe('outside_grid');
    expect(code({ startSlot: 24, slotCount: 1 })).toBe('outside_grid');
  });
  it('accepts a Booking ending exactly at 20:00', () => {
    expect(code({ startSlot: 20, slotCount: 4 })).toBe('ok');
    expect(code({ startSlot: 23, slotCount: 1 })).toBe('ok');
  });
  it('accepts a Booking starting at 08:00', () => {
    expect(code({ startSlot: 0 })).toBe('ok');
  });
  it('reports length before grid', () => {
    expect(code({ slotCount: 5, startSlot: -1 })).toBe('bad_length');
  });
  it('is checked before window and past', () => {
    expect(code({ startSlot: -1, date: '2020-01-01' })).toBe('outside_grid');
  });
});

describe('window', () => {
  it('refuses yesterday and today+7', () => {
    expect(code({ date: '2026-07-14' })).toBe('outside_window');
    expect(code({ date: '2026-07-22' })).toBe('outside_window');
  });
  it('accepts today and today+6', () => {
    expect(code({ date: '2026-07-21' })).toBe('ok');
    expect(code({ date: TODAY, startSlot: 11 })).toBe('ok');
  });
  it('is checked before past', () => {
    expect(code({ date: '2026-07-14', startSlot: 0 })).toBe('outside_window');
  });
  it('rolls to the new Athens date at Athens midnight', () => {
    const midnight = new Date('2026-07-15T21:00:00Z'); // 2026-07-16 00:00 Athens
    expect(code({ date: '2026-07-15' }, midnight)).toBe('outside_window');
    expect(code({ date: '2026-07-22' }, midnight)).toBe('ok');
    expect(code({ date: '2026-07-23' }, midnight)).toBe('outside_window');
  });
  it('uses Athens dates across the October DST change', () => {
    const now = new Date('2026-10-23T10:00:00Z');
    expect(code({ date: '2026-10-25' }, now)).toBe('ok');
    expect(code({ date: '2026-10-29' }, now)).toBe('ok');
    expect(code({ date: '2026-10-30' }, now)).toBe('outside_window');
  });
  it('uses Athens dates across the March DST change', () => {
    const now = new Date('2026-03-27T10:00:00Z');
    expect(code({ date: '2026-03-29' }, now)).toBe('ok');
    expect(code({ date: '2026-04-03' }, now)).toBe('outside_window');
  });
});

describe('past', () => {
  it('refuses the in-progress and earlier Slots today', () => {
    expect(code({ date: TODAY, startSlot: 10, slotCount: 1 })).toBe('in_past');
    expect(code({ date: TODAY, startSlot: 0, slotCount: 1 })).toBe('in_past');
  });
  it('accepts the next Slot today', () => {
    expect(code({ date: TODAY, startSlot: 11, slotCount: 1 })).toBe('ok');
  });
  it('refuses a Booking that starts in the past even if it ends later', () => {
    expect(code({ date: TODAY, startSlot: 9, slotCount: 4 })).toBe('in_past');
  });
  it('does not treat future dates as past', () => {
    expect(code({ date: '2026-07-16', startSlot: 0 })).toBe('ok');
  });
  it('treats every Slot as past after closing', () => {
    const late = new Date('2026-07-15T17:00:00Z'); // 20:00 Athens
    expect(code({ date: TODAY, startSlot: 23, slotCount: 1 }, late)).toBe('in_past');
  });
  it('treats every Slot as future before opening', () => {
    const early = new Date('2026-07-15T04:59:00Z'); // 07:59 Athens
    expect(code({ date: TODAY, startSlot: 0, slotCount: 1 }, early)).toBe('ok');
  });
  it('moves the boundary exactly at the half hour', () => {
    const before = new Date('2026-07-15T10:29:59Z'); // 13:29:59 -> slot 10
    const after = new Date('2026-07-15T10:30:00Z'); // 13:30 -> slot 11
    expect(code({ date: TODAY, startSlot: 11, slotCount: 1 }, before)).toBe('ok');
    expect(code({ date: TODAY, startSlot: 11, slotCount: 1 }, after)).toBe('in_past');
  });
  it('uses the Athens offset on the October DST change day', () => {
    const now = new Date('2026-10-25T06:00:00Z'); // 08:00 EET, slot 0
    expect(code({ date: '2026-10-25', startSlot: 0, slotCount: 1 }, now)).toBe('in_past');
    expect(code({ date: '2026-10-25', startSlot: 1, slotCount: 1 }, now)).toBe('ok');
  });
});

describe('overlap', () => {
  const D = '2026-07-17';
  const at = (id: string, startSlot: number, slotCount: number, over: Partial<Booking> = {}): Booking =>
    req({ id, date: D, roomId: 'medium', startSlot, slotCount, name: `Other ${id}`, ...over });
  const run = (existing: Booking[], over: Partial<BookingRequest>) =>
    createBooking(existing, req({ id: 'new', date: D, roomId: 'medium', name: 'Eleni K.', ...over }), NOW);

  it('refuses a partial overlap and reports the conflict', () => {
    const a = at('a', 4, 2); // 10:00-11:00
    const r = run([a], { startSlot: 5, slotCount: 2 }); // 10:30-11:30
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toEqual({ code: 'overlap', conflicts: [a] });
  });
  it('refuses containment both ways and identical ranges', () => {
    const a = at('a', 4, 4);
    expect(run([a], { startSlot: 5, slotCount: 1 }).ok).toBe(false);
    expect(run([at('a', 5, 1)], { startSlot: 4, slotCount: 4 }).ok).toBe(false);
    expect(run([a], { startSlot: 4, slotCount: 4 }).ok).toBe(false);
  });
  it('allows back-to-back on either side', () => {
    const a = at('a', 4, 2);
    expect(run([a], { startSlot: 6, slotCount: 1 }).ok).toBe(true);
    expect(run([a], { startSlot: 3, slotCount: 1 }).ok).toBe(true);
  });
  it('allows the same times in another Room or on another day', () => {
    const a = at('a', 4, 2);
    expect(run([a], { startSlot: 4, slotCount: 2, roomId: 'large' }).ok).toBe(true);
    expect(run([a], { startSlot: 4, slotCount: 2, date: '2026-07-18' }).ok).toBe(true);
  });
  it('sorts conflicts by startSlot, ties by id', () => {
    const late = at('z', 6, 1);
    const early = at('m', 4, 2);
    const tieB = at('b', 5, 1);
    const tieA = at('a', 5, 1);
    const r = run([late, tieB, early, tieA], { startSlot: 4, slotCount: 4 });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === 'overlap') {
      expect(r.error.conflicts.map((c) => c.id)).toEqual(['m', 'a', 'b', 'z']);
    }
  });
  it('does not depend on attempt order', () => {
    const a = req({ id: 'a', date: D, roomId: 'medium', startSlot: 4, slotCount: 2, name: 'A' });
    const b = req({ id: 'b', date: D, roomId: 'medium', startSlot: 5, slotCount: 2, name: 'B' });
    const orders: [Booking, Booking][] = [[a, b], [b, a]];
    for (const [first, second] of orders) {
      const one = createBooking([], first, NOW);
      expect(one.ok).toBe(true);
      if (!one.ok) return;
      const two = createBooking(one.value.bookings, second, NOW);
      expect(two.ok ? 'ok' : two.error.code).toBe('overlap');
    }
  });
  it('is checked after past and before allowance', () => {
    const clash = req({ id: 'p', date: TODAY, roomId: 'medium', startSlot: 10, slotCount: 1, name: 'Other' });
    const past = createBooking([clash], req({ id: 'new', date: TODAY, roomId: 'medium', startSlot: 10, slotCount: 1 }), NOW);
    expect(past.ok ? 'ok' : past.error.code).toBe('in_past');
    const existing = [
      at('a', 4, 2),
      at('b', 10, 2, { name: 'Eleni K.', roomId: 'small' }),
      at('c', 12, 2, { name: 'Eleni K.', roomId: 'large' }),
    ];
    const r = run(existing, { startSlot: 4, slotCount: 1 });
    expect(r.ok ? 'ok' : r.error.code).toBe('overlap');
  });
});

describe('daily allowance', () => {
  const D = '2026-07-17';
  const mine = (id: string, startSlot: number, slotCount: number, over: Partial<Booking> = {}): Booking =>
    req({ id, date: D, roomId: 'small', startSlot, slotCount, name: 'Eleni K.', ...over });
  const run = (existing: Booking[], over: Partial<BookingRequest>) =>
    createBooking(existing, req({ id: 'new', date: D, roomId: 'medium', startSlot: 10, name: 'Eleni K.', ...over }), NOW);

  it('refuses a request over the limit with the remaining minutes', () => {
    const r = run([mine('a', 0, 3, { roomId: 'medium' })], { slotCount: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toEqual({ code: 'allowance_exceeded', remainingMinutes: 30 });
  });
  it('accepts exactly 2 hours in total', () => {
    expect(run([mine('a', 0, 3, { roomId: 'medium' })], { slotCount: 1 }).ok).toBe(true);
    expect(run([], { slotCount: 4 }).ok).toBe(true);
  });
  it('refuses one more Slot after 2 hours, with 0 minutes left', () => {
    const r = run([mine('a', 0, 4, { roomId: 'medium' })], { slotCount: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toEqual({ code: 'allowance_exceeded', remainingMinutes: 0 });
  });
  it('does not count bookings in other Rooms toward this Room allowance', () => {
    const existing = [mine('a', 0, 1), mine('b', 2, 1, { roomId: 'large' }), mine('c', 4, 1, { roomId: 'medium' })];
    const r = run(existing, { slotCount: 2 });
    expect(r.ok).toBe(true);
  });
  it('matches Names case-insensitively and ignoring surrounding spaces', () => {
    const r = run([mine('a', 0, 4, { roomId: 'medium' })], { name: '  ELENI k. ', slotCount: 1 });
    expect(r.ok ? 'ok' : r.error.code).toBe('allowance_exceeded');
  });
  it('does not count other Names', () => {
    expect(run([mine('a', 0, 4, { name: 'Someone Else' })], { slotCount: 4 }).ok).toBe(true);
  });
  it('counts per day only', () => {
    expect(run([mine('a', 0, 4, { date: '2026-07-18' })], { slotCount: 4 }).ok).toBe(true);
  });
  it('counts finished Bookings earlier today', () => {
    const past = mine('a', 0, 4, { date: TODAY, roomId: 'medium' });
    const r = run([past], { date: TODAY, startSlot: 12, slotCount: 1 });
    expect(r.ok ? 'ok' : r.error.code).toBe('allowance_exceeded');
  });
  it('reports in_past before allowance when both fail', () => {
    const full = mine('a', 0, 4, { date: TODAY, roomId: 'medium' });
    const r = run([full], { date: TODAY, startSlot: 10, slotCount: 1 });
    expect(r.ok ? 'ok' : r.error.code).toBe('in_past');
  });
  it('never reports negative remaining minutes', () => {
    const r = run([mine('a', 0, 3, { roomId: 'medium' }), mine('b', 4, 3, { roomId: 'medium' })], { slotCount: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toEqual({ code: 'allowance_exceeded', remainingMinutes: 0 });
  });
  it('reports overlap before allowance when both fail', () => {
    const existing = [mine('a', 0, 4, { roomId: 'medium', startSlot: 10 })];
    const r = run(existing, { startSlot: 11, slotCount: 1 });
    expect(r.ok ? 'ok' : r.error.code).toBe('overlap');
  });
  it('does not mutate the input list', () => {
    const existing = [mine('a', 0, 4), mine('b', 10, 1, { roomId: 'medium' })];
    const snapshot = JSON.stringify(existing);
    run(existing, { startSlot: 10, slotCount: 1 });
    expect(JSON.stringify(existing)).toBe(snapshot);
  });
});
