function resolveMenu(user) {
    if (!user) return [];
    if (user.role === 'employer') {
        if (user.isPrimaryEmployer !== false) return menuConfig.employer;
        return menuConfig.employer.map(section => ({ ...section, items: section.items.filter(item => access.canAccess(item.page)) })).filter(section => section.items.length);
    }

    const base = menuConfig.employee.base;
    const functions = user.activeRoles?.length ? user.activeRoles : ['none'];
    const fnMenu = functions.flatMap(fn => menuConfig.employee.functionMenus[fn] || []);
    const tail = menuConfig.employee.tail;
    const grants = user.delegatedPermissions || [];
    const delegated = [];
    if (grants.some(p => p.enabled && p.key === 'accounting.view')) delegated.push({ label: 'Accounting', items: [{ page: 'accounting', icon: 'fa-book', label: 'Accounting' }] });
    if (grants.some(p => p.enabled && p.key === 'inventory.adjust')) delegated.push({ label: 'Stock', items: [{ page: 'stock-ops', icon: 'fa-boxes', label: 'Inventory Adjustments' }] });
    if (grants.some(p => p.enabled && p.key === 'receipts.create')) delegated.push({ label: 'Sales', items: [{ page: 'sales', icon: 'fa-receipt', label: 'Receipts' }] });
    if (grants.some(p => p.enabled && p.key === 'withdrawals.approve')) delegated.push({ label: 'Transfers', items: [{ page: 'withdrawals', icon: 'fa-truck', label: 'Transfer Approvals' }] });
    const sections=[...base,...fnMenu,...delegated,...tail];
    const seen=new Set();
    return sections.map(s=>({...s,items:s.items.filter(item=>{if(seen.has(item.page))return false;seen.add(item.page);return true;})})).filter(s=>s.items.length);
}
