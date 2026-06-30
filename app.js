// ===================================================
// DUDE PAYMENT SYSTEM — App Logic
// ===================================================

let currentFilter   = 'all';
let updateFilter    = 'all';
let isTableView     = false;
let currentDetailBillId = null;
let createGoodsRows = [];
let editGoodsRows   = [];
let editingBillId   = null;

// ─── navigation ────────────────────────────────────
function goTo(view){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  closeMenu();
  if(view==='home')     renderHome();
  if(view==='update')   renderUpdateTable();
  if(view==='user')     renderUserList();
  if(view==='contract') renderChat();
  if(view==='setting')  renderSetting();
  if(view==='create'){  createGoodsRows=[{goods_id:'',name:'',cost:'',buyer_id:''}]; renderCreateForm(); }
}

function showToast(msg, dur=2200){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'), dur);
}

// ─── login ─────────────────────────────────────────
function doLogin(){
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value.trim();
  const found = DB.person.find(x => x.user_name===u && x.password===p);
  if(!found){ showToast('Wrong user name or PIN ✕'); return; }
  CURRENT_USER_ID = found.id;
  document.getElementById('home-username').textContent = `${found.name} · ${found.AKA}`;
  const now = new Date();
  document.getElementById('home-date').textContent = now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  goTo('home');
}
function logout(){ CURRENT_USER_ID=null; goTo('login'); document.getElementById('login-pass').value=''; }

// ─── menu ──────────────────────────────────────────
function openMenu(){ document.getElementById('menu-overlay').classList.remove('hidden'); document.getElementById('menu-drawer').classList.add('open'); }
function closeMenu(){ document.getElementById('menu-overlay').classList.add('hidden'); document.getElementById('menu-drawer').classList.remove('open'); }

// ─── home filters / view toggle ────────────────────
function toggleView(){
  isTableView = !isTableView;
  document.getElementById('home-card-view').classList.toggle('hidden', isTableView);
  document.getElementById('home-table-view').classList.toggle('hidden', !isTableView);
  renderHome();
}
function toggleMoreFilter(){ document.getElementById('more-filter').classList.toggle('hidden'); }
function setFilter(f){
  currentFilter = f;
  document.querySelectorAll('#more-filter .chip').forEach(c => c.classList.toggle('active', c.dataset.f===f));
  renderHome();
}
function toggleCalendar(){
  const ex = document.getElementById('calendar-popover');
  if(ex){ ex.remove(); return; }
  const pop = document.createElement('div');
  pop.id='calendar-popover'; pop.className='calendar-popover';
  const dates=[...new Set(DB.bill.map(b=>b.date))].sort().reverse();
  pop.innerHTML=`<div class="cal-title">Jump to date</div>`
    +dates.map(d=>`<button class="cal-date-btn" onclick="jumpToDate('${d}')">${formatDateLong(d)}</button>`).join('')
    +`<button class="cal-date-btn cal-clear" onclick="jumpToDate('')">Show all</button>`;
  document.getElementById('view-home').appendChild(pop);
}
function jumpToDate(ds){
  document.getElementById('search-input').value=ds;
  document.getElementById('calendar-popover')?.remove();
  renderHome();
}

function getFilteredBills(){
  const q=(document.getElementById('search-input')?.value||'').toLowerCase();
  return DB.bill.filter(b=>{
    const k=personById(b.keeper_id);
    const ms=!q||b.date.includes(q)||k.name.toLowerCase().includes(q)||formatDateLong(b.date).toLowerCase().includes(q);
    if(!ms) return false;
    const fp=billFullyPaid(b.id);
    const myShare=sharesForBill(b.id).find(s=>s.payer_id===CURRENT_USER_ID);
    if(currentFilter==='paid')   return myShare ? myShare.paid_stt===1 : fp;
    if(currentFilter==='unpaid') return myShare ? myShare.paid_stt===0 : !fp;
    if(currentFilter==='mine')   return b.keeper_id===CURRENT_USER_ID;
    return true;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));
}

