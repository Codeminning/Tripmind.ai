/**
 * Safe string manipulation utilities for TripMind AI.
 * Prevents TypeError exceptions when properties are null, undefined, or unexpected types.
 */

// Returns an uppercase string, never throws
export const upper = (value, fallback = '') =>
  String(value ?? fallback).toUpperCase();

// Returns a lowercase string, never throws
export const lower = (value, fallback = '') =>
  String(value ?? fallback).toLowerCase();

// Returns initials for avatars, e.g. "Asha Rao" -> "AR", missing -> "?"
export const initials = (nameLike) => {
  const text = String(nameLike ?? '').trim();
  if (!text) return '?';
  const parts = text.split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + second).toUpperCase() || '?';
};

// Picks the first usable display name
export const displayNameOf = (person) =>
  person?.name ||
  person?.displayName ||
  person?.fullName ||
  person?.user_name ||
  (person?.email ? String(person.email).split('@')[0] : '') ||
  'Traveller';

