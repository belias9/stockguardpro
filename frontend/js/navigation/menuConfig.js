const menuConfig = {
    employer: [
        { label: 'Main', items: [
            { page: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
            { page: 'tutorial', icon: 'fa-chalkboard-teacher', label: 'Workflow Tutorial' }
        ]},
        { label: 'AI', items: [
            { page: 'ai', icon: 'fa-robot', label: 'AI Assistant' }
        ]},
        { label: 'Setup', items: [
            { page: 'branch-detail', icon: 'fa-code-branch', label: 'Branches & Warehouses' },
            { page: 'governance', icon: 'fa-landmark', label: 'Ownership & Co-employers' },
        ]},
        { label: 'Stock', items: [
            { page: 'inventory', icon: 'fa-boxes', label: 'Inventory' },
            { page: 'inventory-mode', icon: 'fa-clipboard-check', label: 'Inventory Mode' },
            { page: 'withdrawals', icon: 'fa-dolly', label: 'Withdrawals' },
            { page: 'receipts', icon: 'fa-receipt', label: 'Receipts' },
            { page: 'low-stock', icon: 'fa-exclamation-triangle', label: 'Low Stock' }
        ]},
        { label: 'Finance', items: [
            { page: 'accounting', icon: 'fa-book', label: 'Accounting' }
        ]},
        { label: 'Purchasing', items: [
            { page: 'shop-buyer', icon: 'fa-shopping-cart', label: 'Purchases' }
        ]},
        { label: 'Workforce', items: [
            { page: 'attendance', icon: 'fa-fingerprint', label: 'Attendance' },
            { page: 'salary', icon: 'fa-money-bill-wave', label: 'Salary' },
            { page: 'employees-by-branch', icon: 'fa-users', label: 'Employees (by Branch)' },
            { page: 'users', icon: 'fa-user-shield', label: 'Users & Roles' },
            { page: 'permissions', icon: 'fa-user-lock', label: 'Task Permissions' },
            { page: 'applicants', icon: 'fa-user-plus', label: 'Applications' },
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
            ,{ page: 'policies', icon: 'fa-file-signature', label: 'Policies & Certificates' }
        ]}
    ],
    employee: {
        base: [
            { label: 'Main', items: [
                { page: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
                { page: 'tutorial', icon: 'fa-chalkboard-teacher', label: 'Workflow Tutorial' }
            ]},
            { label: 'AI', items: [
                { page: 'ai', icon: 'fa-robot', label: 'AI Assistant' }
            ]}
        ],
        functionMenus: {
            stock: [
                { label: 'Stock', items: [
                    { page: 'stock-ops', icon: 'fa-boxes', label: 'Enter & Stock Operations' },
                    { page: 'withdrawals', icon: 'fa-truck', label: 'Outing & Transfers' }
                ]}
            ],
            manager: [
                { label: 'Management', items: [
                    { page: 'manager-approvals', icon: 'fa-check-circle', label: 'Approvals' },
                    { page: 'inventory', icon: 'fa-boxes', label: 'Branch Inventory' },
                    { page: 'receipts', icon: 'fa-receipt', label: 'Branch Receipts' },
                    { page: 'cashier', icon: 'fa-money-bill', label: 'Confirm Payments' },
                    { page: 'inventory-mode', icon: 'fa-clipboard-check', label: 'Inventory Mode' },
                    { page: 'stock-ops', icon: 'fa-boxes', label: 'Enter Purchases' },
                    { page: 'end-of-day', icon: 'fa-calendar-day', label: 'Branch End-of-Day Report' }
                ]}
            ],
            cashier: [
                { label: 'Cashier', items: [
                    { page: 'cashier', icon: 'fa-money-bill', label: 'Payments' },
                    { page: 'accounting', icon: 'fa-book', label: 'Customer Credit & Branch Expenses' }
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
                    { page: 'accounting', icon: 'fa-book', label: 'Accounting' },
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
            ]},
            { label: 'Company', items: [
                { page: 'policies', icon: 'fa-file-signature', label: 'Policies & Certificates' }
            ]},
            { label: 'Account', items: [
                { page: 'settings', icon: 'fa-cog', label: 'My Settings' }
            ]}
        ]
    }
};
