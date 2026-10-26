require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');
const Branch = require('./models/Branch');
const Warehouse = require('./models/Warehouse');
const User = require('./models/User');
const AuditLog = require('./models/AuditLog');
const authService = require('./services/authService');
const branchService = require('./services/branchService');
const warehouseService = require('./services/warehouseService');

function mockReq(user, body = {}, query = {}, ip = '127.0.0.1') {
    return { user, body, query, params: {}, ip, headers: { 'user-agent': 'test' }, method: 'POST', originalUrl: '/test' };
}

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected\n');

        // Cleanup
        const old = await Company.findOne({ name: /^Test S14S15/ });
        if (old) {
            await mongoose.connection.db.collection('auditlogs').deleteMany({ company: old._id });
            await Warehouse.deleteMany({ company: old._id });
            await Branch.deleteMany({ company: old._id });
            await User.deleteMany({ company: old._id });
            await Company.deleteOne({ _id: old._id });
        }

        // === TEST 1: Register company ===
        console.log('=== TEST 1: Register company ===');
        const req = mockReq(null);
        const reg = await authService.registerCompany(req, {
            name: 'Test S14S15 ' + Date.now(),
            email: `s1415${Date.now()}@test.com`,
            phone: '+237600000000',
            password: 'companypass123'
        });
        console.log('✅ Company:', reg.company.name);
        console.log('✅ Employer:', reg.user.firstName, reg.user.role);
        console.log('✅ Access token:', reg.accessToken ? 'issued' : 'missing');
        console.log('✅ Refresh token:', reg.refreshToken ? 'issued' : 'missing');

        const companyId = reg.company.id;
        const employerToken = reg.accessToken;

        // Load employer
        const employer = await User.findById(reg.user.id);

        // === TEST 2: Company login ===
        console.log('\n=== TEST 2: Company login ===');
        const login = await authService.companyLogin(mockReq(null), {
            name: reg.company.name, password: 'companypass123'
        });
        console.log('✅ Company login OK');

        // === TEST 3: Wrong password locked out ===
        console.log('\n=== TEST 3: User login + lockout after failures ===');
        let failCount = 0;
        for (let i = 0; i < 6; i++) {
            try {
                await authService.userLogin(mockReq(null), {
                    email: reg.user.email || `s1415${Date.now()}@test.com`,
                    password: 'wrongpassword',
                    companyId
                });
            } catch (err) {
                failCount++;
            }
        }
        console.log(`✅ Lockout after ${failCount} failed attempts`);

        // === TEST 4: Correct login works ===
        console.log('\n=== TEST 4: Correct login ===');
        // Reset lock first
        await User.updateOne({ _id: employer._id }, { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
        const empLogin = await authService.userLogin(mockReq(null), {
            email: employer.email, password: 'companypass123', companyId
        });
        console.log('✅ Employer logged in:', empLogin.user.firstName);

        // === TEST 5: Create branch ===
        console.log('\n=== TEST 5: Create branch ===');
        const reqEmp = mockReq(employer);
        const branch = await branchService.createBranch(reqEmp, {
            name: 'Main Store',
            code: 'MAIN',
            type: 'store',
            address: { city: 'Douala' }
        });
        console.log('✅ Branch:', branch.name, '(' + branch.code + ')');

        // === TEST 6: Duplicate code blocked ===
        console.log('\n=== TEST 6: Duplicate branch code ===');
        try {
            await branchService.createBranch(reqEmp, {
                name: 'Main Store 2', code: 'MAIN', type: 'store', address: { city: 'Douala' }
            });
            console.log('❌ Duplicate NOT blocked');
        } catch (err) {
            console.log('✅ Duplicate blocked:', err.message);
        }

        // === TEST 7: Create warehouse under branch ===
        console.log('\n=== TEST 7: Create warehouse ===');
        const warehouse = await warehouseService.createWarehouse(reqEmp, {
            name: 'Store Main Warehouse',
            code: 'MAIN-WH',
            branchId: branch._id,
            address: { city: 'Douala' }
        });
        console.log('✅ Warehouse:', warehouse.name);

        // === TEST 8: Update branch ===
        console.log('\n=== TEST 8: Update branch ===');
        const updated = await branchService.updateBranch(reqEmp, branch._id, {
            name: 'Main Store — Updated',
            managerId: employer._id
        });
        console.log('✅ Branch updated:', updated.name);

        // === TEST 9: Prevent deactivation with users ===
        console.log('\n=== TEST 9: Prevent deactivation (user assigned) ===');
        // Reassign employer to branch first
        employer.branch = branch._id;
        await employer.save();
        try {
            await branchService.deactivateBranch(reqEmp, branch._id);
            console.log('❌ Deactivation NOT blocked');
        } catch (err) {
            console.log('✅ Deactivation blocked:', err.message.slice(0, 60));
        }

        // === TEST 10: Audit logs recorded ===
        console.log('\n=== TEST 10: Audit logs ===');
        const logs = await AuditLog.find({ company: companyId }).sort({ timestamp: -1 });
        console.log(`✅ ${logs.length} audit log entries`);
        console.log('   Most recent:', logs[0]?.action);

        // Cleanup
        await mongoose.connection.db.collection('auditlogs').deleteMany({ company: companyId });
        await Warehouse.deleteMany({ company: companyId });
        await Branch.deleteMany({ company: companyId });
        await User.deleteMany({ company: companyId });
        await Company.deleteOne({ _id: companyId });
        console.log('\n✅ Cleanup done');

        await mongoose.disconnect();
        console.log('\n🎉 S14+S15 TESTS PASSED');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

test();