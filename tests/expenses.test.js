import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDebtsAndSettlements } from '../src/expenses.js';

describe('Debt Settlement Calculation (Phase 1)', () => {
  it('should return empty settlements when there are no expenses', () => {
    const travelers = ['Alice', 'Bob', 'Charlie'];
    const result = calculateDebtsAndSettlements([], travelers);
    assert.deepEqual(result.settlements, []);
    assert.equal(result.totalSpent, 0);
  });

  it('should calculate accurate equal splits for a single expense', () => {
    const travelers = ['Alice', 'Bob', 'Charlie'];
    const expenses = [
      {
        id: 'exp1',
        amount: 90,
        paidBy: 'Alice',
        splitBetween: ['Alice', 'Bob', 'Charlie'],
        splitType: 'equal'
      }
    ];

    const result = calculateDebtsAndSettlements(expenses, travelers);
    assert.equal(result.totalSpent, 90);
    // Alice paid 90, each owes 30. Alice is owed +60, Bob is -30, Charlie is -30.
    assert.equal(result.settlements.length, 2);

    const bobPays = result.settlements.find(s => s.from === 'Bob' && s.to === 'Alice');
    const charliePays = result.settlements.find(s => s.from === 'Charlie' && s.to === 'Alice');

    assert.ok(bobPays);
    assert.equal(bobPays.amount, 30);
    assert.ok(charliePays);
    assert.equal(charliePays.amount, 30);
  });

  it('should minimize transactions with multiple payers and cross-expenses', () => {
    const travelers = ['Alice', 'Bob', 'Charlie'];
    const expenses = [
      { id: '1', amount: 60, paidBy: 'Alice', splitBetween: ['Alice', 'Bob', 'Charlie'] }, // each owes 20
      { id: '2', amount: 30, paidBy: 'Bob', splitBetween: ['Alice', 'Bob', 'Charlie'] },   // each owes 10
    ];

    // Net:
    // Alice: +60 paid, owes 20+10 = 30 => Net: +30
    // Bob: +30 paid, owes 20+10 = 30 => Net: 0
    // Charlie: 0 paid, owes 20+10 = 30 => Net: -30
    const result = calculateDebtsAndSettlements(expenses, travelers);
    assert.equal(result.totalSpent, 90);
    assert.equal(result.settlements.length, 1);
    assert.equal(result.settlements[0].from, 'Charlie');
    assert.equal(result.settlements[0].to, 'Alice');
    assert.equal(result.settlements[0].amount, 30);
  });

  it('should handle custom split allocations', () => {
    const travelers = ['Alice', 'Bob'];
    const expenses = [
      {
        id: '1',
        amount: 100,
        paidBy: 'Alice',
        splitType: 'custom',
        splitBetween: [
          { name: 'Alice', amount: 25 },
          { name: 'Bob', amount: 75 }
        ]
      }
    ];

    const result = calculateDebtsAndSettlements(expenses, travelers);
    assert.equal(result.settlements.length, 1);
    assert.equal(result.settlements[0].from, 'Bob');
    assert.equal(result.settlements[0].to, 'Alice');
    assert.equal(result.settlements[0].amount, 75);
  });
});

