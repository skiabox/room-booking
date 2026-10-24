import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useBookings } from './storage/useBookings';
import type { Booking } from './domain/booking';

// 10:10 Athens (EEST, UTC+3) on Mon 19 Oct 2026.
const NOW = new Date('2026-10-19T07:10:00Z');

const slotsOf = (room: string) =>
  within(screen.getByRole('region', { name: room })).getAllByRole('listitem');

function Harness() {
  const { bookings, currentName, book, cancel, setName } = useBookings();
  return (
    <App now={NOW} bookings={bookings} currentName={currentName} book={book} cancel={cancel} setName={setName} />
  );
}

const DAY = '2026-10-20';
const seed = (...bs: Omit<Booking, 'id'>[]) =>
  localStorage.setItem(
    'room-booking:v1',
    JSON.stringify({ version: 1, bookings: bs.map((b, i) => ({ ...b, id: `s${i}` })) }),
  );
const open = (room: string, time: string) => {
  fireEvent.change(screen.getByRole('combobox', { name: /day/i }), { target: { value: DAY } });
  fireEvent.click(screen.getByRole('button', { name: `Book ${room} ${time}` }));
};
const form = () => within(screen.getByRole('form', { name: 'Book a room' }));
const confirm = () => fireEvent.click(form().getByRole('button', { name: 'Confirm booking' }));

