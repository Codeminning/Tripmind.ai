import { describe, test } from 'node:test'
import assert from 'node:assert'
import { upper, lower, initials, displayNameOf } from '../src/utils/safeText.js'
import { extractInviteToken } from '../src/groupTrip.js'

describe('Safe Text Helpers (upper, lower, initials, displayNameOf)', () => {
  test('upper safely handles undefined, null, numbers, and strings without throwing', () => {
    assert.strictEqual(upper(undefined), '')
    assert.strictEqual(upper(null), '')
    assert.strictEqual(upper(undefined, 'saved'), 'SAVED')
    assert.strictEqual(upper(null, 'member'), 'MEMBER')
    assert.strictEqual(upper('active'), 'ACTIVE')
    assert.strictEqual(upper(123), '123')
  })

  test('lower safely handles undefined, null, numbers, and strings without throwing', () => {
    assert.strictEqual(lower(undefined), '')
    assert.strictEqual(lower(null), '')
    assert.strictEqual(lower(undefined, 'UPPER'), 'upper')
    assert.strictEqual(lower('PARIS'), 'paris')
  })

  test('initials extracts first and last initials or falls back to ?', () => {
    assert.strictEqual(initials('Asha Rao'), 'AR')
    assert.strictEqual(initials('John Michael Smith'), 'JS')
    assert.strictEqual(initials('Dhyanesh'), 'D')
    assert.strictEqual(initials(''), '?')
    assert.strictEqual(initials(null), '?')
    assert.strictEqual(initials(undefined), '?')
    assert.strictEqual(initials('   '), '?')
  })

  test('displayNameOf picks the first usable name or falls back to Traveller', () => {
    assert.strictEqual(displayNameOf({ name: 'Dhyanesh' }), 'Dhyanesh')
    assert.strictEqual(displayNameOf({ displayName: 'Alex Chen' }), 'Alex Chen')
    assert.strictEqual(displayNameOf({ fullName: 'Sarah Connor' }), 'Sarah Connor')
    assert.strictEqual(displayNameOf({ user_name: 'Explorer123' }), 'Explorer123')
    assert.strictEqual(displayNameOf({ email: 'wanderer@example.com' }), 'wanderer')
    assert.strictEqual(displayNameOf(null), 'Traveller')
    assert.strictEqual(displayNameOf({}), 'Traveller')
  })
})

describe('Group Link Hash Routing & Validation', () => {
  test('extracts invite token from hash routing URL on deployed domain', () => {
    const deployedUrl = 'https://breakmind.vercel.app/#/join/abc123tokenXYZ'
    assert.strictEqual(extractInviteToken(deployedUrl), 'abc123tokenXYZ')
  })

  test('extracts invite token from local and preview URLs', () => {
    assert.strictEqual(extractInviteToken('http://localhost:5173/#/join/tok456'), 'tok456')
    assert.strictEqual(extractInviteToken('https://tripmind.app/join/pathToken789'), 'pathToken789')
    assert.strictEqual(extractInviteToken('https://tripmind.app?inviteToken=queryToken321'), 'queryToken321')
  })

  test('rejects random or invalid URLs gracefully with empty string', () => {
    assert.strictEqual(extractInviteToken('https://example.com/not-a-trip'), '')
    assert.strictEqual(extractInviteToken('random text'), '')
    assert.strictEqual(extractInviteToken(''), '')
    assert.strictEqual(extractInviteToken(null), '')
  })
})
