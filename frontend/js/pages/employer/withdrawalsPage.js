class WithdrawalsPage {
    constructor() { this.withdrawals = []; this.filter = ''; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-dolly"></i> Withdrawals</h3>
                    ${auth.user.role === 'employer' || ['manager','stock','sales'].some(r => auth.user.activeRoles?.includes(r)) ? '<button class="btn btn-primary" onclick="pageWithdrawals.showCreate()"><i class="fas fa-plus"></i> Request Transfer</button>' : ''}
                    <select id="wd-filter" onchange="pageWithdrawals.doFilter(this.value)" style="max-width:200px;">
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="in_transit">In Transit</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                <div class="card-body"><div id="wd-table">${ui.loader()}</div></div>
            </div>
        `;
        await this.load();
    }

    async load() {
        try {
            const params = { limit: 100 };
            if (this.filter) params.status = this.filter;
            const res = await withdrawalsApi.list(params);
            this.withdrawals = res.withdrawals || [];
            this.renderTable();
        } catch (err) { document.getElementById('wd-table').innerHTML = ui.errorState(err.message); }
    }

    doFilter(v) { this.filter = v; this.load(); }

    renderTable() {
        const c = document.getElementById('wd-table');
        if (!this.withdrawals.length) { c.innerHTML = ui.emptyState('No withdrawals', 'fa-clipboard-list'); return; }
        const headers = [
            { key: 'withdrawalId', label: 'ID' },
            { key: 'requesterName', label: 'Requested By' },
            { key: 'sourceBranch', label: 'From', format: v => v?.name || '-' },
            { key: 'destinationBranch', label: 'To', format: v => v?.name || '-' },
            { key: 'collectorName', label: 'Collected By', format: v => v || '-' },
            { key: 'totalItems', label: 'Items' },
            { key: 'status', label: 'Status', format: v => ui.statusBadge(v) },
            { key: 'createdAt', label: 'Date', format: v => ui.formatDate(v) }
        ];
        const actions = [
            { icon: 'fa-check', title: 'Approve', class: 'text-success', condition: r => r.status === 'pending' && (auth.user.role === 'employer' || auth.user.activeRoles?.includes('manager') || auth.user.delegatedPermissions?.some(p=>p.enabled&&p.key==='withdrawals.approve')), handler: 'pageWithdrawals.showApprove' },
            { icon: 'fa-times', title: 'Reject', class: 'text-danger', condition: r => r.status === 'pending' && (auth.user.role === 'employer' || auth.user.activeRoles?.includes('manager') || auth.user.delegatedPermissions?.some(p=>p.enabled&&p.key==='withdrawals.approve')), handler: 'pageWithdrawals.showReject' },
            { icon: 'fa-truck', title: 'Dispatch (Outing)', class: 'text-warning', condition: r => r.status === 'approved' && (auth.user.role === 'employer' || auth.user.isMainStock), handler: 'pageWithdrawals.showDispatch' },
            { icon: 'fa-box-open', title: 'Confirm Receipt', class: 'text-primary', condition: r => r.status === 'in_transit' && (auth.user.role === 'employer' || auth.user.activeRoles?.includes('stock')), handler: 'pageWithdrawals.receive' }
        ];
        c.innerHTML = ui.generateTable(headers, this.withdrawals, { actions });
    }

    showApprove(index) {
        const w = this.withdrawals[index];
        ui.confirm('Approve Withdrawal', `Approve ${w.withdrawalId}?`, async () => {
            try { await withdrawalsApi.approve(w._id, { comments: 'Approved' }); ui.showToast('success', 'Approved', 'Withdrawal approved'); this.load(); }
            catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }

    showReject(index) {
        const w = this.withdrawals[index];
        const content = `<form id="rej"><div class="form-group"><label>Reason *</label><textarea id="rej-r" required></textarea></div></form>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="pageWithdrawals.doReject('${w._id}')">Reject</button>
        `;
        ui.showModal('Reject', content, footer);
    }

    async doReject(id) {
        try {
            await withdrawalsApi.reject(id, { reason: document.getElementById('rej-r').value });
            ui.closeModal();
            ui.showToast('success', 'Rejected', 'Withdrawal rejected');
            this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async showCreate() {
        try {
            const options=await withdrawalsApi.options();
            const warehouses=options.warehouses||[], branches=options.branches||[];
            this.transferWarehouses=warehouses;
            const content=`<div class="form-group"><label>Source warehouse</label><select id="wd-source" onchange="pageWithdrawals.loadTransferItems()">${warehouses.map(w=>`<option value="${w._id}">${w.name} — ${w.branch?.name||''}</option>`).join('')}</select></div>
              <div class="form-group"><label>Destination branch</label><select id="wd-dest-branch" onchange="pageWithdrawals.updateDestWarehouses()">${branches.map(b=>`<option value="${b._id}">${b.name}</option>`).join('')}</select></div>
              <div class="form-group"><label>Destination warehouse (optional)</label><select id="wd-dest-wh"><option value="">Default warehouse</option></select></div>
              <div class="form-group"><label>Item</label><select id="wd-item"></select></div>
              <div class="grid-2 gap-3"><div class="form-group"><label>Quantity</label><input type="number" id="wd-qty" min="0.01" step="0.01" value="1"></div><div class="form-group"><label>Transfer type</label><select id="wd-type"><option value="warehouse_to_warehouse">Warehouse to warehouse</option><option value="store_to_warehouse">Store to warehouse</option><option value="branch_to_branch">Branch to branch</option></select></div></div>
              <div class="form-group"><label>Reason / notes</label><textarea id="wd-notes"></textarea></div>`;
            ui.showModal('Request stock transfer',content,`<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-primary" onclick="pageWithdrawals.create()">Submit for approval</button>`);
            await this.loadTransferItems(); this.updateDestWarehouses();
        } catch(err) { ui.showToast('error','Cannot start transfer',err.message); }
    }
    async loadTransferItems(){
        const source=document.getElementById('wd-source')?.value;if(!source)return;
        try { const res=await inventoryApi.list({warehouseId:source,limit:500});const sel=document.getElementById('wd-item');if(sel)sel.innerHTML=(res.items||[]).map(i=>`<option value="${i._id}">${i.name} (${i.itemCode}) — ${i.quantity} ${i.unit}</option>`).join(''); }
        catch(err){ui.showToast('error','Cannot load items',err.message);}
    }
    updateDestWarehouses(){const branch=document.getElementById('wd-dest-branch')?.value;const sel=document.getElementById('wd-dest-wh');if(!sel)return;sel.innerHTML='<option value="">Default warehouse</option>'+(this.transferWarehouses||[]).filter(w=>(w.branch?._id||w.branch)===branch).map(w=>`<option value="${w._id}">${w.name}</option>`).join('');}
    async create(){
        const source=this.transferWarehouses.find(w=>w._id===document.getElementById('wd-source').value);const item=document.getElementById('wd-item').value;
        if(!source||!item){ui.showToast('warning','Required','Choose a source warehouse and item');return;}
        try { await withdrawalsApi.create({sourceWarehouseId:source._id,sourceBranchId:source.branch?._id||source.branch,destinationBranchId:document.getElementById('wd-dest-branch').value,destinationWarehouseId:document.getElementById('wd-dest-wh').value||undefined,transferType:document.getElementById('wd-type').value,notes:document.getElementById('wd-notes').value,items:[{inventoryItem:item,quantity:Number(document.getElementById('wd-qty').value)}]});ui.closeModal();ui.showToast('success','Submitted','Transfer awaits manager approval');await this.load(); }
        catch(err){ui.showToast('error','Transfer failed',err.message);}
    }
    showDispatch(i){const w=this.withdrawals[i];ui.showModal('Dispatch stock',`<p class="mb-2">${w.withdrawalId}: record the person collecting the goods.</p><div class="form-group"><label>Collector full name</label><input id="wd-collector-name" required></div><div class="form-group"><label>Collector employee ID</label><input id="wd-collector-id" required></div><div class="form-group"><label>Phone (optional)</label><input id="wd-collector-phone"></div>`,`<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-primary" onclick="pageWithdrawals.dispatch('${w._id}')">Confirm Dispatch</button>`);}
    async dispatch(id){try{await withdrawalsApi.dispatch(id,{collectorName:document.getElementById('wd-collector-name').value,collectorEmployeeId:document.getElementById('wd-collector-id').value,collectorPhone:document.getElementById('wd-collector-phone').value});ui.closeModal();ui.showToast('success','Dispatched','Stock marked in transit');await this.load();}catch(err){ui.showToast('error','Dispatch failed',err.message);}}
    async receive(i){const w=this.withdrawals[i];ui.confirm('Confirm transfer receipt',`Confirm ${w.withdrawalId} arrived at this branch?`,async()=>{try{await withdrawalsApi.receive(w._id);ui.showToast('success','Received','Destination stock updated');await this.load();}catch(err){ui.showToast('error','Receive failed',err.message);}});}
}

const pageWithdrawals = new WithdrawalsPage();
