const { assertBalanced, SOURCE_POSTINGS } = require('../services/ledgerService');
const syncService = require('../services/syncService');
const mongoose = require('mongoose');
const JournalEntry = require('../models/JournalEntry');

describe('double-entry journal validation', () => {
    test('Mongoose journal model rejects unbalanced posted data', async () => {
        const company = new mongoose.Types.ObjectId();
        const branch = new mongoose.Types.ObjectId();
        const user = new mongoose.Types.ObjectId();
        const account = new mongoose.Types.ObjectId();
        const entry = new JournalEntry({
            company, branch, entryDate: new Date(), memo: 'Invalid test journal', createdBy: user,
            lines: [
                { account, accountCode: '1000', accountName: 'Cash', debit: 20, credit: 0 },
                { account, accountCode: '4000', accountName: 'Income', debit: 0, credit: 19 }
            ]
        });
        await expect(entry.validate()).rejects.toThrow('Journal entry debits must equal credits');
    });

    test('accepts balanced values using whole cents', () => {
        expect(assertBalanced([
            { debit: 12.344, credit: 0 },
            { debit: 0, credit: 12.34 }
        ])).toEqual({ totalDebit: 12.34, totalCredit: 12.34 });
    });

    test('rejects unbalanced amounts', () => {
        expect(() => assertBalanced([
            { debit: 100, credit: 0 },
            { debit: 0, credit: 99.99 }
        ])).toThrow('Journal entry debits must equal credits');
    });

    test('rejects a line with both sides or neither side', () => {
        expect(() => assertBalanced([{ debit: 1, credit: 1 }, { debit: 0, credit: 0 }])).toThrow('Each journal line');
    });

    test('every legacy accounting event has balanced debit and credit posting rules', () => {
        expect(Object.keys(SOURCE_POSTINGS).sort()).toEqual([
            'credit_payment', 'credit_sale', 'expense', 'income', 'loan_issued',
            'loan_received', 'loan_recovered', 'loan_repayment'
        ]);
        for (const sides of Object.values(SOURCE_POSTINGS)) {
            expect(sides).toHaveLength(2);
            expect(sides.filter(([, side]) => side === 'debit')).toHaveLength(1);
            expect(sides.filter(([, side]) => side === 'credit')).toHaveLength(1);
        }
    });
});

describe('sync message signatures', () => {
    test('creates a stable SHA-256 HMAC for a payload', () => {
        const body = { localId: 'queue-event-00000001', action: 'CREATE' };
        const secret = 'a-test-only-sync-secret-long-enough-for-hmac';
        expect(syncService.signPayload(body, secret)).toMatch(/^[a-f0-9]{64}$/);
        expect(syncService.signPayload(body, secret)).toBe(syncService.signPayload(body, secret));
        expect(syncService.signPayload(body, secret)).not.toBe(syncService.signPayload(body, `${secret}-different`));
    });
    test('rejects missing or short signing secrets', () => {
        expect(() => syncService.signPayload({}, '')).toThrow('SYNC_SECRET must contain at least 32 characters');
        expect(() => syncService.signPayload({}, 'short')).toThrow('SYNC_SECRET must contain at least 32 characters');
    });
});
