const access = {
    canAccess(page) {
        if (!auth.user) return false;

        const { role } = auth.user;
        const activeRoles = auth.user.activeRoles || [];
        const fn = activeRoles;

        // Employer → everything
        if (role === 'employer') return true;

        // Shared pages (all employees)
        const shared = [
            'dashboard', 'ai', 'attendance', 'salary', 'messages',
            'browse-inventory', 'settings'
        ];
        if (shared.includes(page)) return true;

        // Function-specific pages
        const map = {
            // Stock
            'stock-ops': fn.includes('stock'),
            'inventory': fn.includes('stock') || fn.includes('manager'),
            'low-stock': fn.includes('stock') || fn.includes('manager'),
            'adjust': fn.includes('stock'),

            // Manager
            'manager-approvals': fn.includes('manager'),
            'employees': fn.includes('manager'),
            'withdrawals': fn.includes('manager') || fn.includes('sales'),

            // Cashier
            'cashier': fn.includes('cashier') || fn.includes('manager'),

            // Sales
            'sales': fn.includes('sales') || fn.includes('manager'),
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
            'end-of-day': false
        };

        return map[page] || false;
    }
};
