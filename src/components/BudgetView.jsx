import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  Edit2,
  Download,
  Users,
  Check,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  X,
  Calendar,
  Tag,
  Building,
  Utensils,
  Ticket,
  Car,
  HelpCircle,
  ArrowRight,
  Calculator
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  calculateDebtsAndSettlements,
  exportExpensesToCsv,
  validateExpense
} from '../expenses';
import { CURRENCIES, formatCurrencyAmount } from '../currency';
import { CurrencyCalculatorModal } from './CurrencyCalculatorModal';

function getCategoryIcon(catId) {
  switch (catId) {
    case 'stay':
      return Building;
    case 'food':
      return Utensils;
    case 'activities':
      return Ticket;
    case 'transit':
      return Car;
    default:
      return Tag;
  }
}

export function BudgetView({
  trip,
  expenses = [],
  travelers = ['You'],
  selectedCurrencyMode = 'local',
  selectedTripCurrency,
  formatLocal,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onUpdateTravelers
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCurrencyCalc, setShowCurrencyCalc] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [newTravelerName, setNewTravelerName] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (showCurrencyCalc) setShowCurrencyCalc(false);
        else if (showAddForm) setShowAddForm(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showAddForm, showCurrencyCalc]);

  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    currency: selectedTripCurrency?.code || 'USD',
    category: 'food',
    note: '',
    date: trip?.startDate || new Date().toISOString().split('T')[0],
    activityId: '',
    paidBy: travelers[0] || 'You',
    splitBetween: travelers,
    splitType: 'equal'
  });

  // Flat list of activities from the trip to link expenses to
  const tripActivities = useMemo(() => {
    const list = [];
    if (Array.isArray(trip?.days)) {
      trip.days.forEach(day => {
        if (Array.isArray(day.activities)) {
          day.activities.forEach(act => {
            list.push({
              id: act.title,
              title: act.title,
              day: day.day,
              time: act.time,
              cost: act.cost
            });
          });
        }
      });
    }
    return list;
  }, [trip]);

  // Total estimated budget in USD
  const totalEstimatedUsd = Number(trip?.budgetBreakdown?.totalEstimatedUsd) || 0;

  // Actual spending totals converted to USD for unified comparison
  const { totalActualUsd, categoryActualsUsd, dailyActualsUsd } = useMemo(() => {
    let totalUsd = 0;
    const catMap = { stay: 0, food: 0, activities: 0, transit: 0, other: 0 };
    const dayMap = {};

    expenses.forEach(exp => {
      const rawAmt = Number(exp.amount) || 0;
      const currCode = exp.currency || 'USD';
      const rate = Number(CURRENCIES[currCode]?.rateFromUsd ?? CURRENCIES[currCode]?.rateToUsd ?? 1);
      // Convert to USD base: amount / rate
      const usdValue = rate > 0 ? rawAmt / rate : rawAmt;

      totalUsd += usdValue;

      const cat = exp.category && catMap[exp.category] !== undefined ? exp.category : 'other';
      catMap[cat] += usdValue;

      const dateKey = exp.date || 'Unspecified';
      dayMap[dateKey] = (dayMap[dateKey] || 0) + usdValue;
    });

    return {
      totalActualUsd: totalUsd,
      categoryActualsUsd: catMap,
      dailyActualsUsd: dayMap
    };
  }, [expenses]);

  // Overall Variance (Over / Under)
  const diffUsd = totalEstimatedUsd - totalActualUsd;
  const isOverBudget = diffUsd < -0.01;
  const isUnderBudget = diffUsd >= 0;
  const percentUsed = totalEstimatedUsd > 0
    ? Math.min(Math.round((totalActualUsd / totalEstimatedUsd) * 100), 999)
    : 0;

  // Category Estimates (from trip.budgetBreakdown.categories)
  const categoryEstimatesUsd = useMemo(() => {
    const raw = trip?.budgetBreakdown?.categories || {};
    return {
      stay: Number(raw.accommodation) || 0,
      food: Number(raw.dining) || 0,
      activities: Number(raw.activities) || 0,
      transit: Number(raw.transit) || 0,
      other: 0
    };
  }, [trip]);

  // Group settlements
  const settlementResult = useMemo(() => {
    return calculateDebtsAndSettlements(expenses, travelers);
  }, [expenses, travelers]);

  // Reset or initialize form
  const openNewForm = () => {
    setEditingExpenseId(null);
    setFormData({
      amount: '',
      currency: selectedTripCurrency?.code || 'USD',
      category: 'food',
      note: '',
      date: trip?.startDate || new Date().toISOString().split('T')[0],
      activityId: '',
      paidBy: travelers[0] || 'You',
      splitBetween: travelers,
      splitType: 'equal'
    });
    setFormError('');
    setShowAddForm(true);
  };

  const startEditExpense = (exp) => {
    setEditingExpenseId(exp.id);
    setFormData({
      amount: exp.amount,
      currency: exp.currency || 'USD',
      category: exp.category || 'other',
      note: exp.note || '',
      date: exp.date || '',
      activityId: exp.activityId || '',
      paidBy: exp.paidBy || travelers[0] || 'You',
      splitBetween: Array.isArray(exp.splitBetween) && exp.splitBetween.length > 0 ? exp.splitBetween : travelers,
      splitType: exp.splitType || 'equal'
    });
    setFormError('');
    setShowAddForm(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const validation = validateExpense({
      amount: formData.amount,
      category: formData.category,
      note: formData.note
    });

    if (!validation.valid) {
      setFormError(validation.error);
      return;
    }

    if (editingExpenseId) {
      await onUpdateExpense(editingExpenseId, formData);
    } else {
      await onAddExpense(formData);
    }

    setShowAddForm(false);
    setEditingExpenseId(null);
  };

  // Add Traveler
  const handleAddTraveler = async (e) => {
    e.preventDefault();
    const clean = newTravelerName.trim().slice(0, 100);
    if (!clean) return;
    if (travelers.includes(clean)) {
      setFormError(`Traveler "${clean}" is already in the list.`);
      return;
    }
    const updated = [...travelers, clean];
    await onUpdateTravelers(updated);
    setNewTravelerName('');
  };

  // Remove Traveler
  const handleRemoveTraveler = async (nameToRemove) => {
    if (travelers.length <= 1) return;
    const updated = travelers.filter(t => t !== nameToRemove);
    await onUpdateTravelers(updated);
  };

  // Toggle participant in split
  const toggleSplitParticipant = (name) => {
    const current = formData.splitBetween || [];
    if (current.includes(name)) {
      if (current.length === 1) return; // Must have at least 1 person
      setFormData({ ...formData, splitBetween: current.filter(t => t !== name) });
    } else {
      setFormData({ ...formData, splitBetween: [...current, name] });
    }
  };

  return (
    <div className="budget-view-root">
      {/* 1. Header Banner & Actions */}
      <div className="budget-header-card">
        <div className="budget-header-info">
          <div className="budget-badge-pill">
            <Wallet size={14} />
            <span>Real Budget Tracking</span>
          </div>
          <h3>Expense Tracker & Group Split</h3>
          <p>
            Track real on-the-ground spending against your AI itinerary estimate, split bills among travelers, and export anytime.
          </p>
        </div>

        <div className="budget-header-actions print-hide">
          <button
            type="button"
            className="button button-dark"
            onClick={openNewForm}
          >
            <Plus size={15} />
            <span>Log Expense</span>
          </button>
          <button
            type="button"
            className="button button-secondary-outline"
            onClick={() => setShowCurrencyCalc(true)}
            title="Open live currency converter"
          >
            <Calculator size={15} />
            <span>Currency Converter</span>
          </button>
          {expenses.length > 0 && (
            <button
              type="button"
              className="button button-secondary-outline"
              onClick={() => exportExpensesToCsv(expenses, trip)}
              title="Download expenses as CSV spreadsheet"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Overview Metrics & Progress Bar */}
      <div className="budget-summary-grid">
        <div className="budget-metric-card">
          <span className="metric-label">Estimated Budget</span>
          <strong className="metric-value">
            {formatLocal(totalEstimatedUsd, selectedTripCurrency?.code)}
          </strong>
          <small className="metric-sub">Priced by Planora</small>
        </div>

        <div className="budget-metric-card">
          <span className="metric-label">Actual Spent</span>
          <strong className="metric-value">
            {formatLocal(totalActualUsd, selectedTripCurrency?.code)}
          </strong>
          <small className="metric-sub">{expenses.length} logged expenses</small>
        </div>

        <div className={`budget-metric-card ${isOverBudget ? 'over-budget' : 'under-budget'}`}>
          <span className="metric-label">Status</span>
          <strong className="metric-value status-pill">
            {isOverBudget ? (
              <>
                <TrendingUp size={16} />
                <span>Over by {formatLocal(Math.abs(diffUsd), selectedTripCurrency?.code)}</span>
              </>
            ) : (
              <>
                <TrendingDown size={16} />
                <span>Under by {formatLocal(Math.abs(diffUsd), selectedTripCurrency?.code)}</span>
              </>
            )}
          </strong>
          <small className="metric-sub">
            {isOverBudget
              ? `${percentUsed}% of budget reached`
              : `${100 - percentUsed}% buffer remaining`}
          </small>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="budget-progress-container">
        <div className="budget-progress-labels">
          <span>Overall Budget Progress</span>
          <span><strong>{percentUsed}%</strong> used</span>
        </div>
        <div className="budget-progress-track">
          <div
            className={`budget-progress-fill ${isOverBudget ? 'overflow' : ''}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
            role="progressbar"
            aria-valuenow={percentUsed}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
      </div>

      {/* Add / Edit Expense Modal Dialog */}
      {showAddForm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-modal-title"
          onClick={() => setShowAddForm(false)}
        >
          <div
            className="modal-card expense-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="expense-modal-title">
                  {editingExpenseId ? 'Edit Expense' : 'Log New Expense'}
                </h3>
                <p className="modal-subtitle">Track spending and keep group balances fair</p>
              </div>
              <button
                type="button"
                className="icon-btn-ghost"
                onClick={() => setShowAddForm(false)}
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="modal-form-shell">
              <div className="modal-scroll-body">
                {formError && (
                  <div className="form-error-banner" role="alert">
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

              <div className="expense-form-row">
                <div className="field">
                  <div className="field-label-row">
                    <label className="field-label" htmlFor="expense-amount">
                      Amount <span aria-hidden="true">*</span>
                    </label>
                    <button
                      type="button"
                      className="calc-helper-link"
                      onClick={() => setShowCurrencyCalc(true)}
                      title="Convert currency"
                    >
                      <Calculator size={11} />
                      <span>Convert</span>
                    </button>
                  </div>
                  <div className="calc-input-wrap">
                    <span className="calc-curr-symbol">
                      {CURRENCIES[formData.currency]?.symbol || '$'}
                    </span>
                    <input
                      id="expense-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="expense-currency">Currency</label>
                  <select
                    id="expense-currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    {Object.values(CURRENCIES).map(curr => (
                      <option key={curr.code} value={curr.code}>
                        {curr.flag} {curr.code} ({curr.symbol}) - {curr.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="expense-form-row">
                <div className="field">
                  <label className="field-label" htmlFor="expense-category">Category</label>
                  <select
                    id="expense-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="expense-date">Date</label>
                  <input
                    id="expense-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="expense-note">
                  Description / Note (Optional)
                </label>
                <input
                  id="expense-note"
                  type="text"
                  maxLength={255}
                  placeholder="e.g. Dinner at Gion teahouse, Bullet train pass"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

              {tripActivities.length > 0 && (
                <div className="field">
                  <label className="field-label" htmlFor="expense-activity">
                    Link to Planned Activity (Optional)
                  </label>
                  <select
                    id="expense-activity"
                    value={formData.activityId}
                    onChange={(e) => setFormData({ ...formData, activityId: e.target.value })}
                  >
                    <option value="">-- None (General Expense) --</option>
                    {tripActivities.map((act, i) => (
                      <option key={i} value={act.title}>
                        Day {act.day}: {act.title} {act.cost > 0 ? `(Est: $${act.cost})` : '(Free)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Group Split Fields */}
              <div className="split-fields-box">
                <div className="expense-form-row">
                  <div className="field">
                    <label className="field-label" htmlFor="expense-paid-by">Paid By</label>
                    <select
                      id="expense-paid-by"
                      value={formData.paidBy}
                      onChange={(e) => setFormData({ ...formData, paidBy: e.target.value })}
                    >
                      {travelers.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Split Between</label>
                  <div className="split-checkboxes-grid">
                    {travelers.map(t => (
                      <label key={t} className="split-checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.splitBetween?.includes(t)}
                          onChange={() => toggleSplitParticipant(t)}
                        />
                        <span>{t}</span>
                      </label>
                    ))}
                  </div>
                  <small className="field-hint">
                    Split equally among {formData.splitBetween?.length || 1} selected traveler(s).
                  </small>
                </div>
              </div>
            </div>

            <div className="modal-footer">
                <button
                  type="button"
                  className="button button-secondary-outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-dark">
                  <Check size={16} />
                  <span>{editingExpenseId ? 'Save Changes' : 'Log Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Category Breakdown Grid */}
      <div className="budget-section-card">
        <div className="section-card-header">
          <h4>Category Breakdown: Estimate vs Actual</h4>
          <small className="section-card-sub">See where your funds are going</small>
        </div>

        <div className="category-breakdown-grid">
          {EXPENSE_CATEGORIES.map(cat => {
            const Icon = getCategoryIcon(cat.id);
            const estimated = categoryEstimatesUsd[cat.id] || 0;
            const actual = categoryActualsUsd[cat.id] || 0;
            const catPercent = estimated > 0 ? Math.round((actual / estimated) * 100) : 0;
            const catOver = actual > estimated && estimated > 0;

            return (
              <div key={cat.id} className="category-stat-row">
                <div className="cat-stat-meta">
                  <div className="cat-icon-badge" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="cat-name-block">
                    <strong>{cat.label}</strong>
                    <span className="cat-variance-hint">
                      {actual === 0
                        ? 'No expenses logged'
                        : catOver
                        ? `Over by ${formatLocal(actual - estimated, selectedTripCurrency?.code)}`
                        : `${formatLocal(estimated - actual, selectedTripCurrency?.code)} remaining`}
                    </span>
                  </div>
                </div>

                <div className="cat-amounts-block">
                  <div className="cat-values">
                    <span>Actual: <strong>{formatLocal(actual, selectedTripCurrency?.code)}</strong></span>
                    <span className="cat-est-sub">Est: {estimated > 0 ? formatLocal(estimated, selectedTripCurrency?.code) : '-'}</span>
                  </div>
                  {estimated > 0 && (
                    <div className="cat-mini-bar">
                      <div
                        className={`cat-mini-fill ${catOver ? 'overflow' : ''}`}
                        style={{ width: `${Math.min(catPercent, 100)}%`, backgroundColor: catOver ? '#d1533b' : cat.color }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Group Split & Who Owes Whom */}
      <div className="budget-section-card">
        <div className="section-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: 'var(--green)' }} />
            <h4>Group Split &amp; Settlements</h4>
          </div>
          <small className="section-card-sub">
            Calculated with minimal settlements algorithm
          </small>
        </div>

        <div className="travelers-manager-box">
          <div className="travelers-pill-list">
            {travelers.map(name => (
              <span key={name} className="traveler-pill">
                <span>{name}</span>
                {travelers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTraveler(name)}
                    aria-label={`Remove traveler ${name}`}
                    className="traveler-remove-btn"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>

          <form onSubmit={handleAddTraveler} className="traveler-add-form print-hide">
            <input
              type="text"
              placeholder="Add another traveler..."
              value={newTravelerName}
              onChange={(e) => setNewTravelerName(e.target.value)}
              maxLength={50}
            />
            <button type="submit" className="button button-dark btn-sm">
              <Plus size={14} />
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Who Owes Whom Summary */}
        <div className="settlement-summary-box">
          <h5>Settlement Summary</h5>
          {settlementResult.settlements.length === 0 ? (
            <p className="settlement-empty-hint">
              {expenses.length === 0
                ? 'No expenses logged yet. Once you log shared expenses, settlements will calculate automatically.'
                : 'All accounts settled! Everyone has paid their fair share.'}
            </p>
          ) : (
            <div className="settlements-list">
              {settlementResult.settlements.map((s, idx) => (
                <div key={idx} className="settlement-item">
                  <span className="settler-name debtor">{s.from}</span>
                  <div className="settle-arrow">
                    <span>owes</span>
                    <ArrowRight size={14} />
                  </div>
                  <span className="settler-name creditor">{s.to}</span>
                  <strong className="settle-amount">
                    {formatLocal(s.amount, selectedTripCurrency?.code)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Logged Expenses Table / List */}
      <div className="budget-section-card">
        <div className="section-card-header">
          <h4>Expense Log ({expenses.length})</h4>
          <small className="section-card-sub">Chronological list of all logged items</small>
        </div>

        {expenses.length === 0 ? (
          <div className="empty-expenses-state">
            <Wallet size={36} style={{ color: 'var(--muted)', opacity: 0.6 }} />
            <p>No actual expenses logged for this trip yet.</p>
            <button
              type="button"
              className="button button-dark btn-sm"
              onClick={openNewForm}
            >
              <Plus size={14} />
              <span>Log First Expense</span>
            </button>
          </div>
        ) : (
          <div className="expenses-table-wrap">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description &amp; Activity</th>
                  <th>Paid By</th>
                  <th>Split</th>
                  <th>Amount</th>
                  <th className="print-hide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => {
                  const Icon = getCategoryIcon(exp.category);
                  const isLink = Boolean(exp.activityId);

                  return (
                    <tr key={exp.id}>
                      <td className="expense-date-col">
                        <div className="date-cell">
                          <Calendar size={13} style={{ color: 'var(--muted)' }} />
                          <span>{exp.date || '-'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="cat-badge-pill">
                          <Icon size={12} />
                          <span>{exp.category}</span>
                        </span>
                      </td>
                      <td>
                        <div className="expense-desc-cell">
                          <strong>{exp.note || 'Expense'}</strong>
                          {isLink && (
                            <span className="activity-link-pill" title={`Linked to planned activity: ${exp.activityId}`}>
                              🔗 {exp.activityId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="paid-by-pill">{exp.paidBy || 'You'}</span>
                      </td>
                      <td>
                        <small className="split-summary-text">
                          {Array.isArray(exp.splitBetween) && exp.splitBetween.length > 0
                            ? `${exp.splitBetween.length} people`
                            : 'All'}
                        </small>
                      </td>
                      <td className="expense-amount-col">
                        <strong>
                          {exp.currency !== 'USD'
                            ? `${exp.currency} ${Number(exp.amount).toLocaleString()}`
                            : `$${Number(exp.amount).toLocaleString()}`}
                        </strong>
                      </td>
                      <td className="print-hide actions-col">
                        <div className="action-buttons-cell">
                          <button
                            type="button"
                            className="icon-action-btn"
                            title="Edit expense"
                            onClick={() => startEditExpense(exp)}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-action-btn danger"
                            title="Delete expense"
                            onClick={() => {
                              if (window.confirm('Delete this expense?')) {
                                onDeleteExpense(exp.id);
                              }
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CurrencyCalculatorModal
        isOpen={showCurrencyCalc}
        onClose={() => setShowCurrencyCalc(false)}
        defaultFrom="USD"
        defaultTo={formData.currency || selectedTripCurrency?.code || 'JPY'}
      />
    </div>
  );
}

export default BudgetView;