describe('booking form', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('states that Bookings are stored only on this device', () => {
    render(<Harness />);
    expect(screen.getByText(/stored only on this device/i)).toBeDefined();
  });

  it('does not offer booked or past Slots as buttons', () => {
    seed({ roomId: 'small', date: '2026-10-19', startSlot: 6, slotCount: 1, name: 'Ann' });
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Book Small 08:00' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Book Small 11:00' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Book Small 10:30' })).toBeDefined();
  });

  it('opens with Room, day, start, 30 min default and prefilled Name', () => {
    localStorage.setItem('room-booking:name', 'Ann');
    render(<Harness />);
    open('Medium', '14:00');
    expect(form().getByText('Medium')).toBeDefined();
    expect(form().getByText('Tue 20 Oct')).toBeDefined();
    expect(form().getByText('14:00')).toBeDefined();
    expect((form().getByLabelText('End') as HTMLSelectElement).value).toBe('1');
    expect(form().getAllByRole('option').map((o) => o.textContent)).toEqual([
      '14:30', '15:00', '15:30', '16:00',
    ]);
    expect((form().getByLabelText('Name') as HTMLInputElement).value).toBe('Ann');
  });

  it('limits the end time to the 20:00 close', () => {
    render(<Harness />);
    open('Small', '19:00');
    expect(form().getAllByRole('option').map((o) => o.textContent)).toEqual(['19:30', '20:00']);
  });

  it('books, confirms, remembers the Name and closes the form', () => {
    render(<Harness />);
    open('Large', '14:00');
    fireEvent.change(form().getByLabelText('End'), { target: { value: '2' } });
    fireEvent.change(form().getByLabelText('Name'), { target: { value: ' Ann ' } });
    confirm();
    expect(screen.queryByRole('form', { name: 'Book a room' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Booked Large, Tue 20 Oct, 14:00-15:00');
    expect(slotsOf('Large')[12]?.textContent).toContain('Booked: Ann');
    expect(slotsOf('Large')[13]?.textContent).toContain('Booked: Ann');
    expect(localStorage.getItem('room-booking:name')).toBe('Ann');
  });

  it('refuses an overlap naming the conflict, and stays open (UJ-1 extension)', () => {
    seed({ roomId: 'small', date: DAY, startSlot: 13, slotCount: 1, name: 'Bo' });
    render(<Harness />);
    open('Small', '14:00');
    fireEvent.change(form().getByLabelText('End'), { target: { value: '2' } });
    fireEvent.change(form().getByLabelText('Name'), { target: { value: 'Ann' } });
    confirm();
    expect(form().getByRole('alert').textContent).toContain('14:30-15:00 by Bo');
    fireEvent.change(form().getByLabelText('End'), { target: { value: '1' } });
    confirm();
    expect(screen.getByRole('status').textContent).toContain('14:00-14:30');
  });

  it('allows a booking in another Room after reaching that day’s allowance elsewhere', () => {
    seed({ roomId: 'medium', date: DAY, startSlot: 0, slotCount: 3, name: 'ann' });
    render(<Harness />);
    open('Small', '14:00');
    fireEvent.change(form().getByLabelText('End'), { target: { value: '2' } });
    fireEvent.change(form().getByLabelText('Name'), { target: { value: 'Ann' } });
    confirm();
    expect(screen.getByRole('status').textContent).toContain('Booked Small');
  });

  it('refuses a blank Name and keeps the form open', () => {
    render(<Harness />);
    open('Small', '14:00');
    confirm();
    expect(form().getByRole('alert').textContent).toMatch(/name/i);
  });

  it('closes without booking', () => {
    render(<Harness />);
    open('Small', '14:00');
    fireEvent.click(form().getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('form', { name: 'Book a room' })).toBeNull();
  });

  it('closes the form when another day is selected', () => {
    render(<Harness />);
    open('Small', '14:00');
    fireEvent.change(screen.getByRole('combobox', { name: /day/i }), { target: { value: '2026-10-20' } });
    expect(screen.queryByRole('form', { name: 'Book a room' })).toBeNull();
  });
});

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the app title', () => {
    render(<App now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Room Booking' })).toBeDefined();
  });

  it('offers 7 days with today selected', () => {
    render(<App now={NOW} />);
    const select = screen.getByRole('combobox', { name: /day/i }) as HTMLSelectElement;
    expect(select.options).toHaveLength(7);
    expect(select.value).toBe('2026-10-19');
    expect(select.options[0]?.text).toBe('Mon 19 Oct');
    expect(select.options[6]?.text).toBe('Sun 25 Oct');
  });

  it('shows Room facts', () => {
    render(<App now={NOW} />);
    expect(screen.getByText('Capacity 4')).toBeDefined();
    expect(screen.getByText('Capacity 8')).toBeDefined();
    expect(screen.getByText('Capacity 14 · Projector')).toBeDefined();
    expect(screen.getAllByText(/Projector/)).toHaveLength(1);
  });

  it('marks 08:00-10:00 unavailable and 10:30 free at 10:10', () => {
    render(<App now={NOW} />);
    const items = slotsOf('Small');
    expect(items).toHaveLength(24);
    for (let i = 0; i <= 4; i++) expect(items[i]?.textContent).toContain('Unavailable');
    expect(items[0]?.textContent).toContain('08:00');
    expect(items[5]?.textContent).toContain('10:30');
    expect(items[5]?.textContent).toContain('Free');
  });

  it('re-renders with all Slots free when selecting a future day', () => {
    render(<App now={NOW} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2026-10-20' } });
    for (const room of ['Small', 'Medium', 'Large']) {
      for (const li of slotsOf(room)) expect(li.textContent).toContain('Free');
    }
  });

  it('shows the booker Name on booked Slots, including past ones', () => {
    const bookings: Booking[] = [
      { id: '1', roomId: 'medium', date: '2026-10-19', startSlot: 1, slotCount: 1, name: 'Ann' },
      { id: '2', roomId: 'large', date: '2026-10-19', startSlot: 6, slotCount: 2, name: 'Bo' },
    ];
    render(<App now={NOW} bookings={bookings} />);
    expect(slotsOf('Medium')[1]?.textContent).toContain('Booked: Ann');
    const large = slotsOf('Large');
    expect(large[6]?.textContent).toContain('Booked: Bo');
    expect(large[7]?.textContent).toContain('Booked: Bo');
    expect(large[8]?.textContent).toContain('Free');
  });

  describe('week overview', () => {
    const fixtures: Booking[] = [
      { id: '1', roomId: 'small', date: '2026-10-19', startSlot: 2, slotCount: 2, name: 'Ann' },
      { id: '2', roomId: 'small', date: '2026-10-19', startSlot: 4, slotCount: 3, name: 'Bo' },
      ...[0, 4, 8, 12, 16, 20].map((s, i): Booking => ({
        id: `f${i}`, roomId: 'large', date: '2026-10-21', startSlot: s, slotCount: 4, name: 'Cy',
      })),
    ];
    const overview = () => within(screen.getByRole('region', { name: 'Week overview' }));

    it('shows 3 Rooms x 7 days as 21 buttons with counts, Empty and Full', () => {
      render(<App now={NOW} bookings={fixtures} />);
      expect(overview().getAllByRole('button')).toHaveLength(21);
      expect(overview().getByRole('button', { name: 'Small, Mon 19 Oct, 5/24' }).textContent).toBe('5/24');
      expect(overview().getByRole('button', { name: 'Large, Wed 21 Oct, Full' }).textContent).toBe('Full');
      expect(overview().getByRole('button', { name: 'Medium, Mon 19 Oct, Empty' }).textContent).toBe('Empty');
      expect(overview().getAllByText('Full')).toHaveLength(1);
      expect(overview().getAllByText('Empty')).toHaveLength(19);
    });

    it('selects the day and shows its day view when a cell is clicked', () => {
      render(<App now={NOW} bookings={fixtures} />);
      const select = screen.getByRole('combobox', { name: /day/i }) as HTMLSelectElement;
      const cell = overview().getByRole('button', { name: 'Large, Wed 21 Oct, Full' });
      expect(cell.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(cell);
      expect(select.value).toBe('2026-10-21');
      expect(cell.getAttribute('aria-pressed')).toBe('true');
      for (const li of slotsOf('Large')) expect(li.textContent).toContain('Booked: Cy');
      for (const li of slotsOf('Small')) expect(li.textContent).toContain('Free');
    });
  });

  it('follows the clock when open without a fixed time', () => {
    vi.useFakeTimers({ now: NOW });
    render(<App />);
    expect(slotsOf('Small')[6]?.textContent).toContain('Free'); // 11:00
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000); // 11:10
    });
    expect(slotsOf('Small')[6]?.textContent).toContain('Unavailable');
  });
});

