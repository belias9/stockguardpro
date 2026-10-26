function resolveMenu(user) {
    if (!user) return [];
    if (user.role === 'employer') return menuConfig.employer;

    const base = menuConfig.employee.base;
    const fn = user.activeRoles?.[0] || 'none';
    const fnMenu = menuConfig.employee.functionMenus[fn] || [];
    const tail = menuConfig.employee.tail;
    return [...base, ...fnMenu, ...tail];
}