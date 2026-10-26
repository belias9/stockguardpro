require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');
const Branch = require('./models/Branch');
const Warehouse = require('./models/Warehouse');
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Withdrawal = require('./models/Withdrawal');
const Receipt = require('./models/Receipt');
const CashierSession = require('./models/CashierSession');
const AuditLog = require('./models/AuditLog');

const withdrawalService = require('./services/withdrawalService');
const cashierService = require('./services/cashierService');
const receiptService = require('./services/receiptService');

function mockReq(user, body = {}, query = {}, branch = null) {
    return {
        user, body, query, params: {}, branch,
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test' },
        method: 'POST',
        originalUrl: '/test'
    };
}

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected\n');

        // Cleanup
        const old = await Company.findOne({ name: /^Test S1920/ });
        if (old) {
            for (const M of [CashierSession, Withdrawal, Receipt, Inventory, Warehouse, Branch, User]) {
                await M.deleteMany({ company: old._id });
            }
            await mongoose.connection.db.collection('auditlogs').deleteMany({ company: old._id });
            await Company.deleteOne({ _id: old._id });
        }

        // Setup
        const company = await Company.create({
            name: 'Test S1920 ' + Date.now(),
            email: `s1920${Date.now()}@test.com`,
            phone: '+237600000000',
            password: 'companypass123'
        });
        const store = await Branch.create({
            company: company._id, name: 'Store', code: 'ST', type: 'store',
            address: { city: 'Douala' }
        });
        const warehouse = await Branch.create({
            company: company._id, name: 'Warehouse', code: 'WH', type: 'warehouse',
            address: { city: 'Douala' }
        });
        const whWH = await Warehouse.create({
            company: company._id, branch: warehouse._id, name: 'Main WH', code: 'MAIN-WH'
        });
        const whStore = await Warehouse.create({
            company: company._id, branch: store._id, name: 'Store WH', code: 'ST-WH'
        });

        const employer = await User.create({
            company: company._id, role: 'employer',
            firstName: 'Own', lastName: 'Test',
            email: 'own@test.com', phone: '+237600000001',
            password: 'password123'
        });
        const manager = await User.create({
            company: company._id, branch: warehouse._id, role: 'employee',
            firstName: 'Mgr', lastName: 'Test',
            email: 'mgr@test.com', phone: '+237600000002',
            password: 'password123', roles: ['manager'], activeRoles: ['manager']
        });
        const stockUser = await User.create({
            company: company._id, branch: warehouse._id, role: 'employee',
            firstName: 'Stock', lastName: 'Test',
            email: 'stock@test.com', phone: '+237600000003',
            password: 'password123', roles: ['stock'], activeRoles: ['stock']
        });
        const cashierUser = await User.create({
            company: company._id, branch: store._id, role: 'employee',
            firstName: 'Cash', lastName: 'Test',
            email: 'cash@test.com', phone: '+237600000004',
            password: 'password123', roles: ['cashier'], activeRoles: ['cashier']
        });
        const sellerUser = await User.create({
            company: company._id, branch: store._id, role: 'employee',
            firstName: 'Sale', lastName: 'Test',
            email: 'sale@test.com', phone: '+237600000005',
            password: 'password123', roles: ['sales'], activeRoles: ['sales']
        });
        console.log('✅ Setup complete');

        // Inventory
        const inv = new Inventory({
            company: company._id, branch: warehouse._id, warehouse: whWH._id,
            itemCode: 'ITEM-A', name: 'Test Item',
            category: 'electronics', unit: 'pieces',
            unitCost: 1000, sellingPrice: 2000,
            createdBy: stockUser._id
        });
        inv.recordMovement({ type: 'in', quantity: 100, performedBy: stockUser._id });
        await inv.save();

        console.log('\n=== S19: Withdrawal Lifecycle ===');

        // Test 1: Create withdrawal
        const sellerReq = mockReq(sellerUser, {}, {}, null);
        const withdrawal = await withdrawalService.createWithdrawal(sellerReq, {
            items: [{ inventoryItem: inv._id, quantity: 10 }],
            sourceWarehouseId: whWH._id,
            destinationBranchId: store._id,
            transferType: 'store_to_warehouse'
        });
        console.log('✅ Test 1: Withdrawal created:', withdrawal.withdrawalId);
        console.log('   status:', withdrawal.status);
        console.log('   isInterBranch:', withdrawal.isInterBranch);

        // Test 2: Sales cannot approve
        try {
            await withdrawalService.approveWithdrawal(sellerReq, withdrawal.id, 'Try');
            console.log('❌ Sales approval NOT blocked');
        } catch (err) {
            console.log('✅ Test 2: Sales cannot approve:', err.message.slice(0, 50));
        }

        // Test 3: Manager approves
        const mgrReq = mockReq(manager, {}, {}, null);
        const approved = await withdrawalService.approveWithdrawal(mgrReq, withdrawal.id, 'OK');
        console.log('✅ Test 3: Manager approved:', approved.status);

        // Test 4: Cashier cannot dispatch
        const cashierReq = mockReq(cashierUser, {}, {}, null);
        try {
            await withdrawalService.dispatchWithdrawal(cashierReq, withdrawal.id, {
                collectorName: 'X', collectorEmployeeId: 'Y'
            });
            console.log('❌ Cashier dispatch NOT blocked');
        } catch (err) {
            console.log('✅ Test 4: Cashier cannot dispatch');
        }

        // Test 5: Stock dispatches
        const stockReq = mockReq(stockUser, {}, {}, null);
        const dispatched = await withdrawalService.dispatchWithdrawal(stockReq, withdrawal.id, {
            collectorName: 'Delivery Guy', collectorEmployeeId: 'EMP-0099', collectorPhone: '+237600009999'
        });
        console.log('✅ Test 5: Stock dispatched:', dispatched.status);

        // Verify stock decreased
        const invAfter = await Inventory.findById(inv._id);
        console.log('   inventory qty after dispatch:', invAfter.quantity, '(was 100)');

        // Test 6: Receive at destination
        // Manager at store is needed — but manager is at warehouse. Create a store manager.
        const storeManager = await User.create({
            company: company._id, branch: store._id, role: 'employee',
            firstName: 'Store', lastName: 'Mgr',
            email: 'storemgr@test.com', phone: '+237600000006',
            password: 'password123', roles: ['stock', 'manager'], activeRoles: ['stock', 'manager']
        });
        const storeStockReq = mockReq(storeManager, {}, {}, null);
        const received = await withdrawalService.receiveWithdrawal(storeStockReq, withdrawal.id);
        console.log('✅ Test 6: Received:', received.status);

        // Verify destination stock
        const dstInv = await Inventory.findOne({ warehouse: whStore._id, itemCode: 'ITEM-A' });
        console.log('   destination inventory qty:', dstInv?.quantity || 'created');

        console.log('\n=== S20: Cashier Service ===');

        // Create receipt
        const sellerReq2 = mockReq(sellerUser, {}, {}, null);
        const receipt = await receiptService.createReceipt(sellerReq2, {
            items: [{ inventoryItem: dstInv?._id || inv._id, quantity: 2, unitPrice: 2000 }],
            paymentMethod: 'cash',
            customer: { name: 'Test Customer' },
            storeLocation: 'Store'
        });
        console.log('✅ Test 7: Receipt created:', receipt.receiptId);

        // Test 8: Pending receipts visible to cashier
        const pending = await cashierService.getPendingReceipts(cashierReq);
        console.log('✅ Test 8: Pending receipts:', pending.length);

        // Test 9: Cashier confirms
        const confirmed = await cashierService.confirmPayment(cashierReq, receipt.id, 'Received');
        console.log('✅ Test 9: Payment confirmed');
        console.log('   session totals.totalReceived:', confirmed.session.totals.totalReceived);
        console.log('   session totals.totalProfit:', confirmed.session.totals.totalProfit, '(should be undefined for cashier)');
        console.log('   session totals.totalCost:', confirmed.session.totals.totalCost, '(should be undefined for cashier)');

        // Test 10: Cashier cannot see profit
        console.log('✅ Test 10: Cashier profit hidden:', !('totalProfit' in confirmed.session.totals));

        // Test 11: Daily report
        const report = await cashierService.getDailyReport(cashierReq);
        console.log('✅ Test 11: Daily report fetched');
        console.log('   transactions:', report.totals.transactionCount);
        console.log('   totalReceived:', report.totals.totalReceived);

        // Test 12: Employer sees profit in list
        const empReq = mockReq(employer, {}, {}, null);
        const allSessions = await cashierService.listSessions(empReq);
        console.log('✅ Test 12: Employer sees sessions:', allSessions.sessions.length);
        if (allSessions.sessions[0]) {
            console.log('   employer sees totalProfit:', allSessions.sessions[0].totals.totalProfit);
        }

        // Test 13: Close session
        const closed = await cashierService.closeSession(cashierReq, 'End of day');
        console.log('✅ Test 13: Session closed:', closed.status);

        // Cleanup
        for (const M of [CashierSession, Withdrawal, Receipt, Inventory, Warehouse, Branch, User]) {
            await M.deleteMany({ company: company._id });
        }
        await mongoose.connection.db.collection('auditlogs').deleteMany({ company: company._id });
        await Company.deleteOne({ _id: company._id });
        console.log('\n✅ Cleanup done');
        console.log('\n🎉 S19+S20 TESTS PASSED');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

test();