describe('My Bookings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const mine = () => within(screen.getByRole('region', { name: 'My Bookings' }));

  it('shows the empty state when no Name is set', () => {
    seed({ roomId: 'medium', date: DAY, startSlot: 12, slotCount: 2, name: 'Eleni K.' });
    render(<Harness />);
    expect(mine().getByText('No upcoming bookings.')).toBeDefined();
  });

  it('lists upcoming Bookings for a differently-cased, padded Name', () => {
    localStorage.setItem('room-booking:name', '  eleni k. ');
    seed(
      { roomId: 'medium', date: DAY, startSlot: 12, slotCount: 2, name: 'Eleni K.' },
      { roomId: 'small', date: DAY, startSlot: 2, slotCount: 1, name: 'Ann' },
    );
    render(<Harness />);
    const items = mine().getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(['Medium, Tue 20 Oct, 14:00-15:00Cancel']);
  });

  it('shows the empty state when all Bookings have ended or belong to others', () => {
    localStorage.setItem('room-booking:name', 'Eleni K.');
    seed(
      { roomId: 'small', date: '2026-10-19', startSlot: 0, slotCount: 1, name: 'Eleni K.' },
      { roomId: 'small', date: DAY, startSlot: 2, slotCount: 1, name: 'Ann' },
    );
    render(<Harness />);
    expect(mine().getByText('No upcoming bookings.')).toBeDefined();
  });

  const cancelBtn = () => mine().getByRole('button', { name: /^Cancel Medium/ });
  const overviewCell = () => screen.getByRole('button', { name: /^Medium, Tue 20 Oct,/ });

  it('cancels: row removed, Slots free in day view, week overview drops', () => {
    localStorage.setItem('room-booking:name', 'eleni k.');
    seed({ roomId: 'medium', date: DAY, startSlot: 12, slotCount: 2, name: 'Eleni K.' });
    render(<Harness />);
    expect(overviewCell().textContent).toBe('2/24');
    fireEvent.click(cancelBtn());
    expect(mine().getByText('No upcoming bookings.')).toBeDefined();
    expect(overviewCell().textContent).toBe('Empty');
    fireEvent.change(screen.getByRole('combobox', { name: /day/i }), { target: { value: DAY } });
    expect(screen.getByRole('button', { name: 'Book Medium 14:00' })).toBeDefined();
    expect(localStorage.getItem('room-booking:v1')).toContain('"bookings":[]');
  });

  it('shows the refusal and keeps the row when the Booking is gone from storage', () => {
    localStorage.setItem('room-booking:name', 'Eleni K.');
    seed({ roomId: 'medium', date: DAY, startSlot: 12, slotCount: 2, name: 'Eleni K.' });
    render(<Harness />);
    localStorage.setItem('room-booking:v1', JSON.stringify({ version: 1, bookings: [] }));
    fireEvent.click(cancelBtn());
    expect(screen.getByRole('alert').textContent).toMatch(/no longer exists/);
    expect(mine().getAllByRole('listitem')).toHaveLength(1);
  });

  it('offers no edit action', () => {
    localStorage.setItem('room-booking:name', 'Eleni K.');
    seed({ roomId: 'medium', date: DAY, startSlot: 12, slotCount: 2, name: 'Eleni K.' });
    render(<Harness />);
    expect(mine().queryByRole('button', { name: /edit|change|move/i })).toBeNull();
  });
});
