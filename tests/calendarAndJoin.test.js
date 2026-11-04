import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractInviteToken } from '../src/groupTrip.js';
import { createGoogleCalendarWebUrl, formatTripEventsForGoogleApi } from '../src/calendarExport.js';
import { buildGoogleTripEvents } from '../server/googleCalendar.js';

describe('Group Trip Invite Link Extraction', () => {
  const sampleToken = 'inv_AbCdEf1234567890';

  it('extracts token from standard path URL', () => {
    assert.equal(extractInviteToken(`https://tripmind.app/join/${sampleToken}`), sampleToken);
    assert.equal(extractInviteToken(`http://localhost:5173/join/${sampleToken}`), sampleToken);
  });

  it('extracts token from hash-based routing URL', () => {
    assert.equal(extractInviteToken(`http://localhost:5173/#/join/${sampleToken}`), sampleToken);
    assert.equal(extractInviteToken(`https://tripmind.ai/#join/${sampleToken}`), sampleToken);
  });

  it('extracts token from relative paths', () => {
    assert.equal(extractInviteToken(`/join/${sampleToken}`), sampleToken);
  });

  it('extracts token from query parameters', () => {
    assert.equal(extractInviteToken(`https://tripmind.app?inviteToken=${sampleToken}`), sampleToken);
  });

  it('handles raw token input directly', () => {
    assert.equal(extractInviteToken(sampleToken), sampleToken);
  });

  it('trims leading and trailing whitespace', () => {
    assert.equal(extractInviteToken(`   https://tripmind.app/join/${sampleToken}   `), sampleToken);
    assert.equal(extractInviteToken(`   ${sampleToken}   `), sampleToken);
  });

  it('returns empty string on empty or invalid input', () => {
    assert.equal(extractInviteToken(''), '');
    assert.equal(extractInviteToken(null), '');
    assert.equal(extractInviteToken(undefined), '');
    assert.equal(extractInviteToken('https://google.com/search?q=paris'), '');
    assert.equal(extractInviteToken('too-short'), '');
  });
});

describe('Google Calendar Web Intent Generation', () => {
  const mockTrip = {
    id: 'trip_kyoto_autumn',
    destination: 'Kyoto, Japan',
    startDate: '2026-11-12',
    summary: 'A serene autumn exploration of Kyoto.',
    travelTip: 'Visit temples at early morning dawn.',
    days: [
      {
        day: 1,
        title: 'Arashiyama Bamboo Grove',
        activities: [
          { time: '09:00', title: 'Bamboo Grove Stroll', location: 'Arashiyama', cost: 0 },
          { time: '13:00', title: 'Traditional Matcha House', location: 'Gion', cost: 15 }
        ]
      },
      {
        day: 2,
        title: 'Historic Higashiyama',
        activities: [
          { time: '10:00', title: 'Kiyomizu-dera Visit', location: 'Higashiyama', cost: 10 }
        ]
      }
    ]
  };

  it('builds a valid Google Calendar Web Intent URL', () => {
    const url = createGoogleCalendarWebUrl(mockTrip);
    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
    assert.ok(url.includes('Kyoto'));
    assert.ok(url.includes('Bamboo'));
    assert.ok(url.includes('Matcha'));
  });

  it('encodes date ranges properly in dates parameter', () => {
    const url = createGoogleCalendarWebUrl(mockTrip);
    // 2026-11-12 start date + 2 days = 2026-11-14
    assert.ok(url.includes('dates=20261112/20261114') || url.includes('dates=20261112%2F20261114'));
  });

  it('returns empty string if trip is not provided', () => {
    assert.equal(createGoogleCalendarWebUrl(null), '');
  });
});

describe('Google Calendar REST API Payload Generation', () => {
  const mockTrip = {
    id: 'trip_madurai_temple',
    destination: 'Madurai, Tamil Nadu',
    startDate: '2026-12-05',
    summary: 'Spiritual architecture and culinary heritage.',
    travelTip: 'Visit the evening Meenakshi Amman Temple procession.',
    days: [
      {
        day: 1,
        title: 'Historic Temples & Bazaars',
        activities: [
          { time: '08:30 AM', title: 'Meenakshi Amman Temple', location: 'Madurai', cost: 5, description: 'Magnificent gopurams and sacred hall.' },
          { time: '14:00', title: 'Traditional Madurai Jigarthanda', location: 'East Marret Street', cost: 2, description: 'Famous cooling dessert drink.' }
        ]
      }
    ]
  };

  it('formats events client-side for Google API', () => {
    const events = formatTripEventsForGoogleApi(mockTrip);
    assert.ok(events.length >= 2, 'Should create overview event and activity events');

    const overview = events[0];
    assert.ok(overview.summary.includes('Madurai'));
    assert.equal(overview.start.date, '2026-12-05');
    assert.equal(overview.end.date, '2026-12-06');

    const act1 = events[1];
    assert.equal(act1.summary, 'Meenakshi Amman Temple');
    assert.ok(act1.start.dateTime.startsWith('2026-12-05T08:30:00'));
    assert.equal(act1.start.timeZone, 'Asia/Kolkata');
  });

  it('builds server-side Google Calendar events with idempotent keys', () => {
    const serverEvents = buildGoogleTripEvents(mockTrip);
    assert.ok(serverEvents.length >= 2);

    const overview = serverEvents[0];
    assert.equal(overview.key, 'overview_trip_madurai_temple');
    assert.ok(overview.payload.summary.includes('Madurai'));

    const act1 = serverEvents[1];
    assert.equal(act1.key, 'act_trip_madurai_temple_d1_a0');
    assert.equal(act1.payload.summary, 'Meenakshi Amman Temple');
    assert.ok(act1.payload.start.dateTime.startsWith('2026-12-05T08:30:00'));
    assert.equal(act1.payload.start.timeZone, 'Asia/Kolkata');
  });
});
