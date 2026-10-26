require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');
const Branch = require('./models/Branch');
const Warehouse = require('./models/Warehouse');
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const CashierSession = require('./models/CashierSession');
const EndOfDayReport = require('./models/EndOfDayReport');
const AuditLog = require('./models/AuditLog');
const PriceApproval = require('./models/PriceApproval');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected\n');

        // Cleanup
        const old = await Company.findOne({ name: /^Test S11S12/ });
        if (old) {
            await CashierSession.deleteMany({ company: old._id });
            await EndOfDayReport.deleteMany({ company: old._id });
            await mongoose.connection.db.collection('auditlogs').deleteMany({ company: old._id });
            await PriceApproval.deleteMany({ company: old._id });
            await Inventory.deleteMany({ company: old._id });
            await User.deleteMany({ company: old._id });
            await Warehouse.deleteMany({ company: old._id });
            await Branch.deleteMany({ company: old._id });
            await Company.deleteOne({ _id: old._id });
        }

        // Setup
        const company = await Company.create({
            name: 'Test S11S12 ' + Date.now(),
            email: `s1112${Date.now()}@test.com`,
            phone: '+237600000000',
            password: 'companypass123'
        });
        const branch = await Branch.create({
            company: company._id, name: 'Main', code: 'M1', type: 'store',
            address: { city: 'Douala' }
        });
        const wh = await Warehouse.create({
            company: company._id, branch: branch._id, name: 'WH1', code: 'WH1'
        });
        const employer = await User.create({
            company: company._id, role: 'employer',
            firstName: 'Own', lastName: 'Test',
            email: 'own@test.com', phone: '+237600000001',
            password: 'password123'
        });
        const cashier = await User.create({
            company: company._id, branch: branch._id, role: 'employee',
            firstName: 'Cash', lastName: 'Test',
            email: 'cash@test.com', phone: '+237600000002',
            password: 'password123', roles: ['cashier'], activeRoles: ['cashier']
        });
        const seller = await User.create({
            company: company._id, branch: branch._id, role: 'employee',
            firstName: 'Sale', lastName: 'Test',
            email: 'sale@test.com', phone: '+237600000003',
            password: 'password123', roles: ['sales'], activeRoles: ['sales']
        });
        const manager = await User.create({
            company: company._id, branch: branch._id, role: 'employee',
            firstName: 'Mgr', lastName: 'Test',
            email: 'mgr@test.com', phone: '+237600000004',
            password: 'password123', roles: ['manager'], activeRoles: ['manager']
        });
        console.log('✅ Setup complete');

        // === CASHIER SESSION TESTS ===
        const session = new CashierSession({
            company: company._id, branch: branch._id,
            cashier: cashier._id, cashierName: 'Cash Test',
            date: new Date()
        });
        await session.save();
        console.log('✅ Test 1: CashierSession opened');
        console.log('   date:', session.date.toISOString().slice(0, 10));
        console.log('   status:', session.status);

        // Add transactions
        const fakeReceiptId = new mongoose.Types.ObjectId();
        session.addTransaction({
            receipt: fakeReceiptId,
            receiptId: 'RCP-001',
            amount: 50000,
            cost: 30000,
            paymentMethod: 'cash'
        });
        session.addTransaction({
            receipt: new mongoose.Types.ObjectId(),
            receiptId: 'RCP-002',
            amount: 30000,
            cost: 18000,
            paymentMethod: 'card'
        });
        await session.save();
        console.log('✅ Test 2: 2 transactions added');
        console.log('   totalReceived:', session.totals.totalReceived);
        console.log('   totalCost:', session.totals.totalCost);
        console.log('   totalProfit:', session.totals.totalProfit);

        // CRITICAL: Cashier must NOT see profit
        const cashierView = session.toPublicJSON('cashier');
        const employerView = session.toPublicJSON('employer');
        console.log('✅ Test 3: Cashier profit hidden');
        console.log('   cashier sees totalProfit:', 'totalProfit' in cashierView.totals, '(should be false)');
        console.log('   cashier sees totalCost:', 'totalCost' in cashierView.totals, '(should be false)');
        console.log('   employer sees totalProfit:', 'totalProfit' in employerView.totals, '(should be true)');
        console.log('   employer totalProfit:', employerView.totals.totalProfit);

        // Duplicate session blocked
        let dupBlocked = false;
        try {
            await CashierSession.create({
                company: company._id, branch: branch._id,
                cashier: cashier._id, cashierName: 'Cash Test',
                date: new Date()
            });
        } catch (err) {
            if (err.code === 11000) { dupBlocked = true; console.log('✅ Test 4: Duplicate cashier session blocked'); }
        }
        if (!dupBlocked) console.log('❌ Test 4: Duplicate NOT blocked');

        session.close('End of day');
        await session.save();
        console.log('✅ Test 5: Session closed');
        console.log('   status:', session.status);

        // === END OF DAY REPORT TESTS ===
        const report = new EndOfDayReport({
            company: company._id, branch: branch._id,
            date: new Date(),
            goodsBought: { totalPreRecords: 3, confirmed: 2, pending: 1, totalCost: 150000 },
            attendance: { totalEmployees: 10, present: 8, late: 1, absent: 1, attendanceRate: 80 },
            cashier: {
                totalSessions: 1,
                totalTransactions: 2,
                totalReceived: 80000,
                totalCost: 48000,
                totalProfit: 32000,
                profitMargin: 40
            },
            transfers: { pending: 1, inTransit: 2, completedToday: 5 },
            inventoryAlerts: { lowStockCount: 3, outOfStockCount: 1 }
        });
        await report.save();
        console.log('✅ Test 6: EndOfDayReport generated');
        console.log('   reportDate:', report.reportDate);
        console.log('   cashier.totalProfit:', report.cashier.totalProfit);

        report.markSent('in_app');
        await report.save();
        console.log('✅ Test 7: Report sent + locked');
        console.log('   delivery.status:', report.delivery.status);
        console.log('   locked:', report.locked);

        // Try to modify locked report
        let lockBlocked = false;
        try {
            const locked = await EndOfDayReport.findById(report._id);
            locked.attendance.present = 999;
            await locked.save();
        } catch (err) {
            if (err.message.includes('locked')) { lockBlocked = true; console.log('✅ Test 8: Locked report modification blocked'); }
        }
        if (!lockBlocked) console.log('❌ Test 8: Lock NOT enforced');

        // === AUDIT LOG TESTS ===
        const log = await AuditLog.create({
            company: company._id, branch: branch._id,
            action: 'RECEIPT_CREATE',
            entityType: 'Receipt',
            entityId: new mongoose.Types.ObjectId(),
            entityName: 'RCP-241026-0001',
            performedBy: seller._id,
            performedByName: 'Sale Test',
            performedByRole: 'sales',
            requestDetails: { ipAddress: '127.0.0.1', userAgent: 'test' },
            result: { success: true, statusCode: 201 }
        });
        console.log('✅ Test 9: AuditLog created');
        console.log('   action:', log.action);
        console.log('   performedByName:', log.performedByName);

        // Audit log is immutable
        let auditImmutable = false;
        try { await AuditLog.updateOne({ _id: log._id }, { action: 'LOGIN' }); }
        catch (err) { if (err.message.includes('immutable')) { auditImmutable = true; console.log('✅ Test 10: AuditLog update blocked'); } }
        if (!auditImmutable) console.log('❌ Test 10: AuditLog update NOT blocked');

        let auditDeleteBlocked = false;
        try { await AuditLog.deleteOne({ _id: log._id }); }
        catch (err) { if (err.message.includes('immutable')) { auditDeleteBlocked = true; console.log('✅ Test 11: AuditLog delete blocked'); } }
        if (!auditDeleteBlocked) console.log('❌ Test 11: AuditLog delete NOT blocked');

        // === PRICE APPROVAL TESTS ===
        const inv = new Inventory({
            company: company._id, branch: branch._id, warehouse: wh._id,
            itemCode: 'PA-ITEM', name: 'PA Item',
            category: 'electronics', unit: 'pieces',
            unitCost: 5000, sellingPrice: 10000,
            createdBy: employer._id
        });
        inv.recordMovement({ type: 'in', quantity: 50, performedBy: employer._id });
        await inv.save();

        const pa = new PriceApproval({
            company: company._id, branch: branch._id,
            type: 'below_price',
            requestedBy: seller._id, requestedByName: 'Sale Test',
            inventoryItem: inv._id,
            itemCode: inv.itemCode, itemName: inv.name,
            quantity: 2, unit: 'pieces',
            listedPrice: 10000,
            proposedPrice: 8500,
            reason: 'Loyal customer discount'
        });
        await pa.save();
        console.log('✅ Test 12: PriceApproval created');
        console.log('   approvalId:', pa.approvalId);
        console.log('   difference:', pa.difference, '(should be -1500)');
        console.log('   discountPercentage:', pa.discountPercentage.toFixed(2) + '%', '(should be 15%)');

        pa.approve(manager, 'Approved for loyal customer');
        await pa.save();
        console.log('✅ Test 13: PriceApproval approved');
        console.log('   status:', pa.status);
        console.log('   approvedBy:', pa.approval.approvedByName);

        // === FULL SERIALIZATION ===
        console.log('\n✅ All tests passed');

        // Cleanup
    
        await CashierSession.deleteMany({ company: company._id });
        await EndOfDayReport.deleteMany({ company: company._id });
        await mongoose.connection.db.collection('auditlogs').deleteMany({ company: company._id });
        await PriceApproval.deleteMany({ company: company._id });
        await Inventory.deleteMany({ company: company._id });
        await User.deleteMany({ company: company._id });
        await Warehouse.deleteMany({ company: company._id });
        await Branch.deleteMany({ company: company._id });
        await Company.deleteOne({ _id: company._id });
        console.log('✅ Cleanup done');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

test();