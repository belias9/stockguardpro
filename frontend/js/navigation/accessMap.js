const access = {
    canAccess(page) {
        if (!auth.user) return false;
        if (auth.user.role === 'employer') return true;

        const shared = ['dashboard', 'ai', 'attendance', 'salary', 'messages'];
        if (shared.includes(page)) return true;

        const fn = auth.user.activeRoles || [];
        const map = {
            inventory: ['stock', 'manager'].includes(fn[0]) || fn.includes('stock') || fn.includes('manager'),
            'low-stock': fn.includes('stock') || fn.includes('manager'),
            withdrawals: fn.includes('manager') || fn.includes('sales'),
            receipts: fn.includes('sales') || fn.includes('manager') || fn.includes('cashier'),
            employees: fn.includes('manager'),
            generate: fn.includes('accounting') || fn.includes('manager'),
            advances: fn.includes('accounting') || fn.includes('manager'),
            audit: false,
            settings: false,
            reports: false,
            'inventory-mode': fn.includes('manager') || fn.includes('stock')
        };
        return map[page] || false;
    }
};