// TripMind AI - Real Budget Tracking & Expense Management Engine

export const EXPENSE_CATEGORIES = [
  { id: 'stay', label: 'Stay & Lodging', icon: 'Hotel', color: '#5b8c6e' },
  { id: 'food', label: 'Food & Dining', icon: 'Utensils', color: '#c47d48' },
  { id: 'activities', label: 'Activities & Culture', icon: 'Ticket', color: '#6a78b5' },
  { id: 'transit', label: 'Transit & Transport', icon: 'Car', color: '#9179a6' },
  { id: 'other', label: 'Other & Miscellaneous', icon: 'Tag', color: '#828a7e' }
];

const EXPENSES_STORAGE_PREFIX = 'tripmind_expenses_';

export function getLocalExpenses(tripId) {
  if (!tripId || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${EXPENSES_STORAGE_PREFIX}${tripId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse local expenses:', err);
    return [];
  }
}

export function setLocalExpenses(tripId, expenses) {
  if (!tripId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${EXPENSES_STORAGE_PREFIX}${tripId}`, JSON.stringify(expenses));
  } catch (err) {
    console.error('Failed to set local expenses:', err);
  }
}

export async function fetchTripExpenses(tripId) {
  const local = getLocalExpenses(tripId);
  if (!tripId) return local;

  try {
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/expenses`);
    if (res.ok) {
      const remote = await res.json();
      if (Array.isArray(remote)) {
        setLocalExpenses(tripId, remote);
        return remote;
      }
    }
  } catch (err) {
    // Offline or server unavailable; continue with local cache
    console.warn('[Expenses] Sync from server unavailable, using local cache:', err.message);
  }
  return local;
}

export async function saveTripExpense(tripId, expenseData, userId = null) {
  if (!tripId) return [];

  const existing = getLocalExpenses(tripId);
  const expenseId = expenseData.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newExpense = {
    ...expenseData,
    id: expenseId,
    tripId,
    userId,
    amount: Number(expenseData.amount) || 0,
    currency: (expenseData.currency || 'USD').toUpperCase().trim(),
    category: expenseData.category || 'other',
    note: (expenseData.note || '').trim().slice(0, 255),
    date: expenseData.date || new Date().toISOString().split('T')[0],
    activityId: expenseData.activityId || null,
    paidBy: expenseData.paidBy || 'You',
    splitBetween: Array.isArray(expenseData.splitBetween) && expenseData.splitBetween.length > 0
      ? expenseData.splitBetween
      : ['You'],
    splitType: expenseData.splitType === 'custom' ? 'custom' : 'equal',
    updatedAt: new Date().toISOString()
  };

  const existingIdx = existing.findIndex(e => e.id === expenseId);
  let updated;
  if (existingIdx >= 0) {
    updated = [...existing];
    updated[existingIdx] = newExpense;
  } else {
    updated = [...existing, newExpense];
  }

  // Sort by date ascending
  updated.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
  setLocalExpenses(tripId, updated);

  // Sync with Neon in background
  fetch(`/api/trips/${encodeURIComponent(tripId)}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newExpense)
  })
    .then(r => r.ok ? r.json() : null)
    .then(remote => {
      if (Array.isArray(remote)) {
        setLocalExpenses(tripId, remote);
      }
    })
    .catch(err => console.warn('[Expenses] Neon sync warning:', err.message));

  return updated;
}

export async function deleteTripExpense(tripId, expenseId) {
  if (!tripId || !expenseId) return [];

  const existing = getLocalExpenses(tripId);
  const updated = existing.filter(e => e.id !== expenseId);
  setLocalExpenses(tripId, updated);

  // Sync deletion with Neon in background
  fetch(`/api/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
    method: 'DELETE'
  }).catch(err => console.warn('[Expenses] Neon delete sync warning:', err.message));

  return updated;
}

// Extract or generate default travelers list
export function getTripTravelers(trip) {
  if (!trip) return ['You'];
  if (Array.isArray(trip.travelers) && trip.travelers.length > 0) {
    return trip.travelers;
  }

  const numTravelers = Number(trip.formSnapshot?.travelers || trip.budgetBreakdown?.defaultTravelers) || 1;
  const list = ['You'];
  for (let i = 2; i <= numTravelers; i++) {
    list.push(`Traveler ${i}`);
  }
  return list;
}

