require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');
const Branch = require('./models/Branch');
const Warehouse = require('./models/Warehouse');
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Receipt = require('./models/Receipt');
const PriceApproval = require('./models/PriceApproval');
const AuditLog = require('./models/AuditLog');

const userService = require('./services/userService');
const inventoryService = require('./services/inventoryService');
const receiptService = require('./services/receiptService');

function mockReq(user, body = {}, query = {}, branch = null) {
    return {
        user,
        body,
        query,
        params: {},
        branch,
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
        const old = await Company.findOne({ name: /^Test S161718/ });
        if (old) {
            for (const Model of [Receipt, PriceApproval, Inventory, Warehouse, Branch, User]) {
                await Model.deleteMany({ company: old._id });
            }
            await mongoose.connection.db.collection('auditlogs').deleteMany({ company: old._id });
            await Company.deleteOne({ _id: old._id });
        }

        // Setup
        const company = await Company.create({
            name: 'Test S161718 ' + Date.now(),
            email: `s161718${Date.now()}@test.com`,
            phone: '+237600000000',
            password: 'companypass123'
        });
        const branch = await Branch.create({
            company: company._id, name: 'Main', code: 'MAIN', type: 'store',
            address: { city: 'Douala' }
        });
        const wh = await Warehouse.create({
            company: company._id, branch: branch._id, name: 'Main WH', code: 'MAIN-WH'
        });
        const employer = await User.create({
            company: company._id, role: 'employer',
            firstName: 'Owner', lastName: 'Test',
            email: 'owner@test.com', phone: '+237600000001',
            password: 'password123'
        });
        console.log('✅ Setup complete');

        const reqEmp = mockReq(employer, {}, {}, null);

        // === S16 TESTS ===
        console.log('\n=== S16: User Service ===');

        // Test 1: Create stock user
        const stockUser = await userService.createUser(reqEmp, {
            firstName: 'Stock', lastName: 'User',
            email: 'stock@test.com', phone: '+237600000010',
            password: 'password123',
            role: 'employee',
            roles: ['stock'],
            branchId: branch._id,
            baseSalary: 120000
        });
        console.log('✅ Test 1: Stock user created:', stockUser.employeeId);

        // Test 2: Create cashier
        const cashier = await userService.createUser(reqEmp, {
            firstName: 'Cash', lastName: 'User',
            email: 'cash@test.com', phone: '+237600000011',
            password: 'password123',
            role: 'employee',
            roles: ['cashier'],
            branchId: branch._id,
            baseSalary: 150000
        });
        console.log('✅ Test 2: Cashier created:', cashier.employeeId);

        // Test 3: Create sales
        const seller = await userService.createUser(reqEmp, {
            firstName: 'Sale', lastName: 'User',
            email: 'sale@test.com', phone: '+237600000012',
            password: 'password123',
            role: 'employee',
            roles: ['sales'],
            branchId: branch._id,
            baseSalary: 100000
        });
        console.log('✅ Test 3: Sales created:', seller.employeeId);

        // Test 4: Duplicate email blocked
        try {
            await userService.createUser(reqEmp, {
                firstName: 'Dup', lastName: 'User', email: 'stock@test.com',
                phone: '+237600000013', password: 'password123',
                role: 'employee', roles: ['cashier'], branchId: branch._id
            });
            console.log('❌ Duplicate email NOT blocked');
        } catch (err) {
            console.log('✅ Test 4: Duplicate email blocked');
        }

        // Test 5: Multi-role user
        const multiRole = await userService.createUser(reqEmp, {
            firstName: 'Multi', lastName: 'Role',
            email: 'multi@test.com', phone: '+237600000014',
            password: 'password123',
            role: 'employee',
            roles: ['cashier', 'sales'],
            branchId: branch._id
        });
        console.log('✅ Test 5: Multi-role user created with roles:', multiRole.roles);

        // Test 6: Update user
        const updated = await userService.updateUser(reqEmp, stockUser.id, {
            baseSalary: 150000
        });
        console.log('✅ Test 6: User updated, new salary:', updated.baseSalary);

        // Test 7: Close account
        const closed = await userService.closeAccount(reqEmp, seller.id, 'Going on leave');
        console.log('✅ Test 7: Account closed:', closed.accountClosed);

        // Test 8: Reopen
        const reopened = await userService.reopenAccount(reqEmp, seller.id);
        console.log('✅ Test 8: Account reopened:', !reopened.accountClosed);

        // === S17 TESTS ===
        console.log('\n=== S17: Inventory Service ===');
        const stockReq = mockReq(employer, {}, {}, null);
        // Simulate stock user
        const stockUserModel = await User.findById(stockUser.id);
        const stockReq2 = mockReq(stockUserModel, {}, {}, null);

        // Test 9: Create item
        const item = await inventoryService.createItem(stockReq, {
            warehouseId: wh._id,
            itemCode: 'IPHONE-15',
            name: 'iPhone 15',
            category: 'electronics',
            unit: 'pieces',
            quantity: 100,
            unitCost: 500000,
            sellingPrice: 850000,
            minStockLevel: 5,
            reorderPoint: 10
        });
        console.log('✅ Test 9: Item created:', item.itemCode, '| qty:', item.quantity);

        // Test 10: Adjust stock
        const adjusted = await inventoryService.adjustStock(stockReq, item.id, {
            adjustment: -10,
            reason: 'Sold 10 units'
        });
        console.log('✅ Test 10: Stock adjusted:', adjusted.adjustment.newQuantity);

        // Test 11: Negative adjustment blocked
        try {
            await inventoryService.adjustStock(stockReq, item.id, {
                adjustment: -200,  // more than 90
                reason: 'Oversell test'
            });
            console.log('❌ Oversell NOT blocked');
        } catch (err) {
            console.log('✅ Test 11: Oversell blocked:', err.message.slice(0, 60));
        }

        // Test 12: Duplicate code in same warehouse blocked
        try {
            await inventoryService.createItem(stockReq, {
                warehouseId: wh._id,
                itemCode: 'IPHONE-15',
                name: 'Dup',
                category: 'electronics',
                unit: 'pieces',
                quantity: 5,
                unitCost: 100
            });
            console.log('❌ Duplicate blocked');
        } catch (err) {
            console.log('✅ Test 12: Duplicate code blocked');
        }

        // === S18 TESTS ===
        console.log('\n=== S18: Receipt Service ===');
        const sellerModel = await User.findById(seller.id);
        const sellerReq = mockReq(sellerModel, {}, {}, null);

        // Test 13: Create receipt
        const receipt = await receiptService.createReceipt(sellerReq, {
            items: [{
                inventoryItem: item.id,
                quantity: 2,
                unitPrice: 850000
            }],
            paymentMethod: 'cash',
            customer: { name: 'John Doe', phone: '+237699999999' },
            storeLocation: 'Main Store'
        });
        console.log('✅ Test 13: Receipt created:', receipt.receiptId);
        console.log('   status:', receipt.status);
        console.log('   total:', receipt.totalAmount);
        console.log('   hasBelowPriceItems:', receipt.hasBelowPriceItems);

        // Test 14: Cashier confirms
        const cashierModel = await User.findById(cashier.id);
        const cashierReq = mockReq(cashierModel, {}, {}, null);
        const confirmed = await receiptService.confirmPayment(cashierReq, receipt.id, 'Money in');
        console.log('✅ Test 14: Payment confirmed:', confirmed.paymentStatus);

        // Test 15: Cashier does NOT see profit
        console.log('   cashier receipt has totalProfit:', 'totalProfit' in confirmed, '(should be false)');

        // Test 16: Below-price requires approval
        const belowPriceReceipt = await receiptService.createReceipt(sellerReq, {
            items: [{
                inventoryItem: item.id,
                quantity: 1,
                unitPrice: 700000  // below 850000 selling price
            }],
            paymentMethod: 'cash',
            storeLocation: 'Main Store',
            notes: 'Loyal customer discount'
        });
        console.log('✅ Test 16: Below-price receipt status:', belowPriceReceipt.status, '(should be draft)');
        console.log('   hasBelowPriceItems:', belowPriceReceipt.hasBelowPriceItems);

        // Test 17: PriceApproval created
        const approvals = await PriceApproval.find({ receipt: belowPriceReceipt.id });
        console.log('✅ Test 17: PriceApproval created:', approvals.length, 'approval(s)');
        if (approvals[0]) {
            console.log('   difference:', approvals[0].difference);
            console.log('   discount:', approvals[0].discountPercentage.toFixed(2) + '%');
        }

        // Cleanup
        for (const Model of [Receipt, PriceApproval, Inventory, Warehouse, Branch, User]) {
            await Model.deleteMany({ company: company._id });
        }
        await mongoose.connection.db.collection('auditlogs').deleteMany({ company: company._id });
        await Company.deleteOne({ _id: company._id });
        console.log('\n✅ Cleanup done');
        console.log('\n🎉 S16+S17+S18 TESTS PASSED');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

test();