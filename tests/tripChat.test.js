import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndSanitizeEdits,
  applyTripEdits,
  sanitizeTimeString,
  sanitizeActivity
} from '../src/tripChat.js';

describe('Trip Chat & Itinerary Edit Validation (Phase 2)', () => {
  const sampleTrip = {
    id: 'trip_kyoto',
    destination: 'Kyoto, Japan',
    days: [
      {
        day: 1,
        title: 'Arashiyama Bamboo & River Walk',
        activities: [
          { time: '09:00', title: 'Bamboo Grove Stroll', category: 'nature', cost: 0 },
          { time: '12:00', title: 'Soba Lunch by the River', category: 'food', cost: 18 },
          { time: '15:00', title: 'Tenryu-ji Temple Gardens', category: 'culture', cost: 8 }
        ]
      },
      {
        day: 2,
        title: 'Higashiyama Heritage',
        activities: [
          { time: '09:30', title: 'Kiyomizu-dera Temple', category: 'culture', cost: 5 },
          { time: '13:00', title: 'Gion Artisan Alley Walk', category: 'walk', cost: 0 }
        ]
      }
    ],
    budgetBreakdown: {
      totalEstimatedUsd: 400,
      categories: {
        activities: 31
      }
    }
  };

  it('sanitizes and formats time strings properly', () => {
    assert.equal(sanitizeTimeString('9:30'), '09:30');
    assert.equal(sanitizeTimeString('14:45'), '14:45');
    assert.equal(sanitizeTimeString('invalid-time', '11:00'), '11:00');
    assert.equal(sanitizeTimeString(null, '12:00'), '12:00');
  });

  it('sanitizes activities and drops invalid coordinates', () => {
    const valid = sanitizeActivity({
      title: 'Traditional Matcha Ceremony',
      time: '15:30',
      category: 'culture',
      cost: 25,
      latitude: 35.0116,
      longitude: 135.7681
    });
    assert.ok(valid);
    assert.equal(valid.title, 'Traditional Matcha Ceremony');
    assert.equal(valid.cost, 25);
    assert.equal(valid.latitude, 35.0116);

    const invalidCoords = sanitizeActivity({
      title: 'Mystery Spot',
      latitude: 999, // Out of range
      longitude: -200
    });
    assert.ok(invalidCoords);
    assert.equal(invalidCoords.latitude, undefined);
    assert.equal(invalidCoords.longitude, undefined);
  });

  it('validates replace_activity edits against trip days bounds', () => {
    const rawEdits = [
      {
        type: 'replace_activity',
        day: 1,
        index: 1,
        activity: {
          title: 'Covered Nishiki Market Tasting Tour',
          time: '12:30',
          category: 'food',
          cost: 28
        }
      }
    ];

    const result = validateAndSanitizeEdits(rawEdits, sampleTrip);
    assert.equal(result.valid, true);
    assert.equal(result.sanitizedEdits.length, 1);
    assert.equal(result.sanitizedEdits[0].activity.title, 'Covered Nishiki Market Tasting Tour');
  });

  it('rejects edits pointing to non-existent days or out-of-bound indices', () => {
    const badEdits = [
      {
        type: 'replace_activity',
        day: 99, // Day 99 doesn't exist
        index: 0,
        activity: { title: 'Ghost Tour' }
      },
      {
        type: 'replace_activity',
        day: 1,
        index: 50, // Out of range index
        activity: { title: 'Unknown' }
      }
    ];

    const result = validateAndSanitizeEdits(badEdits, sampleTrip);
    assert.equal(result.valid, false);
    assert.equal(result.sanitizedEdits.length, 0);
    assert.equal(result.errors.length, 2);
  });

  it('applies replace_activity and maintains chronological order', () => {
    const edits = [
      {
        type: 'replace_activity',
        day: 1,
        index: 1,
        activity: {
          title: 'Early Morning Bakery Walk',
          time: '08:00', // Should sort to the top
          category: 'food',
          cost: 12
        }
      }
    ];

    const updated = applyTripEdits(sampleTrip, edits);
    assert.notEqual(updated, sampleTrip); // Immutable copy
    const day1Activities = updated.days[0].activities;
    assert.equal(day1Activities.length, 3);
    assert.equal(day1Activities[0].title, 'Early Morning Bakery Walk');
    assert.equal(day1Activities[0].time, '08:00');
    assert.equal(day1Activities[1].title, 'Bamboo Grove Stroll');
    assert.equal(day1Activities[1].time, '09:00');
  });

  it('applies add_activity and recalculates activity budget', () => {
    const edits = [
      {
        type: 'add_activity',
        day: 2,
        index: 2,
        activity: {
          title: 'Lantern-lit Dinner in Pontocho',
          time: '19:30',
          category: 'food',
          cost: 45
        }
      }
    ];

    const updated = applyTripEdits(sampleTrip, edits);
    const day2Activities = updated.days[1].activities;
    assert.equal(day2Activities.length, 3);
    assert.equal(day2Activities[2].title, 'Lantern-lit Dinner in Pontocho');
    assert.equal(day2Activities[2].cost, 45);
    // Original total activities was 0+18+8 + 5+0 = 31; added 45 => 76
    assert.equal(updated.budgetBreakdown.categories.activities, 76);
  });

  it('applies remove_activity cleanly', () => {
    const edits = [
      {
        type: 'remove_activity',
        day: 1,
        index: 0
      }
    ];

    const updated = applyTripEdits(sampleTrip, edits);
    assert.equal(updated.days[0].activities.length, 2);
    assert.equal(updated.days[0].activities[0].title, 'Soba Lunch by the River');
  });
});

