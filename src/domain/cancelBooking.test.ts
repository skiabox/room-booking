import { describe, expect, it } from 'vitest';
import { createBooking } from './booking';
import type { Booking } from './booking';
import { cancelBooking } from './cancelBooking';

// 10:10 Athens (EEST) on Mon 19 Oct 2026 = slot 4.
const NOW = new Date('2026-10-19T07:10:00Z');
const mk = (id: string, over: Partial<Booking> = {}): Booking => ({
  id,
  roomId: 'small',
  date: '2026-10-20',
  startSlot: 12,
  slotCount: 2,
  name: 'Eleni K.',
  ...over,
});

describe('cancelBooking', () => {
  it('removes the owner’s Booking and keeps the rest', () => {
    const r = cancelBooking([mk('a'), mk('b', { startSlot: 2 })], 'a', 'Eleni K.', NOW);
    expect(r).toEqual({ ok: true, value: { bookings: [mk('b', { startSlot: 2 })] } });
  });

  it('matches Names via nameKey', () => {
    expect(cancelBooking([mk('a')], 'a', '  ELENI k. ', NOW).ok).toBe(true);
    expect(cancelBooking([mk('a', { name: ' eleni K.  ' })], 'a', 'Eleni K.', NOW).ok).toBe(true);
    expect(cancelBooking([mk('a', { name: 'Café' })], 'a', 'Café', NOW).ok).toBe(true);
  });

  it('refuses another Name with not_owner', () => {
    expect(cancelBooking([mk('a')], 'a', 'Ann', NOW)).toEqual({ ok: false, error: { code: 'not_owner' } });
  });

  it('refuses a blank requester Name', () => {
    expect(cancelBooking([mk('a')], 'a', '  ', NOW)).toEqual({ ok: false, error: { code: 'not_owner' } });
    expect(cancelBooking([mk('a', { name: '' })], 'a', '', NOW).ok).toBe(false);
  });

  it('refuses an unknown id with not_found', () => {
    expect(cancelBooking([mk('a')], 'zzz', 'Eleni K.', NOW)).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('checks not_found before not_owner, and not_owner before in_past', () => {
    expect(cancelBooking([], 'a', 'Ann', NOW)).toEqual({ ok: false, error: { code: 'not_found' } });
    const old = mk('a', { date: '2026-10-18' });
    expect(cancelBooking([old], 'a', 'Ann', NOW)).toEqual({ ok: false, error: { code: 'not_owner' } });
    expect(cancelBooking([old], 'a', 'Eleni K.', NOW)).toEqual({ ok: false, error: { code: 'in_past' } });
  });

  it('refuses a Booking ending exactly at now, allows one ms before', () => {
    const b = mk('a', { date: '2026-10-19', startSlot: 2, slotCount: 2 }); // ends 10:00
    const at10 = new Date('2026-10-19T07:00:00Z');
    expect(cancelBooking([b], 'a', 'Eleni K.', at10)).toEqual({ ok: false, error: { code: 'in_past' } });
    expect(cancelBooking([b], 'a', 'Eleni K.', new Date('2026-10-19T06:59:59.999Z')).ok).toBe(true);
  });

  it('cancels a Booking in progress', () => {
    expect(cancelBooking([mk('a', { date: '2026-10-19', startSlot: 3, slotCount: 2 })], 'a', 'Eleni K.', NOW).ok).toBe(true);
  });

  it('uses the Athens date at midnight', () => {
    const midnight = new Date('2026-10-18T21:00:00Z'); // 00:00 Oct 19 Athens
    const old = mk('old', { date: '2026-10-18', startSlot: 23 });
    const fresh = mk('new', { date: '2026-10-19', startSlot: 0, slotCount: 1 });
    expect(cancelBooking([old], 'old', 'Eleni K.', midnight).ok).toBe(false);
    expect(cancelBooking([fresh], 'new', 'Eleni K.', midnight).ok).toBe(true);
    // one ms earlier it is still Oct 18 in Athens
    expect(cancelBooking([fresh], 'new', 'Eleni K.', new Date('2026-10-18T20:59:59.999Z')).ok).toBe(true);
  });

  it('closing time: a last-Slot Booking ends at 20:00 Athens', () => {
    const b = mk('a', { date: '2026-10-19', startSlot: 23, slotCount: 1 });
    expect(cancelBooking([b], 'a', 'Eleni K.', new Date('2026-10-19T16:59:59.999Z')).ok).toBe(true);
    expect(cancelBooking([b], 'a', 'Eleni K.', new Date('2026-10-19T17:00:00Z'))).toEqual({
      ok: false,
      error: { code: 'in_past' },
    });
  });

  it('does not mutate the input and returns a new array', () => {
    const list = [mk('a'), mk('b')];
    const r = cancelBooking(list, 'a', 'Eleni K.', NOW);
    expect(list.map((x) => x.id)).toEqual(['a', 'b']);
    if (r.ok) expect(r.value.bookings).not.toBe(list);
  });

  it('leaves the list untouched on error (same reference semantics)', () => {
    const list = [mk('a')];
    cancelBooking(list, 'a', 'Ann', NOW);
    expect(list).toEqual([mk('a')]);
  });

  it('restores the Daily Allowance: at 2 h, cancel 1 h, book 1 h succeeds', () => {
    const list = [mk('a', { startSlot: 2, slotCount: 2 }), mk('b', { startSlot: 6, slotCount: 2 })];
    const request = mk('c', { startSlot: 10, slotCount: 2 });
    expect(createBooking(list, request, NOW).ok).toBe(false);
    const r = cancelBooking(list, 'a', 'Eleni K.', NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(createBooking(r.value.bookings, request, NOW).ok).toBe(true);
  });
});
