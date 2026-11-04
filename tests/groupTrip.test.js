import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canConfirmProposal, isVersionConflicted } from '../src/groupTrip.js';

describe('Group Trip Proposal Confirmation Rules (Phase 4)', () => {
  const proposalSample = {
    id: 'prop_1',
    day: 1,
    activity: { title: 'Sunset Harbor Cruise' },
    votes: {
      up: ['Alice', 'Bob', 'Charlie'],
      down: ['Dave']
    }
  };

  it('allows the trip owner to confirm proposals regardless of threshold', () => {
    assert.equal(
      canConfirmProposal({ proposal: proposalSample, userRole: 'owner', threshold: 'owner', totalMembers: 4 }),
      true
    );
    assert.equal(
      canConfirmProposal({ proposal: proposalSample, userRole: 'owner', threshold: 'majority', totalMembers: 4 }),
      true
    );
  });

  it('prevents regular members from confirming proposals when threshold is owner', () => {
    assert.equal(
      canConfirmProposal({ proposal: proposalSample, userRole: 'member', threshold: 'owner', totalMembers: 4 }),
      false
    );
  });

  it('allows members to confirm under majority threshold when upvotes reach majority', () => {
    // 3 upvotes out of 4 total members is >= 50% and net positive
    assert.equal(
      canConfirmProposal({ proposal: proposalSample, userRole: 'member', threshold: 'majority', totalMembers: 4 }),
      true
    );
  });

  it('rejects confirmation under majority threshold when downvotes outweigh upvotes', () => {
    const unapprovedProposal = {
      ...proposalSample,
      votes: {
        up: ['Alice'],
        down: ['Bob', 'Charlie', 'Dave']
      }
    };
    assert.equal(
      canConfirmProposal({ proposal: unapprovedProposal, userRole: 'member', threshold: 'majority', totalMembers: 4 }),
      false
    );
  });

  it('rejects confirmation under majority threshold when net votes are tied', () => {
    const tiedProposal = {
      ...proposalSample,
      votes: {
        up: ['Alice', 'Bob'],
        down: ['Charlie', 'Dave']
      }
    };
    assert.equal(
      canConfirmProposal({ proposal: tiedProposal, userRole: 'member', threshold: 'majority', totalMembers: 4 }),
      false
    );
  });
});

describe('Optimistic Version Conflict Detection (Phase 4)', () => {
  it('detects conflict when server version is higher than local version', () => {
    assert.equal(isVersionConflicted(1, 2), true);
    assert.equal(isVersionConflicted(2, 5), true);
  });

  it('identifies in-sync or newer local version as non-conflicted', () => {
    assert.equal(isVersionConflicted(2, 2), false);
    assert.equal(isVersionConflicted(3, 2), false);
  });
});

