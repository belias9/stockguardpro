const access = {
    canAccess(page) {
        if (!auth.user) return false;

        const { role } = auth.user;
        const activeRoles = auth.user.activeRoles || [];
        const fn = activeRoles;

        if (auth.user.mustAcknowledgePolicies && page !== 'policies') return false;

        // Primary employer owns company-wide access. Other employer accounts
        // are limited by the scopes explicitly delegated by the primary owner.
        if (role === 'employer') {
            if (auth.user.isPrimaryEmployer !== false) return true;
            const scopes = auth.user.employerPermissions || [];
            const required = {
                dashboard: 'analytics', tutorial: 'analytics', ai: 'analytics', inventory: 'inventory', 'inventory-mode': 'inventory', withdrawals: 'operations', receipts: 'operations', 'low-stock': 'inventory', 'shop-buyer': 'operations', attendance: 'workforce', salary: 'workforce', 'employees-by-branch': 'people', users: 'people', permissions: 'people', applicants: 'people', messages: 'communications', customers: 'analytics', audit: 'analytics', reports: 'analytics', 'end-of-day': 'analytics', settings: 'administration', policies: 'administration', accounting: 'accounting', 'branch-detail': 'administration', governance: 'governance'
            };
            return scopes.includes(required[page]);
        }

        // Shared pages (all employees)
        const shared = [
            'dashboard', 'ai', 'attendance', 'salary', 'messages', 'tutorial',
            'browse-inventory', 'settings', 'policies'
        ];
        if (shared.includes(page)) return true;
        if (page === 'accounting') return fn.includes('accounting') || fn.includes('cashier') || (auth.user.delegatedPermissions || []).some(p => p.enabled && p.key === 'accounting.view');

        // Function-specific pages
        const map = {
            // Stock
            'stock-ops': fn.includes('stock') || fn.includes('manager') || auth.user.delegatedPermissions?.some(p=>p.enabled&&p.key==='inventory.adjust'),
            'inventory': fn.includes('stock') || fn.includes('manager') || auth.user.delegatedPermissions?.some(p=>p.enabled&&p.key==='inventory.adjust'),
            'low-stock': fn.includes('stock') || fn.includes('manager'),
            'adjust': fn.includes('stock'),

            // Manager
            'manager-approvals': fn.includes('manager'),
            'employees': fn.includes('manager'),
            'withdrawals': fn.includes('manager') || fn.includes('sales') || fn.includes('stock') || auth.user.delegatedPermissions?.some(p=>p.enabled&&p.key==='withdrawals.approve'),

            // Cashier
            'cashier': fn.includes('cashier') || fn.includes('manager'),

            // Sales
            'sales': fn.includes('sales') || fn.includes('manager') || auth.user.delegatedPermissions?.some(p=>p.enabled&&p.key==='receipts.create'),
            'receipts': fn.includes('sales') || fn.includes('manager') || fn.includes('cashier'),

            // Shop buyer
            'shop-buyer': fn.includes('shop_buyer') || fn.includes('manager'),

            // Accounting
            'generate': fn.includes('accounting') || fn.includes('manager'),
            'advances': fn.includes('accounting') || fn.includes('manager'),

            // Never for employees
            'audit': false,
            'reports': false,
            'branches': false,
            'warehouses': false,
            'users': false,
            'inventory-mode': fn.includes('manager'),
            'customers': fn.includes('manager') || fn.includes('sales'),
            'end-of-day': fn.includes('manager')
            ,'applicants': fn.includes('manager'), 'governance': false
        };

        return Boolean(map[page] || (page === 'permissions' && role === 'employer'));
    }
};