export async function saveTripTravelers(tripId, travelers) {
  if (!tripId || !Array.isArray(travelers)) return travelers;
  const safe = travelers.map(t => String(t || '').trim().slice(0, 100)).filter(Boolean);

  fetch(`/api/trips/${encodeURIComponent(tripId)}/travelers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ travelers: safe })
  }).catch(err => console.warn('[Travelers] Neon update sync warning:', err.message));

  return safe;
}

// Validation helper
export function validateExpense({ amount, category, note }) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'Please enter a valid positive amount.' };
  }
  if (!category) {
    return { valid: false, error: 'Please select an expense category.' };
  }
  if (note && note.length > 255) {
    return { valid: false, error: 'Note must be 255 characters or fewer.' };
  }
  return { valid: true };
}

// Minimal Number of Settlements Algorithm (Debt Simplification)
export function calculateDebtsAndSettlements(expenses, travelers = []) {
  if (!Array.isArray(expenses) || expenses.length === 0 || !Array.isArray(travelers) || travelers.length === 0) {
    return { netBalances: {}, settlements: [], totalSpent: 0 };
  }

  // Net balance map (positive = owed money / creditor, negative = owes money / debtor)
  const balances = {};
  travelers.forEach(t => { balances[t] = 0; });

  let totalSpent = 0;

  expenses.forEach(exp => {
    const amt = Number(exp.amount) || 0;
    if (amt <= 0) return;
    totalSpent += amt;

    const payer = exp.paidBy || travelers[0] || 'You';
    if (balances[payer] === undefined) balances[payer] = 0;
    balances[payer] += amt;

    // Split participants
    const participants = (Array.isArray(exp.splitBetween) && exp.splitBetween.length > 0)
      ? exp.splitBetween
      : travelers;

    if (exp.splitType === 'custom') {
      participants.forEach(p => {
        const name = typeof p === 'object' && p !== null ? p.name : p;
        const share = typeof p === 'object' && p !== null && p.amount !== undefined
          ? (Number(p.amount) || 0)
          : (Number(exp.customSplits?.[name]) || 0);
        if (name) {
          if (balances[name] === undefined) balances[name] = 0;
          balances[name] -= share;
        }
      });
    } else {
      const share = amt / Math.max(participants.length, 1);
      participants.forEach(p => {
        const name = typeof p === 'object' && p !== null ? p.name : p;
        if (name) {
          if (balances[name] === undefined) balances[name] = 0;
          balances[name] -= share;
        }
      });
    }
  });

  // Separate debtors and creditors with cents rounding to prevent precision errors
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([name, bal]) => {
    const rounded = Math.round(bal * 100) / 100;
    balances[name] = rounded;
    if (rounded < -0.01) {
      debtors.push({ name, amount: -rounded });
    } else if (rounded > 0.01) {
      creditors.push({ name, amount: rounded });
    }
  });

  // Sort descending by amount to minimize total transactions
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amount, creditor.amount);
    if (settleAmount > 0.01) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: Math.round(settleAmount * 100) / 100
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount <= 0.01) dIdx++;
    if (creditor.amount <= 0.01) cIdx++;
  }

  return {
    netBalances: balances,
    settlements,
    totalSpent: Math.round(totalSpent * 100) / 100
  };
}

// CSV Export Helper
export function exportExpensesToCsv(expenses, trip) {
  if (!Array.isArray(expenses) || expenses.length === 0) return;

  const destination = trip?.destination || 'Trip';
  const headers = ['Date', 'Category', 'Amount', 'Currency', 'Note', 'Linked Activity', 'Paid By', 'Split Between'];

  const rows = expenses.map(exp => {
    const splitStr = Array.isArray(exp.splitBetween) ? exp.splitBetween.join(', ') : '';
    return [
      exp.date || '',
      exp.category || '',
      exp.amount !== undefined ? exp.amount : '',
      exp.currency || 'USD',
      `"${(exp.note || '').replace(/"/g, '""')}"`,
      `"${(exp.activityId || '').replace(/"/g, '""')}"`,
      `"${(exp.paidBy || '').replace(/"/g, '""')}"`,
      `"${splitStr.replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeDest = destination.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  link.setAttribute('href', url);
  link.setAttribute('download', `tripmind-${safeDest}-expenses.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

