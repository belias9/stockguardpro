const permissionOptions = [
    ['accounting.view','View branch accounting ledger'], ['accounting.company_view','View company accounting across all branches'], ['accounting.loans_view','View company loans across branches'], ['accounting.create','Record income and expenses'], ['accounting.approve','Approve accounting entries'],
    ['payroll.manage','Generate payroll and record salary payments'], ['inventory.adjust','Adjust branch inventory'],
    ['receipts.create','Create branch receipts'], ['withdrawals.approve','Approve branch transfers']
];
class PermissionsPage {
    constructor(){this.users=[];}
    async render(container){
        container.innerHTML=`<div class="card"><div class="card-header"><h3><i class="fas fa-user-lock"></i> Delegated Task Permissions</h3></div><div class="card-body">
          <p class="text-secondary mb-3">Grant employees specific tasks. Enable approval control for accounting entries so they stay pending until another authorized person approves them.</p>
          <div class="form-group"><label>Employee</label><select id="perm-user" onchange="pagePermissions.showUser()"><option value="">Choose employee</option></select></div>
          <div id="perm-fields">Select an employee to manage permissions.</div></div></div>`;
        try { this.users=(await usersApi.list({limit:200})).users.filter(u=>u.role==='employee'&&u.isActive); const sel=document.getElementById('perm-user'); sel.innerHTML+=this.users.map(u=>`<option value="${u._id||u.id}">${u.firstName} ${u.lastName} — ${u.branch?.name||''}</option>`).join(''); } catch(err){document.getElementById('perm-fields').innerHTML=ui.errorState(err.message);}
    }
    showUser(){const u=this.users.find(x=>(x._id||x.id)===document.getElementById('perm-user').value);if(!u)return;
        const current=u.delegatedPermissions||[];
        document.getElementById('perm-fields').innerHTML=`<div class="table-container"><table><thead><tr><th>Task</th><th>Allow</th><th>Require approval</th></tr></thead><tbody>${permissionOptions.map(([key,label])=>{const p=current.find(x=>x.key===key);const approvalAllowed=key==='accounting.create';return `<tr><td>${label}</td><td><input type="checkbox" class="perm-allow" data-key="${key}" ${p?.enabled?'checked':''}></td><td>${approvalAllowed?`<input type="checkbox" class="perm-approval" data-key="${key}" ${p?(p.requiresApproval?'checked':''):'checked'} ${p?.enabled?'':'disabled'}>`:'—'}</td></tr>`;}).join('')}</tbody></table></div><button class="btn btn-primary mt-3" onclick="pagePermissions.save()">Save Permissions</button>`;
        document.querySelectorAll('.perm-allow').forEach(c=>c.addEventListener('change',()=>{const approval=document.querySelector(`.perm-approval[data-key="${c.dataset.key}"]`);if(!approval)return;approval.disabled=!c.checked;if(!c.checked)approval.checked=false;}));
    }
    async save(){const id=document.getElementById('perm-user').value;const permissions=Array.from(document.querySelectorAll('.perm-allow:checked')).map(c=>({key:c.dataset.key,requiresApproval:!!document.querySelector(`.perm-approval[data-key="${c.dataset.key}"]`)?.checked}));
        try{await api.put(`/users/${id}/permissions`,{permissions});ui.showToast('success','Saved','Task permissions updated');const res=await usersApi.list({limit:200});this.users=res.users.filter(u=>u.role==='employee'&&u.isActive);this.showUser();}catch(err){ui.showToast('error','Error',err.message);}}
}
const pagePermissions=new PermissionsPage();
