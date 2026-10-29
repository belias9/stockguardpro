const menuConfig = {
    employer: [
        { label: 'Main', items: [
            { page: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' }
        ]},
        { label: 'AI', items: [
            { page: 'ai', icon: 'fa-robot', label: 'AI Assistant' }
        ]},
        { label: 'Setup', items: [
            { page: 'branches', icon: 'fa-code-branch', label: 'Branches' },
            { page: 'warehouses', icon: 'fa-warehouse', label: 'Warehouses' }
        ]},
        { label: 'Stock', items: [
            { page: 'inventory', icon: 'fa-boxes', label: 'Inventory' },
            { page: 'inventory-mode', icon: 'fa-clipboard-check', label: 'Inventory Mode' },
            { page: 'withdrawals', icon: 'fa-dolly', label: 'Withdrawals' },
            { page: 'receipts', icon: 'fa-receipt', label: 'Receipts' },
            { page: 'low-stock', icon: 'fa-exclamation-triangle', label: 'Low Stock' }
        ]},
        { label: 'Purchasing', items: [
            { page: 'shop-buyer', icon: 'fa-shopping-cart', label: 'Purchases' }
        ]},
        { label: 'Workforce', items: [
            { page: 'attendance', icon: 'fa-fingerprint', label: 'Attendance' },
            { page: 'salary', icon: 'fa-money-bill-wave', label: 'Salary' },
            { page: 'users', icon: 'fa-users', label: 'Employees' }
        ]},
        { label: 'Communication', items: [
            { page: 'messages', icon: 'fa-envelope', label: 'Messages' }
        ]},
        { label: 'Admin', items: [
            { page: 'customers', icon: 'fa-user-friends', label: 'Customers' },
            { page: 'audit', icon: 'fa-clipboard-list', label: 'Audit Trail' },
            { page: 'reports', icon: 'fa-chart-pie', label: 'Reports' },
            { page: 'end-of-day', icon: 'fa-calendar-day', label: 'End of Day' },
            { page: 'settings', icon: 'fa-cog', label: 'Settings' }
        ]}
    ],
    employee: {
        base: [
            { label: 'Main', items: [
                { page: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' }
            ]},
            { label: 'AI', items: [
                { page: 'ai', icon: 'fa-robot', label: 'AI Assistant' }
            ]}
        ],
        functionMenus: {
            stock: [
                { label: 'Stock', items: [
                    { page: 'stock-ops', icon: 'fa-boxes', label: 'Stock Operations' }
                ]}
            ],
            manager: [
                { label: 'Management', items: [
                    { page: 'manager-approvals', icon: 'fa-check-circle', label: 'Approvals' }
                ]}
            ],
            cashier: [
                { label: 'Cashier', items: [
                    { page: 'cashier', icon: 'fa-money-bill', label: 'Payments' }
                ]}
            ],
            sales: [
                { label: 'Sales', items: [
                    { page: 'sales', icon: 'fa-receipt', label: 'My Sales' }
                ]}
            ],
            shop_buyer: [
                { label: 'Purchasing', items: [
                    { page: 'shop-buyer', icon: 'fa-shopping-cart', label: 'Purchases' }
                ]}
            ],
            accounting: [
                { label: 'Accounting', items: [
                    { page: 'salary', icon: 'fa-money-bill-wave', label: 'Salaries' }
                ]}
            ],
            none: []
        },
        tail: [
            { label: 'Inventory', items: [
                { page: 'browse-inventory', icon: 'fa-boxes', label: 'Browse Items' }
            ]},
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
