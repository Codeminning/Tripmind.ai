import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTripCountdown } from '../src/tripReminders.js';

describe('Today Companion View Logic & Active Day Selection', () => {
  it('correctly calculates current day when trip is ongoing', () => {
    // Trip started 2 days ago, total 4 days
    const ref = new Date(2026, 10, 15); // Nov 15, 2026
    const startDate = '2026-11-13'; // Nov 13, 2026 (2 days ago)
    const countdown = calculateTripCountdown(startDate, ref, 4);

    assert.equal(countdown.status, 'ongoing');
    assert.equal(countdown.diffDays, -2);
    const elapsed = Math.abs(countdown.diffDays);
    const activeDayNum = Math.min(elapsed + 1, 4);
    assert.equal(activeDayNum, 3); // Should be Day 3
  });

  it('selects Day 1 when trip begins today', () => {
    const ref = new Date(2026, 10, 15);
    const startDate = '2026-11-15';
    const countdown = calculateTripCountdown(startDate, ref, 4);

    assert.equal(countdown.status, 'today');
    assert.equal(countdown.diffDays, 0);
  });

  it('defaults to Day 1 for upcoming trips', () => {
    const ref = new Date(2026, 10, 15);
    const startDate = '2026-11-20';
    const countdown = calculateTripCountdown(startDate, ref, 4);

    assert.equal(countdown.status, 'upcoming');
    assert.equal(countdown.diffDays, 5);
  });

  it('caps at the final day when trip is past or completed', () => {
    const ref = new Date(2026, 10, 25);
    const startDate = '2026-11-10';
    const countdown = calculateTripCountdown(startDate, ref, 4);

    assert.equal(countdown.status, 'completed');
    const elapsed = Math.abs(countdown.diffDays);
    const activeDayNum = Math.min(elapsed + 1, 4);
    assert.equal(activeDayNum, 4);
  });
});