function renderHome(){
  const bills=getFilteredBills();

  // card view
  document.getElementById('home-card-view').innerHTML = bills.map(b=>{
    const k=personById(b.keeper_id);
    const shares=sharesForBill(b.id);
    const myShare=shares.find(s=>s.payer_id===CURRENT_USER_ID);
    const unpaid = myShare && myShare.paid_stt===0 && myShare.net_value<0;
    return `<div class="bill-card">
      <div class="bill-card-head">
        <span class="date">${formatDateLong(b.date)}</span>
        <button class="detail-btn" onclick="openDetail(${b.id})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="bill-row"><span class="label">Book Keeper:</span><span class="keeper-pill">${k.name} ${k.AKA}</span></div>
      <div class="bill-row"><span class="label">Fund:</span><span>${formatKip(b.total_value)} Kip</span></div>
      <div class="bill-row"><span class="label">Sharer:</span><span>${shares.length} Sharer</span></div>
      <div class="bill-foot">
        <div class="status-pill ${unpaid?'unpaid':'paid'}">
          <span class="stt">${unpaid?'Unpaid':'Paid'}</span>
          <span class="amt">${myShare ? formatKip(Math.abs(myShare.net_value)) : 0} Kip</span>
        </div>
        <button class="pay-btn ${unpaid?'unpaid':'paid'}" onclick="${unpaid?`goPay(${b.id})`:`goSlip(${b.id})`}">${unpaid?'Pay':'Paid'}</button>
      </div>
    </div>`;
  }).join('') || `<p style="text-align:center;color:var(--ink-soft);font-size:13px;padding:30px 0">No bills found</p>`;

  // table view
  document.getElementById('home-table-view').innerHTML = `<table>
    <thead><tr><th>Date</th><th>Value (Kip)</th><th>Status</th></tr></thead>
    <tbody>${bills.map(b=>{
      const myShare=sharesForBill(b.id).find(s=>s.payer_id===CURRENT_USER_ID);
      const unpaid=myShare && myShare.paid_stt===0 && myShare.net_value<0;
      return `<tr>
        <td onclick="openDetail(${b.id})">${formatDateShort(b.date)}</td>
        <td onclick="openDetail(${b.id})">${formatKip(myShare?Math.abs(myShare.net_value):0)}</td>
        <td onclick="${unpaid?`goPay(${b.id})`:`goSlip(${b.id})`}"><span class="status-tag ${unpaid?'unpaid':'paid'}">${unpaid?'Unpaid':'PAID'}</span></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ─── bill detail ───────────────────────────────────
function openDetail(billId){
  currentDetailBillId=billId;
  const b=DB.bill.find(x=>x.id===billId);
  const k=personById(b.keeper_id);
  const shares=sharesForBill(billId);
  const details=detailsForBill(billId);
  const myShare=shares.find(s=>s.payer_id===CURRENT_USER_ID);
  const unpaid=myShare && myShare.paid_stt===0 && myShare.net_value<0;
  const sv=shares[0]?.share_value||0;

  document.getElementById('detail-body').innerHTML=`
    <div class="detail-card">
      <div class="detail-date">${formatDateLong(b.date)}</div>
      <div class="detail-keeper">Book Keeper: <b>${k.name} ${k.AKA}</b></div>
      <div class="detail-sharers">Sharer: ${shares.map(s=>s.person.name).join(', ')}</div>
      <table class="goods-table">
        <thead><tr><th>Goods</th><th>Value</th><th>Buyer</th></tr></thead>
        <tbody>${details.map(d=>`<tr><td>${d.goods_name||'—'}</td><td>${formatKip(d.cost)}</td><td>${d.buyer?.name||'—'}</td></tr>`).join('')}</tbody>
      </table>
      <div class="goods-total"><span>Total</span><span>${formatKip(b.total_value)} Kip</span></div>
    </div>
    <div class="split-grid">
      <div class="sharer-status-list">
        <div class="title">All Sharers</div>
        ${shares.map(s=>`<div class="sharer-status-row"><span>${s.person.name}</span><span class="tag ${s.paid_stt?'paid':'unpaid'}">${s.paid_stt?'Paid':'Unpaid'}</span></div>`).join('')}
      </div>
      <div class="my-summary">
        <div class="row"><span>Your Cost</span><b>${formatKip(myShare?.cost||0)}</b></div>
        <div class="row"><span>Share/Unit</span><b>${formatKip(sv)}</b></div>
        <div class="row"><span>Status</span><span class="status-line ${unpaid?'unpaid':'paid'}">${unpaid?'Unpaid':'Paid'}</span></div>
        <div class="my-pay-box">
          <div class="lbl">Your payment value</div>
          <div class="amt">${formatKip(Math.abs(myShare?.net_value||0))} Kip</div>
        </div>
      </div>
    </div>
    <button class="detail-cta ${unpaid?'unpaid':'paid'}" onclick="${unpaid?`goPay(${billId})`:`goSlip(${billId})`}">
      ${unpaid?'Pay now →':'View your slip'}
    </button>`;
  goTo('detail');
}

// ─── pay page ──────────────────────────────────────
function goPay(billId){
  currentDetailBillId=billId;
  const b=DB.bill.find(x=>x.id===billId);
  const k=personById(b.keeper_id);
  const myShare=sharesForBill(billId).find(s=>s.payer_id===CURRENT_USER_ID);
  document.getElementById('pay-body').innerHTML=`
    <div class="qr-box">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="white"/>
        <rect x="10" y="10" width="30" height="30" fill="none" stroke="#0F2333" stroke-width="4"/>
        <rect x="15" y="15" width="20" height="20" fill="#0F2333"/>
        <rect x="60" y="10" width="30" height="30" fill="none" stroke="#0F2333" stroke-width="4"/>
        <rect x="65" y="15" width="20" height="20" fill="#0F2333"/>
        <rect x="10" y="60" width="30" height="30" fill="none" stroke="#0F2333" stroke-width="4"/>
        <rect x="15" y="65" width="20" height="20" fill="#0F2333"/>
        <rect x="50" y="50" width="8" height="8" fill="#0F2333"/>
        <rect x="62" y="50" width="8" height="8" fill="#0F2333"/>
        <rect x="74" y="50" width="8" height="8" fill="#0F2333"/>
        <rect x="50" y="62" width="8" height="8" fill="#0F2333"/>
        <rect x="62" y="62" width="8" height="8" fill="#0F2333"/>
        <rect x="74" y="74" width="8" height="8" fill="#0F2333"/>
        <rect x="50" y="74" width="8" height="8" fill="#0F2333"/>
      </svg>
    </div>
    <div>
      <div class="pay-amount">${formatKip(Math.abs(myShare?.net_value||0))} Kip</div>
      <div class="pay-to">Scan to pay → ${k.name} · ${k.AKA}</div>
    </div>
    <label class="upload-zone">
      <input type="file" accept="image/*" onchange="handleSlipUpload(${billId})">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Upload slip to confirm payment
    </label>`;
  goTo('pay');
}
function handleSlipUpload(billId){
  const myShare=DB.share.find(s=>s.bill_id===billId && s.payer_id===CURRENT_USER_ID);
  if(myShare) myShare.paid_stt=1;
  if(billFullyPaid(billId)) DB.bill.find(b=>b.id===billId).paid_stt=1;
  showToast('✓ Slip uploaded — payment confirmed!');
  setTimeout(()=>openDetail(billId),700);
}

// ─── slip viewer ───────────────────────────────────
function goSlip(billId){
  document.getElementById('slip-body').innerHTML=`
    <span class="confirm-badge">✓ Payment confirmed</span>
    <div style="text-align:center;color:var(--ink-soft);font-size:13px">Your payment slip</div>
    <div style="width:200px;height:300px;background:white;border-radius:14px;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;border:2px solid var(--mint-soft)">
      <div style="text-align:center;color:var(--ink-soft);font-size:12px">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="var(--mint)" stroke-width="2" stroke-linecap="round"/></svg>
        <p style="margin-top:8px">Slip image<br>stored here</p>
      </div>
    </div>`;
  goTo('slip');
}

// ─── date helpers ──────────────────────────────────
function dayOptions(sel){
  return Array.from({length:31},(_,i)=>i+1).map(d=>`<option value="${d}" ${d===sel?'selected':''}>${d}</option>`).join('');
}
function monthOptions(sel){
  const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return m.map((mo,i)=>`<option value="${i}" ${i===sel?'selected':''}>${mo}</option>`).join('');
}
function yearOptions(sel){
  return Array.from({length:5},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===sel?'selected':''}>${y}</option>`).join('');
}

function dateRowHTML(id, d, m, y, hint){
  return `<div class="date-row-wrap">
    <div class="date-row-label">
      <span>${hint}</span>
      <button onclick="openDatePicker('${id}')" title="Pick date">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <input type="date" id="${id}-native" style="display:none" onchange="syncDatePicker('${id}')">
    <div class="date-row-inputs">
      <select id="${id}-day"   title="Day">${dayOptions(d)}</select>
      <select id="${id}-month" title="Month">${monthOptions(m)}</select>
      <select id="${id}-year"  title="Year">${yearOptions(y)}</select>
    </div>
  </div>`;
}
function openDatePicker(id){
  const el=document.getElementById(id+'-native');
  el.style.display='block'; el.click();
}
function syncDatePicker(id){
  const val=document.getElementById(id+'-native').value;
  if(!val) return;
  const d=new Date(val);
  document.getElementById(id+'-day').value=d.getDate();
  document.getElementById(id+'-month').value=d.getMonth();
  document.getElementById(id+'-year').value=d.getFullYear();
  document.getElementById(id+'-native').style.display='none';
}

// ─── create new form ───────────────────────────────
function renderCreateForm(){
  const now=new Date();
  document.getElementById('create-form-body').innerHTML=
    dateRowHTML('cf',now.getDate(),now.getMonth(),now.getFullYear(),'Date (auto-filled as today)')
    +`<div class="form-group">
        <label class="field-label">Type of Bill</label>
        <select class="form-select" id="cf-type" onchange="renderGoodsRows('create')">
          <option value="">Choose category</option>
          ${DB.type_of_bill.map(t=>`<option value="${t.type_name}">${t.type_name.charAt(0)+t.type_name.slice(1).toLowerCase()}</option>`).join('')}
        </select>
      </div>
      <div id="cf-goods-wrap"></div>
      <div class="form-group">
        <label class="field-label">Select Sharers</label>
        <div class="select-user-card">
          ${DB.person.map(p=>`
            <div class="user-check-row">
              <span>${p.name} · ${p.AKA}</span>
              <input type="checkbox" class="cf-user-check" value="${p.id}" onchange="updateKeeperOptions('create')">
            </div>`).join('')}
          <div class="user-check-row">
            <input class="others-input" type="text" id="cf-others" placeholder="Others: type name here">
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="field-label">Book Keeper</label>
        <div class="keeper-row">
          <select class="form-select" id="cf-keeper" disabled>
            <option>Auto — highest spender</option>
          </select>
          <label class="toggle" title="Toggle auto/manual">
            <input type="checkbox" id="cf-keeper-auto" checked onchange="toggleKeeperAuto('create')">
            <span class="slider"></span>
          </label>
        </div>
        <p class="auto-hint" id="cf-keeper-hint">ON = auto-selects highest spender &nbsp;|&nbsp; OFF = pick manually</p>
      </div>
      <button class="btn-submit" onclick="submitCreate()">Create Bill</button>`;
}

// ─── goods rows ────────────────────────────────────
function renderGoodsRows(mode){
  const type=(document.getElementById(mode==='create'?'cf-type':'ef-type')||{}).value||'';
  const wrapId=mode==='create'?'cf-goods-wrap':'ef-goods-wrap';
  const rows=mode==='create'?createGoodsRows:editGoodsRows;
  const isDrink=type==='DRINK';

  document.getElementById(wrapId).innerHTML=rows.map((row,i)=>`
    <div class="goods-card">
      ${rows.length>1?`<button class="remove-goods" onclick="removeGoodsRow('${mode}',${i})">✕</button>`:''}
      <div class="goods-card-row">
        ${isDrink
          ?`<select onchange="onGoodsSelect('${mode}',${i},this.value)" style="flex:1.4">
              <option value="">Select goods</option>
              ${DB.goods.map(g=>`<option value="${g.id}" ${row.goods_id==g.id?'selected':''}>${g.name}</option>`).join('')}
            </select>`
          :`<input type="text" placeholder="Goods name" value="${row.name||''}" oninput="updateGoodsField('${mode}',${i},'name',this.value)" style="flex:1.4">`
        }
        <input type="number" placeholder="Cost" value="${row.cost||''}" oninput="updateGoodsField('${mode}',${i},'cost',this.value)" style="flex:1;min-width:80px">
      </div>
      <div class="form-group" style="margin-top:0">
        <select onchange="updateGoodsField('${mode}',${i},'buyer_id',this.value)" style="width:100%;padding:9px 10px;border-radius:var(--radius-sm);border:1.5px solid var(--line);font-family:var(--font-body);font-size:13px;outline:none;appearance:none">
          <option value="">Buyer — who paid for this item?</option>
          ${DB.person.map(p=>`<option value="${p.id}" ${row.buyer_id==p.id?'selected':''}>${p.name}</option>`).join('')}
        </select>
      </div>
    </div>`).join('')
    +`<button class="add-goods-btn" onclick="addGoodsRow('${mode}')">+ Add another item</button>`;
}
function onGoodsSelect(mode,i,gid){
  const rows=mode==='create'?createGoodsRows:editGoodsRows;
  const g=DB.goods.find(x=>x.id==gid);
  rows[i].goods_id=gid; rows[i].name=g?.name||''; rows[i].cost=g?.price||'';
  renderGoodsRows(mode);
}
function updateGoodsField(mode,i,field,val){
  (mode==='create'?createGoodsRows:editGoodsRows)[i][field]=val;
  if(field==='cost') updateKeeperOptions(mode);
}
function addGoodsRow(mode){
  (mode==='create'?createGoodsRows:editGoodsRows).push({goods_id:'',name:'',cost:'',buyer_id:''});
  renderGoodsRows(mode);
}
function removeGoodsRow(mode,i){
  (mode==='create'?createGoodsRows:editGoodsRows).splice(i,1);
  renderGoodsRows(mode);
}
function updateKeeperOptions(mode){
  const prefix=mode==='create'?'cf':'ef';
  const auto=document.getElementById(`${prefix}-keeper-auto`)?.checked;
  if(auto) return;
  const checks=document.querySelectorAll(`.${prefix}-user-check:checked`);
  const sel=document.getElementById(`${prefix}-keeper`);
  if(!sel) return;
  const ids=Array.from(checks).map(c=>+c.value);
  sel.innerHTML=ids.length
    ? ids.map(id=>{const p=personById(id);return `<option value="${id}">${p.name}</option>`;}).join('')
    : '<option>Select sharers first</option>';
}
function toggleKeeperAuto(mode){
  const prefix=mode==='create'?'cf':'ef';
  const auto=document.getElementById(`${prefix}-keeper-auto`).checked;
  const sel=document.getElementById(`${prefix}-keeper`);
  const hint=document.getElementById(`${prefix}-keeper-hint`);
  sel.disabled=auto;
  if(auto){ sel.innerHTML='<option>Auto — highest spender</option>'; }
  else{ updateKeeperOptions(mode); }
  hint.textContent=auto?'ON = auto-selects highest spender \u00a0|\u00a0 OFF = pick manually':'OFF = manual mode — pick book keeper from the list';
}
function submitCreate(){
  const type=document.getElementById('cf-type').value;
  const checked=document.querySelectorAll('.cf-user-check:checked');
  if(!type){ showToast('Please pick a type of bill'); return; }
  if(checked.length===0){ showToast('Select at least one sharer'); return; }
  if(createGoodsRows.some(r=>!r.cost)){ showToast('Fill in all item costs'); return; }
  showToast('✓ Bill created! (demo mode)');
  setTimeout(()=>goTo('home'),800);
}

// ─── update table ──────────────────────────────────
let updateFilter = 'all';
function toggleUpdateMore(){ document.getElementById('update-more-filter').classList.toggle('hidden'); }
function setUpdateFilter(f){
  updateFilter=f;
  document.querySelectorAll('#update-more-filter .chip').forEach(c=>c.classList.toggle('active',c.dataset.uf===f));
  renderUpdateTable();
}
function toggleUpdateCalendar(){
  const ex=document.getElementById('update-cal-popover');
  if(ex){ ex.remove(); return; }
  const pop=document.createElement('div');
  pop.id='update-cal-popover'; pop.className='calendar-popover';
  pop.style.top='110px';
  const dates=[...new Set(DB.bill.map(b=>b.date))].sort().reverse();
  pop.innerHTML=`<div class="cal-title">Filter by date</div>`
    +dates.map(d=>`<button class="cal-date-btn" onclick="jumpToUpdateDate('${d}')">${formatDateLong(d)}</button>`).join('')
    +`<button class="cal-date-btn cal-clear" onclick="jumpToUpdateDate('')">Show all</button>`;
  document.getElementById('view-update').appendChild(pop);
}
function jumpToUpdateDate(ds){
  document.getElementById('update-search').value=ds;
  document.getElementById('update-cal-popover')?.remove();
  renderUpdateTable();
}
function renderUpdateTable(){
  const q=(document.getElementById('update-search')?.value||'').toLowerCase();
  const tf=document.getElementById('update-type-filter')?.value||'';
  const bills=DB.bill.filter(b=>{
    const k=personById(b.keeper_id);
    const ms=!q||b.date.includes(q)||k.name.toLowerCase().includes(q)||formatDateLong(b.date).toLowerCase().includes(q);
    const mt=!tf||billTypeName(b.type_id)===tf;
    const fp=billFullyPaid(b.id);
    if(updateFilter==='paid'&&!fp) return false;
    if(updateFilter==='unpaid'&&fp) return false;
    if(updateFilter==='mine'&&b.keeper_id!==CURRENT_USER_ID) return false;
    return ms&&mt;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));

  document.getElementById('update-table-wrap').innerHTML=`<table>
    <thead><tr><th>Date</th><th>Value (Kip)</th><th>Status</th></tr></thead>
    <tbody>${bills.map(b=>{
      const fp=billFullyPaid(b.id);
      return `<tr onclick="openEdit(${b.id})" style="cursor:pointer">
        <td>${formatDateShort(b.date)}</td>
        <td>${formatKip(b.total_value)}</td>
        <td><span class="status-tag ${fp?'paid':'unpaid'}">${fp?'PAID':'Unpaid'}</span></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ─── edit bill ─────────────────────────────────────
function openEdit(billId){
  editingBillId=billId;
  const b=DB.bill.find(x=>x.id===billId);
  const shares=sharesForBill(billId);
  const details=detailsForBill(billId);
  editGoodsRows=details.map(d=>({goods_id:d.goods_id||'',name:d.goods_name||'',cost:d.cost,buyer_id:d.buyer_id}));
  const d=new Date(b.date);

  document.getElementById('edit-form-body').innerHTML=
    `<div class="prefill-card">
      <b>${formatKip(b.total_value)} Kip</b>
      ${shares.map(s=>s.person.name).join(', ')}
    </div>`
    +dateRowHTML('ef',d.getDate(),d.getMonth(),d.getFullYear(),'Date (pre-filled from bill — change if needed)')
    +`<div class="form-group">
        <label class="field-label">Type of Bill</label>
        <select class="form-select" id="ef-type" onchange="renderGoodsRows('edit')">
          ${DB.type_of_bill.map(t=>`<option value="${t.type_name}" ${t.id===b.type_id?'selected':''}>${t.type_name.charAt(0)+t.type_name.slice(1).toLowerCase()}</option>`).join('')}
        </select>
      </div>
      <div id="ef-goods-wrap"></div>
      <div class="form-group">
        <label class="field-label">Select Sharers</label>
        <div class="select-user-card">
          ${DB.person.map(p=>`
            <div class="user-check-row">
              <span>${p.name} · ${p.AKA}</span>
              <input type="checkbox" class="ef-user-check" value="${p.id}" ${shares.some(s=>s.payer_id===p.id)?'checked':''} onchange="updateKeeperOptions('edit')">
            </div>`).join('')}
          <div class="user-check-row">
            <input class="others-input" type="text" id="ef-others" placeholder="Others: type name here">
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="field-label">Book Keeper</label>
        <div class="keeper-row">
          <select class="form-select" id="ef-keeper" disabled>
            <option>Auto — highest spender</option>
          </select>
          <label class="toggle" title="Toggle auto/manual">
            <input type="checkbox" id="ef-keeper-auto" checked onchange="toggleKeeperAuto('edit')">
            <span class="slider"></span>
          </label>
        </div>
        <p class="auto-hint" id="ef-keeper-hint">ON = auto-selects highest spender &nbsp;|&nbsp; OFF = pick manually</p>
      </div>
      <button class="btn-submit" onclick="submitEdit()">Update Bill</button>`;

  renderGoodsRows('edit');
  goTo('edit');
}
function submitEdit(){
  showToast('✓ Bill updated! (demo mode)');
  setTimeout(()=>goTo('update'),800);
}

// ─── user list ─────────────────────────────────────
function renderUserList(){
  document.getElementById('user-list').innerHTML=DB.person.map(p=>{
    const unpaidShares=DB.share.filter(s=>s.payer_id===p.id && s.paid_stt===0 && s.net_value<0);
    const total=unpaidShares.reduce((sum,s)=>sum+Math.abs(s.net_value),0);
    const count=unpaidShares.length;
    const initials=avatarInitials(p.name);
    const avatarHtml=p.profile_pic
      ?`<img src="${p.profile_pic}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      :'';
    return `<div class="user-row">
      <div class="user-avatar">${avatarHtml}${initials}</div>
      <div class="user-info">
        <div class="name">${p.name}</div>
        <div class="aka">${p.AKA}</div>
      </div>
      <div class="user-owe ${count>0?'has':'zero'}">
        ${count>0
          ?`<div class="amt">${formatKip(total)} Kip</div><div class="lbl">${count} unpaid bill${count>1?'s':''}</div>`
          :`<div class="amt">All clear</div>`}
      </div>
    </div>`;
  }).join('');
}

// ─── contract (chat) ───────────────────────────────
function renderChat(){
  const box=document.getElementById('chat-messages');
  box.innerHTML=DB.contract.map(m=>{
    const isMe=m.sender_id===CURRENT_USER_ID;
    const sender=personById(m.sender_id);
    const time=new Date(m.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    return `<div class="msg ${isMe?'me':'them'}">${m.message}<div class="meta">${isMe?'You':sender.name} · ${time}</div></div>`;
  }).join('');
  box.scrollTop=box.scrollHeight;
}
function sendMessage(){
  const inp=document.getElementById('chat-input');
  const text=inp.value.trim(); if(!text) return;
  DB.contract.push({id:DB.contract.length+1,sender_id:CURRENT_USER_ID,message:text,created_at:new Date().toISOString()});
  inp.value=''; renderChat();
}

// ─── setting ───────────────────────────────────────
function renderSetting(){
  const me=personById(CURRENT_USER_ID);
  document.getElementById('setting-body').innerHTML=`
    <div class="setting-section-label">Account</div>
    <div class="setting-group">
      <div class="setting-row" onclick="showToast('Edit display name — coming in full version')"><span>Display name — <b>${me.name}</b></span><span class="arrow">›</span></div>
      <div class="setting-row" onclick="showToast('Change PIN — coming in full version')"><span>Change PIN</span><span class="arrow">›</span></div>
      <div class="setting-row" onclick="showToast('Upload QR code — coming in full version')"><span>My QR code</span><span class="arrow">›</span></div>
      <div class="setting-row" onclick="showToast('Upload profile photo — coming in full version')"><span>Profile photo</span><span class="arrow">›</span></div>
    </div>
    <div class="setting-section-label">App</div>
    <div class="setting-group">
      <div class="setting-row"><span>Theme</span><label class="toggle"><input type="checkbox" onchange="toggleTheme(this)"><span class="slider"></span></label></div>
      <div class="setting-row" onclick="showToast('Currency: Lao Kip (₭)')"><span>Currency</span><span class="arrow">Kip</span></div>
    </div>
    <div class="setting-section-label">About</div>
    <div class="setting-group">
      <div class="setting-row" onclick="showToast('DUDE Payment System v1.0')"><span>Version</span><span class="arrow">1.0</span></div>
    </div>
    <div class="setting-section-label">Danger zone</div>
    <div class="setting-group">
      <div class="setting-row danger-text" onclick="logout()"><span>Log out</span><span class="arrow">›</span></div>
    </div>`;
}
function toggleTheme(el){
  document.body.style.background=el.checked
    ?'linear-gradient(135deg,#f0f4f7 0%,#dce8ef 100%)'
    :'linear-gradient(135deg,#071520 0%,#0D2535 100%)';
}