import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocalDate,
  calculateTripCountdown,
  evaluateTripReminder
} from '../src/tripReminders.js';

describe('Trip Countdown & Local Date Calculation (Phase 3)', () => {
  it('parses local date parts without UTC timezone offset corruption', () => {
    const d = parseLocalDate('2026-11-12');
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 10); // 0-indexed November
    assert.equal(d.getDate(), 12);
  });

  it('handles null or invalid date strings gracefully', () => {
    assert.equal(parseLocalDate(null), null);
    assert.equal(parseLocalDate(''), null);
    assert.equal(parseLocalDate('invalid'), null);
  });

  it('calculates countdown accurately for future dates', () => {
    const today = new Date(2026, 9, 29); // Oct 29, 2026
    const countdown = calculateTripCountdown('2026-11-10', today); // 12 days later
    assert.equal(countdown.diffDays, 12);
    assert.equal(countdown.badgeText, '12 days to go');
    assert.equal(countdown.status, 'upcoming');
  });

  it('identifies trips starting tomorrow', () => {
    const today = new Date(2026, 9, 29); // Oct 29, 2026
    const countdown = calculateTripCountdown('2026-10-30', today);
    assert.equal(countdown.diffDays, 1);
    assert.equal(countdown.badgeText, 'Starts tomorrow');
    assert.equal(countdown.status, 'tomorrow');
  });

  it('identifies trips starting today', () => {
    const today = new Date(2026, 9, 29); // Oct 29, 2026
    const countdown = calculateTripCountdown('2026-10-29', today);
    assert.equal(countdown.diffDays, 0);
    assert.equal(countdown.badgeText, 'Starts today');
    assert.equal(countdown.status, 'today');
  });

  it('identifies ongoing trips based on duration', () => {
    const today = new Date(2026, 9, 31); // 2 days after start
    const countdown = calculateTripCountdown('2026-10-29', today, 4); // 4-day trip
    assert.equal(countdown.status, 'ongoing');
    assert.equal(countdown.badgeText, 'Day 3 of trip');
  });

  it('identifies completed trips when past duration', () => {
    const today = new Date(2026, 10, 10); // Nov 10, long after Oct 29
    const countdown = calculateTripCountdown('2026-10-29', today, 4);
    assert.equal(countdown.status, 'completed');
  });
});

describe('Reminder Scheduling & Duplicate Prevention (Phase 3)', () => {
  const sampleTrip = {
    id: 'trip_123',
    destination: 'Kyoto, Japan',
    startDate: '2026-11-05',
    remindersSent: []
  };

  it('triggers 7-day reminder when trip is exactly 7 days away', () => {
    const refDate = new Date(2026, 9, 29); // Oct 29 -> Nov 5 is 7 days
    const result = evaluateTripReminder(sampleTrip, [7, 3, 1], refDate);
    assert.equal(result.shouldRemind, true);
    assert.equal(result.reminderType, '7_day');
    assert.equal(result.diffDays, 7);
  });

  it('does NOT trigger reminder if reminder flag is already recorded', () => {
    const refDate = new Date(2026, 9, 29);
    const tripWithFlag = {
      ...sampleTrip,
      remindersSent: ['7_day']
    };
    const result = evaluateTripReminder(tripWithFlag, [7, 3, 1], refDate);
    assert.equal(result.shouldRemind, false);
  });

  it('triggers 3-day and 1-day reminders on their respective dates', () => {
    const tripNov5 = { id: 't2', destination: 'Paris', startDate: '2026-11-05', remindersSent: ['7_day'] };
    // 3 days before Nov 5 is Nov 2
    const refNov2 = new Date(2026, 10, 2);
    const result3 = evaluateTripReminder(tripNov5, [7, 3, 1], refNov2);
    assert.equal(result3.shouldRemind, true);
    assert.equal(result3.reminderType, '3_day');

    // 1 day before Nov 5 is Nov 4
    const tripSent3 = { ...tripNov5, remindersSent: ['7_day', '3_day'] };
    const refNov4 = new Date(2026, 10, 4);
    const result1 = evaluateTripReminder(tripSent3, [7, 3, 1], refNov4);
    assert.equal(result1.shouldRemind, true);
    assert.equal(result1.reminderType, '1_day');
  });

  it('does not trigger on non-threshold days', () => {
    const refDate = new Date(2026, 9, 30); // 6 days before Nov 5
    const result = evaluateTripReminder(sampleTrip, [7, 3, 1], refDate);
    assert.equal(result.shouldRemind, false);
  });
});

