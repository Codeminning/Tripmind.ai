/**
 * TripMind AI - Group Trip Planning & Collaboration Engine
 * Handles shared trips, unguessable invite links, role checks, activity proposals,
 * voting thresholds, activity-level comment threads, and optimistic version conflict detection.
 */

/**
 * Evaluates whether a proposal can be confirmed based on role and threshold rules.
 * @param {Object} proposal - contains votes: { up: string[], down: string[] }
 * @param {string} userRole - 'owner' | 'member'
 * @param {string} threshold - 'owner' | 'majority'
 * @param {number} totalMembers - total member count in the group
 */
export function canConfirmProposal({ proposal, userRole, threshold = 'owner', totalMembers = 1 }) {
  if (userRole === 'owner') return true;
  if (threshold === 'owner') return false;

  if (threshold === 'majority' && proposal && proposal.votes) {
    const upCount = Array.isArray(proposal.votes.up) ? proposal.votes.up.length : 0;
    const downCount = Array.isArray(proposal.votes.down) ? proposal.votes.down.length : 0;
    // Majority threshold requires net positive votes and at least 50% approval
    const minRequired = Math.ceil(totalMembers / 2);
    return upCount > downCount && upCount >= minRequired;
  }

  return false;
}

/**
 * Detects version conflict between local trip state and incoming server update.
 */
export function isVersionConflicted(localVersion, serverVersion) {
  const local = Number(localVersion) || 1;
  const server = Number(serverVersion) || 1;
  return server > local;
}

/**
 * Extracts a clean invite token from any accepted user input format:
 * - Full URL: https://tripmind.app/join/xyz123
 * - Hash URL: http://localhost:5173/#/join/xyz123
 * - Query param: https://tripmind.app?inviteToken=xyz123
 * - Path: /join/xyz123
 * - Direct token: xyz123
 */
export function extractInviteToken(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return '';
  const trimmed = rawInput.trim();

  // Try URL parsing
  try {
    const url = new URL(trimmed);
    // 1. Hash routing support e.g. https://breakmind.vercel.app/#/join/abc123 or #join/abc123
    if (url.hash) {
      const hashMatch = url.hash.match(/(?:join\/|inviteToken=)([a-zA-Z0-9_-]+)/i);
      if (hashMatch && hashMatch[1]) return hashMatch[1];
    }
    // 2. Query param e.g. ?inviteToken=abc123
    const qToken = url.searchParams.get('inviteToken');
    if (qToken) return qToken;
    // 3. Pathname e.g. /join/abc123
    const pathMatch = url.pathname.match(/join\/([a-zA-Z0-9_-]+)/i);
    if (pathMatch && pathMatch[1]) return pathMatch[1];
  } catch (_) {
    // Not a valid URL object, fallback to regex
  }

  // Match /join/<token> or #/join/<token> or inviteToken=<token>
  const match = trimmed.match(/(?:join\/|inviteToken=)([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // If input contains no slashes, hashes or protocols, assume raw token if alphanumeric (10-64 chars)
  if (!trimmed.includes('/') && !trimmed.includes(':') && !trimmed.includes('?') && !trimmed.includes('#') && /^[a-zA-Z0-9_-]{10,64}$/.test(trimmed)) {
    return trimmed;
  }

  return '';
}

// ---------------- Client API Calls ----------------

export async function fetchTripCollaboration(tripId, token) {
  if (!tripId) return null;
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/collaborate`, { headers });
  if (!res.ok) {
    throw new Error('Could not fetch shared trip data.');
  }
  return res.json();
}

export async function updateTripCollaboration({ tripId, trip, version, token }) {
  if (!tripId) return null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/collaborate`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ trip, version })
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    const conflictErr = new Error(data.error || 'This itinerary was recently updated by another member.');
    conflictErr.code = 'VERSION_CONFLICT';
    conflictErr.serverVersion = data.serverVersion;
    throw conflictErr;
  }
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update shared itinerary.');
  }
  return data;
}

export async function generateInviteLink({ tripId, maxMembers = 10, expiresInDays = null, confirmThreshold = 'owner', token }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ maxMembers, expiresInDays, confirmThreshold })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate group invite link.');
  }
  return data;
}

export async function revokeInviteLink({ tripId, token }) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/invite`, {
    method: 'DELETE',
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to revoke invite link.');
  }
  return data;
}

export async function fetchInvitePreview(inviteToken) {
  const res = await fetch(`/api/trips/join/${encodeURIComponent(inviteToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Invalid or expired invite link.');
  }
  return data;
}

export async function joinTripByInvite({ inviteToken, token }) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/join/${encodeURIComponent(inviteToken)}`, {
    method: 'POST',
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Could not join group trip.');
    error.code = data.code;
    throw error;
  }
  return data;
}

export async function fetchTripMembers(tripId, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/members`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function removeTripMember({ tripId, memberUserId, token }) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(memberUserId)}`, {
    method: 'DELETE',
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to remove member.');
  }
  return data;
}

export async function proposeActivity({ tripId, day, activity, token }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/proposals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ day, activity })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to propose activity.');
  }
  return data;
}

export async function confirmProposal({ tripId, proposalId, token }) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/proposals/${encodeURIComponent(proposalId)}/confirm`, {
    method: 'POST',
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to confirm proposal.');
  }
  return data;
}

export async function dismissProposal({ tripId, proposalId, token }) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/proposals/${encodeURIComponent(proposalId)}`, {
    method: 'DELETE',
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to dismiss proposal.');
  }
  return data;
}

export async function voteActivity({ tripId, activityKey, voteType, token }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/activities/vote`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ activityKey, voteType })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to record vote.');
  }
  return data;
}

export async function postActivityComment({ tripId, activityKey, text, token }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/activities/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ activityKey, text })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to post comment.');
  }
  return data;
}

export async function deleteActivityComment({ tripId, commentId, token }) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/activities/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete comment.');
  }
  return data;
}

