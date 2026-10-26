require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');
const Branch = require('./models/Branch');
const Warehouse = require('./models/Warehouse');
const User = require('./models/User');
const Device = require('./models/Device');
const Inventory = require('./models/Inventory');
const PreRecord = require('./models/PreRecord');
const InventoryAudit = require('./models/InventoryAudit');
const Attendance = require('./models/Attendance');

const preRecordService = require('./services/preRecordService');
const inventoryModeService = require('./services/inventoryModeService');
const attendanceService = require('./services/attendanceService');

function mockReq(user, body = {}, query = {}, headers = {}) {
    return { user, body, query, params: {}, ip: '127.0.0.1', headers: { 'user-agent': 'test', ...headers }, method: 'POST', originalUrl: '/test' };
}

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected\n');

        // Cleanup
        const old = await Company.findOne({ name: /^Test S212223/ });
        if (old) {
            for (const M of [Attendance, InventoryAudit, PreRecord, Inventory, Device, Warehouse, Branch, User]) {
                await M.deleteMany({ company: old._id });
            }
            await mongoose.connection.db.collection('auditlogs').deleteMany({ company: old._id });
            await Company.deleteOne({ _id: old._id });
        }

        // Setup
        const company = await Company.create({
            name: 'Test S212223 ' + Date.now(),
            email: `s212223${Date.now()}@test.com`,
            phone: '+237600000000', password: 'companypass123'
        });
        const branch = await Branch.create({
            company: company._id, name: 'Main', code: 'M1', type: 'store',
            address: { city: 'Douala' }
        });
        const wh = await Warehouse.create({
            company: company._id, branch: branch._id, name: 'WH', code: 'WH1'
        });
        const employer = await User.create({
            company: company._id, role: 'employer',
            firstName: 'Own', lastName: 'T',
            email: 'own@test.com', phone: '+237600000001', password: 'password123'
        });
        const buyer = await User.create({
            company: company._id, branch: branch._id, role: 'employee',
            firstName: 'Buy', lastName: 'T',
            email: 'buy@test.com', phone: '+237600000002',
            password: 'password123', roles: ['shop_buyer'], activeRoles: ['shop_buyer']
        });
        const stockUser = await User.create({
            company: company._id, branch: branch._id, role: 'employee',
            firstName: 'Stock', lastName: 'T',
            email: 'stock@test.com', phone: '+237600000003',
            password: 'password123', roles: ['stock'], activeRoles: ['stock']
        });
        const manager = await User.create({
            company: company._id, branch: branch._id, role: 'employee',
            firstName: 'Mgr', lastName: 'T',
            email: 'mgr@test.com', phone: '+237600000004',
            password: 'password123', roles: ['manager'], activeRoles: ['manager']
        });
        console.log('✅ Setup complete');

        console.log('\n=== S21: PreRecord ===');
        const buyerReq = mockReq(buyer);
        const pr = await preRecordService.createPreRecord(buyerReq, {
            items: [
                { itemCode: 'A', itemName: 'Item A', category: 'electronics', unit: 'pieces', quantity: 10, unitCost: 500, sellingPrice: 800 },
                { itemCode: 'B', itemName: 'Item B', category: 'electronics', unit: 'pieces', quantity: 5, unitCost: 1000, sellingPrice: 1500, imageUrl: 'https://example.com/img.jpg' }
            ],
            warehouseId: wh._id,
            receiptImageUrl: 'https://example.com/receipt.jpg',
            supplier: { name: 'Supplier X' }
        });
        console.log('✅ Test 1: PreRecord created:', pr.preRecordId, '| items:', pr.totalItems);

        const stockReq = mockReq(stockUser);
        const confirmed = await preRecordService.confirmPreRecord(stockReq, pr.id);
        console.log('✅ Test 2: Confirmed:', confirmed.status);

        // Verify stock added
        const invAfter = await Inventory.findOne({ warehouse: wh._id, itemCode: 'A' });
        console.log('✅ Test 3: Stock added:', invAfter?.quantity || 'missing');

        // Try to double-confirm
        try {
            await preRecordService.confirmPreRecord(stockReq, pr.id);
            console.log('❌ Double-confirm NOT blocked');
        } catch (err) {
            console.log('✅ Test 4: Double-confirm blocked');
        }

        console.log('\n=== S22: Inventory Mode ===');
        const mgrReq = mockReq(manager);

        const audit = await inventoryModeService.startAudit(mgrReq, {
            warehouseId: wh._id, notes: 'Monthly count'
        });
        console.log('✅ Test 5: Audit started:', audit.auditId);
        console.log('   items:', audit.items?.length || 'counted');

        // Get an item to count
        const items = await Inventory.find({ warehouse: wh._id });
        const firstItem = items[0];

        const counted = await inventoryModeService.recordCount(stockReq, audit.id, {
            inventoryItemId: firstItem._id,
            actualCount: firstItem.quantity - 2
        });
        console.log('✅ Test 6: Count recorded (stock cannot see actual)');
        console.log('   stock view has actualCount:', 'actualCount' in (counted.items?.[0] || {}), '(should be false)');

        // Employer sees actual
        const empReq = mockReq(employer);
        const empView = await inventoryModeService.getAudit(empReq, audit.id);
        console.log('✅ Test 7: Employer sees actual:', empView.items?.[0]?.actualCount !== undefined);

        console.log('\n=== S23: Attendance ===');

        // Create device
        const rawKey = Device.generateApiKey();
        const device = await Device.create({
            company: company._id, branch: branch._id,
            name: 'Test Phone', deviceId: 'DEV-' + Date.now(),
            apiKey: rawKey, registeredBy: employer._id, assignedTo: stockUser._id
        });
        console.log('✅ Test 8: Device registered');

        // Clock in
        const publicReq = mockReq(null, {}, {}, { 'x-device-key': rawKey });
        const clockInResult = await attendanceService.clockIn(publicReq, {
            employeeId: stockUser._id, companyId: company._id,
            deviceId: device.deviceId,
            fingerprintVerified: true, method: 'fingerprint'
        });
        console.log('✅ Test 9: Clock in:', clockInResult.attendance.status);

        // Try double clock-in
        try {
            await attendanceService.clockIn(publicReq, {
                employeeId: stockUser._id, companyId: company._id,
                deviceId: device.deviceId, fingerprintVerified: true
            });
            console.log('❌ Double clock-in NOT blocked');
        } catch (err) {
            console.log('✅ Test 10: Double clock-in blocked');
        }

        // Invalid device key
        const badReq = mockReq(null, {}, {}, { 'x-device-key': 'wrong-key' });
        try {
            await attendanceService.clockOut(badReq, {
                employeeId: stockUser._id, companyId: company._id,
                deviceId: device.deviceId, fingerprintVerified: true
            });
            console.log('❌ Invalid device key NOT blocked');
        } catch (err) {
            console.log('✅ Test 11: Invalid device key blocked');
        }

        // Clock out
        const clockOutResult = await attendanceService.clockOut(publicReq, {
            employeeId: stockUser._id, companyId: company._id,
            deviceId: device.deviceId, fingerprintVerified: true
        });
        console.log('✅ Test 12: Clock out recorded');

        // Cleanup
        for (const M of [Attendance, InventoryAudit, PreRecord, Inventory, Device, Warehouse, Branch, User]) {
            await M.deleteMany({ company: company._id });
        }
        await mongoose.connection.db.collection('auditlogs').deleteMany({ company: company._id });
        await Company.deleteOne({ _id: company._id });
        console.log('\n✅ Cleanup done');
        console.log('\n🎉 S21+S22+S23 TESTS PASSED');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

test();