const menuConfig = {
    employer: [
        { label: 'Main', items: [
            { page: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' }
        ]},
        { label: 'Stock', items: [
            { page: 'inventory', icon: 'fa-boxes', label: 'Inventory' },
            { page: 'withdrawals', icon: 'fa-dolly', label: 'Withdrawals' },
            { page: 'receipts', icon: 'fa-receipt', label: 'Receipts' },
            { page: 'low-stock', icon: 'fa-exclamation-triangle', label: 'Low Stock' }
        ]},
        { label: 'Workforce', items: [
            { page: 'attendance', icon: 'fa-fingerprint', label: 'Attendance' },
            { page: 'salary', icon: 'fa-money-bill-wave', label: 'Salary' },
            { page: 'employees', icon: 'fa-users', label: 'Employees' }
        ]},
        { label: 'Communication', items: [
            { page: 'messages', icon: 'fa-envelope', label: 'Messages' }
        ]},
        { label: 'Admin', items: [
            { page: 'audit', icon: 'fa-clipboard-list', label: 'Audit Trail' },
            { page: 'settings', icon: 'fa-cog', label: 'Settings' }
        ]}
    ],
    employee: {
        base: [
            { label: 'Main', items: [{ page: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' }]},
            { label: 'AI', items: [{ page: 'ai', icon: 'fa-robot', label: 'AI Assistant' }]}
        ],
        functionMenus: {
            stock: [{ label: 'Stock', items: [
                { page: 'inventory', icon: 'fa-boxes', label: 'Inventory' },
                { page: 'low-stock', icon: 'fa-exclamation-triangle', label: 'Low Stock' }
            ]}],
            manager: [{ label: 'Management', items: [
                { page: 'employees', icon: 'fa-users', label: 'Employees' },
                { page: 'withdrawals', icon: 'fa-dolly', label: 'Withdrawals' }
            ]}],
            cashier: [{ label: 'Cashier', items: [
                { page: 'receipts', icon: 'fa-receipt', label: 'Payments' }
            ]}],
            sales: [{ label: 'Sales', items: [
                { page: 'receipts', icon: 'fa-receipt', label: 'My Sales' }
            ]}],
            shop_buyer: [],
            none: []
        },
        tail: [
            { label: 'Workforce', items: [
                { page: 'attendance', icon: 'fa-fingerprint', label: 'My Attendance' },
                { page: 'salary', icon: 'fa-money-bill-wave', label: 'My Salary' }
            ]},
            { label: 'Communication', items: [
                { page: 'messages', icon: 'fa-envelope', label: 'Messages' }
            ]}
        ]
    }
};