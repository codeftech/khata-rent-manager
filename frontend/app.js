/* ===========================================================
   Khata frontend v2 — houses · tenants · rent · bijli · invoice
   Talks to the backend REST API. State lives on the server.
   =========================================================== */
const API = ""; // same origin. For a separate host: "https://your-backend.com"
let DB = { houses: [], tenants: [], payments: [], ebills: [] };
let selHouse = ""; // dashboard house filter ("" = all)

/* ---------- api ---------- */
async function api(method, path, body){
  const res = await fetch(API + path, {
    method, headers: body ? {"Content-Type":"application/json"} : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if(!res.ok) throw new Error((await res.json().catch(()=>({}))).error || res.statusText);
  return res.status===204 ? null : res.json();
}
async function refresh(){ DB = await api("GET","/api/state"); setConn(true); renderAll(); }
function setConn(ok){ const el=document.getElementById("conn"); el.className="status "+(ok?"on":"off");
  el.title = ok ? "Server connected" : "Server band hai — 'npm start' chalayein"; }

/* ---------- helpers ---------- */
function money(n){ n=Number(n)||0; return (n<0?"-":"")+"₹"+Math.abs(n).toLocaleString("en-IN"); }
function curMonth(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
function today(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
const MON=["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthLabel(m){ if(!m) return "—"; const p=m.split("-"); return MON[+p[1]]+" '"+p[0].slice(2); }
function fmtDate(d){ if(!d) return "—"; const p=d.split("-"); if(p.length<3) return d; return p[2]+" "+MON[+p[1]]+" '"+p[0].slice(2); }
function monthsElapsed(mv){ if(!mv) return 1; const a=mv.split("-"),b=curMonth().split("-");
  const m=(+b[0]-+a[0])*12+(+b[1]-+a[1])+1; return m>0?m:0; }
function paidFor(id){ return DB.payments.filter(p=>p.tenantId===id).reduce((s,p)=>s+(+p.amount||0),0); }
function elecDue(id){ return DB.ebills.filter(b=>b.tenantId===id&&!b.paid).reduce((s,b)=>s+(+b.amount||0),0); }
function computeT(t){ const months=t.status==="vacant"?0:monthsElapsed(t.moveIn); const due=months*(+t.rent||0);
  const paid=paidFor(t.id); return {months,due,paid,balance:due-paid,elec:elecDue(t.id)}; }
function tName(id){ const t=DB.tenants.find(x=>x.id===id); return t?(t.room+(t.name?" — "+t.name:"")):"—"; }
function hName(id){ const h=DB.houses.find(x=>x.id===id); return h?h.name:"—"; }
function scopeTenants(){ return selHouse ? DB.tenants.filter(t=>t.houseId===selHouse) : DB.tenants; }

/* ---------- tabs ---------- */
document.getElementById("tabs").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  document.querySelectorAll("#tabs button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  ["dash","houses","rooms","pay","elec","data"].forEach(t=>{ document.getElementById("tab-"+t).hidden=(t!==b.dataset.tab); });
});
function gotoTab(n){ document.querySelector('#tabs button[data-tab="'+n+'"]').click(); }
function scrollTop(){ window.scrollTo({top:0,behavior:"smooth"}); }

/* ---------- houses ---------- */
async function saveHouse(){
  const name=val("h_name").trim(); if(!name) return toast("Ghar ka naam zaroori hai", true);
  const body={ name, address:val("h_addr").trim(), note:val("h_note").trim() };
  const id=val("h_id");
  try{ await api(id?"PUT":"POST","/api/houses"+(id?"/"+id:""), body); resetHouseForm(); await refresh(); toast("Ghar saved ✓"); }
  catch(e){ toast(e.message,true); }
}
function editHouse(id){ const h=DB.houses.find(x=>x.id===id); if(!h) return;
  set("h_id",h.id);set("h_name",h.name);set("h_addr",h.address);set("h_note",h.note);
  document.getElementById("hFormTitle").textContent="✏️ Edit Ghar"; gotoTab("houses"); scrollTop(); }
async function delHouse(id){ const n=DB.tenants.filter(t=>t.houseId===id).length;
  if(!confirm("Ye ghar delete karein?"+(n?" Iske "+n+" tenant + unki payments/bijli bhi hat jayengi.":""))) return;
  try{ await api("DELETE","/api/houses/"+id); if(selHouse===id) selHouse=""; await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }
function resetHouseForm(){ ["h_id","h_name","h_addr","h_note"].forEach(k=>set(k,"")); document.getElementById("hFormTitle").textContent="🏡 Naya Ghar add karein"; }

/* ---------- tenants ---------- */
async function saveTenant(){
  const room=val("t_room").trim(), name=val("t_name").trim();
  if(!room && !name) return toast("Room ya tenant ka naam zaroori hai", true);
  const body={ houseId:val("t_house"), room, name, phone:val("t_phone").trim(), rent:+val("t_rent")||0, deposit:+val("t_dep")||0,
    moveIn:val("t_movein")||curMonth(), status:val("t_status"), note:val("t_note").trim() };
  const id=val("t_id");
  try{ await api(id?"PUT":"POST","/api/tenants"+(id?"/"+id:""), body); resetTenantForm(); await refresh(); toast("Saved ✓"); }
  catch(e){ toast(e.message,true); }
}
function editTenant(id){ const t=DB.tenants.find(x=>x.id===id); if(!t) return;
  set("t_id",t.id);set("t_house",t.houseId);set("t_room",t.room);set("t_name",t.name);set("t_phone",t.phone);set("t_rent",t.rent);
  set("t_dep",t.deposit);set("t_movein",t.moveIn);set("t_status",t.status);set("t_note",t.note);
  document.getElementById("tFormTitle").textContent="✏️ Edit Room / Tenant"; gotoTab("rooms"); scrollTop(); }
async function delTenant(id){ if(!confirm("Is tenant ko delete karein? Iski rent + bijli sab hat jayengi.")) return;
  try{ await api("DELETE","/api/tenants/"+id); await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }
function resetTenantForm(){ ["t_id","t_room","t_name","t_phone","t_rent","t_dep","t_note"].forEach(k=>set(k,""));
  set("t_movein",curMonth()); set("t_status","occupied"); document.getElementById("tFormTitle").textContent="🚪 Naya Room / Tenant"; }

/* ---------- rent ---------- */
async function savePayment(){
  const tid=val("p_tenant"); const amt=+val("p_amount")||0;
  if(!tid) return toast("Tenant select karein", true);
  if(amt<=0) return toast("Amount daalein", true);
  const body={ tenantId:tid, amount:amt, date:val("p_date")||today(), forMonth:val("p_formonth")||curMonth(), mode:val("p_mode"), note:val("p_note").trim() };
  const id=val("p_id");
  try{ await api(id?"PUT":"POST","/api/payments"+(id?"/"+id:""), body); resetPaymentForm(); await refresh(); toast("Payment saved 🎉"); launchConfetti(); }
  catch(e){ toast(e.message,true); }
}
function editPayment(id){ const p=DB.payments.find(x=>x.id===id); if(!p) return;
  set("p_id",p.id);set("p_tenant",p.tenantId);set("p_amount",p.amount);set("p_date",p.date);set("p_formonth",p.forMonth);set("p_mode",p.mode);set("p_note",p.note);
  document.getElementById("pFormTitle").textContent="✏️ Edit payment"; gotoTab("pay"); scrollTop(); }
async function delPayment(id){ if(!confirm("Ye payment delete karein?")) return;
  try{ await api("DELETE","/api/payments/"+id); await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }
function resetPaymentForm(){ ["p_id","p_amount","p_note"].forEach(k=>set(k,"")); set("p_date",today()); set("p_formonth",curMonth());
  document.getElementById("pFormTitle").textContent="💸 Rent payment"; }
function quickPay(tid){ gotoTab("pay"); set("p_tenant",tid); const t=DB.tenants.find(x=>x.id===tid); if(t) set("p_amount",t.rent);
  scrollTop(); document.getElementById("p_amount").focus(); }

/* ---------- bijli ---------- */
function prefillPrev(){ const tid=val("e_tenant"); if(!tid) return;
  const bills=DB.ebills.filter(b=>b.tenantId===tid).sort((a,b)=>(b.month||"").localeCompare(a.month||""));
  if(bills.length && !val("e_prev")){ set("e_prev", bills[0].curr); calcElec(); } }
function calcElec(){ const prev=+val("e_prev")||0, curr=+val("e_curr")||0, rate=+val("e_rate")||0;
  const units=Math.max(0,curr-prev), amt=Math.round(units*rate);
  document.getElementById("e_calc").textContent = units>0 ? ("🔢 "+units+" units × ₹"+rate+" = "+money(amt)) : "";
  if(rate>0 && units>0) set("e_amount",amt); }
async function saveEbill(){
  const tid=val("e_tenant"); if(!tid) return toast("Tenant select karein", true);
  const prev=+val("e_prev")||0, curr=+val("e_curr")||0, rate=+val("e_rate")||0;
  const units=Math.max(0,curr-prev); const amt=+val("e_amount")|| units*rate ||0;
  if(amt<=0) return toast("Amount ya reading daalein", true);
  const paid=val("e_paid")==="1";
  const body={ tenantId:tid, month:val("e_month")||curMonth(), prev, curr, units, rate, amount:Math.round(amt), paid, paidDate:paid?today():"", note:val("e_note").trim() };
  const id=val("e_id");
  try{ await api(id?"PUT":"POST","/api/ebills"+(id?"/"+id:""), body); resetEbillForm(); await refresh(); toast("Bijli bill saved ✓"); }
  catch(e){ toast(e.message,true); }
}
function editEbill(id){ const b=DB.ebills.find(x=>x.id===id); if(!b) return;
  set("e_id",b.id);set("e_tenant",b.tenantId);set("e_month",b.month);set("e_prev",b.prev);set("e_curr",b.curr);
  set("e_rate",b.rate);set("e_amount",b.amount);set("e_note",b.note);set("e_paid",b.paid?"1":"0");
  calcElec(); document.getElementById("eFormTitle").textContent="✏️ Edit bijli bill"; gotoTab("elec"); scrollTop(); }
async function delEbill(id){ if(!confirm("Ye bijli bill delete karein?")) return;
  try{ await api("DELETE","/api/ebills/"+id); await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }
async function toggleEbill(id){ const b=DB.ebills.find(x=>x.id===id); if(!b) return;
  const body={...b, paid:!b.paid, paidDate:!b.paid?today():""}; delete body.id;
  try{ await api("PUT","/api/ebills/"+id, body); await refresh(); toast(!b.paid?"Paid 🎉":"Marked unpaid"); if(!b.paid) launchConfetti(); }catch(e){ toast(e.message,true); } }
function resetEbillForm(){ ["e_id","e_prev","e_curr","e_amount","e_note"].forEach(k=>set(k,"")); set("e_month",curMonth()); set("e_paid","0");
  document.getElementById("e_calc").textContent=""; document.getElementById("eFormTitle").textContent="⚡ Bijli bill"; }
function quickElec(tid){ gotoTab("elec"); set("e_tenant",tid); prefillPrev(); scrollTop(); document.getElementById("e_curr").focus(); }

/* ---------- render ---------- */
function renderAll(){ renderChips(); renderDash(); renderHouses(); renderRooms(); renderSelects(); renderPayments(); renderEbills(); }

function renderChips(){
  let h='<button class="'+(selHouse===""?"active":"")+'" onclick="pickHouse(\'\')">🏘️ Sab ghar</button>';
  DB.houses.forEach(x=>{ h+='<button class="'+(selHouse===x.id?"active":"")+'" onclick="pickHouse(\''+x.id+'\')">'+esc(x.name)+'</button>'; });
  document.getElementById("houseChips").innerHTML = DB.houses.length ? h : '<span class="soft">Pehle 🏘️ Ghar tab se ghar add karein.</span>';
}
function pickHouse(id){ selHouse=id; renderChips(); renderDash(); }

function renderDash(){
  const ts=scopeTenants();
  let totMonthly=0,totDue=0,totPaid=0,totDep=0,occ=0,vac=0;
  ts.forEach(t=>{ if(t.status==="vacant")vac++; else{occ++;totMonthly+=+t.rent||0;} totDep+=+t.deposit||0;
    const c=computeT(t); totDue+=c.due; totPaid+=c.paid; });
  const ids=new Set(ts.map(t=>t.id));
  let elecPend=0,elecColl=0;
  DB.ebills.forEach(b=>{ if(!ids.has(b.tenantId)) return; if(b.paid) elecColl+=+b.amount||0; else elecPend+=+b.amount||0; });
  const rentBal=totDue-totPaid, grand=rentBal+elecPend;
  document.getElementById("dashStats").innerHTML=
    statN("🏠","Rooms",ts.length,"int","",occ+" occupied · "+vac+" vacant") +
    statN("💰","Monthly rent",totMonthly,"money","","expected / month") +
    statN("💚","Rent collected",totPaid,"money","ok","ab tak total") +
    statN("💔","Rent baaki",rentBal,"money",rentBal>0?"due":"ok") +
    statN("⚡","Bijli baaki",elecPend,"money",elecPend>0?"elec":"ok",money(elecColl)+" mila") +
    statN("🧮","Grand total baaki",grand,"money",grand>0?"due":"ok","rent + bijli") +
    statN("🔐","Deposits held",totDep,"money");
  animateCounts(document.getElementById("dashStats"));

  // overdue
  let rows="",any=false;
  ts.slice().sort((a,b)=>(computeT(b).balance+computeT(b).elec)-(computeT(a).balance+computeT(a).elec)).forEach(t=>{
    const c=computeT(t), tot=c.balance+c.elec; if(tot<=0) return; any=true;
    rows+=`<tr><td>${esc(hName(t.houseId))}</td><td><b>${esc(t.room)}</b></td><td>${esc(t.name||"—")}</td>`+
      `<td class="r money" style="color:${c.balance>0?"var(--due-deep)":"var(--ink-soft)"}">${money(c.balance)}</td>`+
      `<td class="r money" style="color:${c.elec>0?"var(--mint-deep)":"var(--ink-soft)"}">${money(c.elec)}</td>`+
      `<td class="r money" style="color:var(--due-deep)">${money(tot)}</td>`+
      `<td><div class="rowbtns"><button class="btn sm ghost" onclick="openInvoice('${t.id}')">🧾</button>`+
      `<button class="btn sm ok" onclick="quickPay('${t.id}')">+Rent</button></div></td></tr>`;
  });
  document.querySelector("#overdueTbl tbody").innerHTML=rows;
  document.getElementById("overdueTbl").hidden=!any;
  document.getElementById("overdueEmpty").hidden=any;

  // this month
  const cm=curMonth(); document.getElementById("curMonthLbl").textContent="("+monthLabel(cm)+")";
  let expThis=0,collThis=0,pc=0,uc=0;
  ts.forEach(t=>{ if(t.status==="vacant")return; expThis+=+t.rent||0;
    const got=DB.payments.filter(p=>p.tenantId===t.id&&p.forMonth===cm).reduce((s,p)=>s+(+p.amount||0),0);
    collThis+=got; if((+t.rent||0)>0 && got>=(+t.rent||0))pc++; else uc++; });
  const elecThis=DB.ebills.filter(b=>ids.has(b.tenantId)&&b.month===cm).reduce((s,b)=>s+(+b.amount||0),0);
  document.getElementById("monthStats").innerHTML=
    statN("📥","Rent expected",expThis,"money") +
    statN("✅","Rent collected",collThis,"money","ok") +
    statN("⏳","Rent pending",Math.max(0,expThis-collThis),"money",(expThis-collThis)>0?"warn":"ok") +
    statN("👥","Paid / unpaid",0,"txt","",pc+" / "+uc) +
    statN("⚡","Bijli this month",elecThis,"money","elec");
  document.querySelector("#monthStats .stat:nth-child(4) .val").textContent=pc+" / "+uc;
  animateCounts(document.getElementById("monthStats"));

  renderChart(ids);
  renderHouseMini();
}

function renderChart(ids){
  const months=[]; const d=new Date();
  for(let i=5;i>=0;i--){ const m=new Date(d.getFullYear(),d.getMonth()-i,1); months.push(m.getFullYear()+"-"+String(m.getMonth()+1).padStart(2,"0")); }
  const vals=months.map(m=>DB.payments.filter(p=>ids.has(p.tenantId)&&p.forMonth===m).reduce((s,p)=>s+(+p.amount||0),0));
  const max=Math.max(1,...vals);
  document.getElementById("chart").innerHTML=months.map((m,i)=>{
    const h=Math.round(vals[i]/max*100);
    const lbl = vals[i]>=1000 ? "₹"+(vals[i]/1000).toFixed(vals[i]%1000?1:0)+"k" : (vals[i]?money(vals[i]):"");
    return `<div class="col"><div class="bar" style="height:0" data-h="${h}"><span>${lbl}</span></div><div class="cl">${MON[+m.split("-")[1]]}</div></div>`;
  }).join("");
  requestAnimationFrame(()=>document.querySelectorAll("#chart .bar").forEach(b=>b.style.height=b.dataset.h+"%"));
}

function renderHouseMini(){
  if(!DB.houses.length){ document.getElementById("houseMini").innerHTML='<span class="soft">Koi ghar nahi.</span>'; return; }
  document.getElementById("houseMini").innerHTML=DB.houses.map(h=>{
    const ts=DB.tenants.filter(t=>t.houseId===h.id);
    const occ=ts.filter(t=>t.status!=="vacant").length;
    const pct=ts.length?Math.round(occ/ts.length*100):0;
    let bal=0; ts.forEach(t=>{ const c=computeT(t); bal+=c.balance+c.elec; });
    return `<div class="hm-row"><div class="hm-ring" style="--pct:${pct}%"><i>${occ}/${ts.length}</i></div>`+
      `<div class="hm-info"><b>${esc(h.name)}</b><div class="s">${occ} occupied · ${ts.length} rooms</div></div>`+
      `<div class="hm-amt" style="color:${bal>0?"var(--due-deep)":"var(--ok-deep)"}">${bal>0?money(bal)+" baaki":"clear ✓"}</div></div>`;
  }).join("");
}

function renderHouses(){
  const g=document.getElementById("houseGrid");
  g.innerHTML=DB.houses.map(h=>{
    const ts=DB.tenants.filter(t=>t.houseId===h.id);
    const occ=ts.filter(t=>t.status!=="vacant").length;
    let rent=0,bal=0,elec=0; ts.forEach(t=>{ if(t.status!=="vacant") rent+=+t.rent||0; const c=computeT(t); bal+=c.balance; elec+=c.elec; });
    return `<div class="hcard glass"><div class="hhead"><h3>🏡 ${esc(h.name)}</h3><div class="addr">${esc(h.address||"—")}</div></div>`+
      `<div class="hbody">`+
        `<div class="hstat"><span class="k">Rooms</span><span>${ts.length} (${occ} occ)</span></div>`+
        `<div class="hstat"><span class="k">Monthly rent</span><span>${money(rent)}</span></div>`+
        `<div class="hstat"><span class="k">Rent baaki</span><span style="color:${bal>0?"var(--due-deep)":"var(--ok-deep)"}">${money(bal)}</span></div>`+
        `<div class="hstat"><span class="k">Bijli baaki</span><span style="color:${elec>0?"var(--mint-deep)":"var(--ok-deep)"}">${money(elec)}</span></div>`+
        `<div class="hactions"><button class="btn sm" onclick="viewHouse('${h.id}')">Rooms dekho</button>`+
        `<button class="btn sm ghost" onclick="editHouse('${h.id}')">Edit</button>`+
        `<button class="btn sm danger" onclick="delHouse('${h.id}')">✕</button></div>`+
      `</div></div>`;
  }).join("");
  document.getElementById("houseEmpty").hidden=DB.houses.length>0;
}
function viewHouse(id){ selHouse=id; gotoTab("rooms"); }

function renderRooms(){
  const wrap=document.getElementById("roomsByHouse");
  const groups=[...DB.houses];
  const orphan=DB.tenants.filter(t=>!DB.houses.some(h=>h.id===t.houseId));
  let html="";
  groups.forEach(h=>{ const ts=DB.tenants.filter(t=>t.houseId===h.id); html+=houseBlock("🏡 "+h.name, ts); });
  if(orphan.length) html+=houseBlock("📦 Bina ghar ke", orphan);
  wrap.innerHTML=html;
  document.getElementById("roomsEmpty").hidden=DB.tenants.length>0;
}
function houseBlock(title, ts){
  if(!ts.length) return `<div class="card glass"><div class="househead">${esc(title)} <span class="cnt">0 rooms</span></div><div class="empty" style="padding:14px">Is ghar me abhi koi room nahi.</div></div>`;
  const rows=ts.map(t=>{ const c=computeT(t);
    const st=t.status==="vacant"?'<span class="tag vacant">Vacant</span>':((c.balance>0||c.elec>0)?'<span class="tag due">Baaki</span>':'<span class="tag ok">Clear</span>');
    return `<tr><td><b>${esc(t.room)}</b></td><td>${esc(t.name||"—")}</td><td>${esc(t.phone||"—")}</td>`+
      `<td class="r money">${money(t.rent)}</td><td class="r money">${money(t.deposit)}</td><td>${monthLabel(t.moveIn)}</td>`+
      `<td class="r money" style="color:${c.balance>0?"var(--due-deep)":"var(--ink-soft)"}">${money(c.balance)}</td>`+
      `<td class="r money" style="color:${c.elec>0?"var(--mint-deep)":"var(--ink-soft)"}">${money(c.elec)}</td><td>${st}</td>`+
      `<td><div class="rowbtns">`+
        `<button class="btn sm ok" onclick="quickPay('${t.id}')">+Rent</button>`+
        `<button class="btn sm elec" onclick="quickElec('${t.id}')">+Bijli</button>`+
        `<button class="btn sm ghost" onclick="openInvoice('${t.id}')">🧾</button>`+
        `<button class="btn sm ghost" onclick="showLedger('${t.id}')">Ledger</button>`+
        `<button class="btn sm ghost" onclick="editTenant('${t.id}')">Edit</button>`+
        `<button class="btn sm danger" onclick="delTenant('${t.id}')">✕</button>`+
      `</div></td></tr>`;
  }).join("");
  return `<div class="card glass"><div class="househead">${esc(title)} <span class="cnt">${ts.length} rooms</span></div>`+
    `<div class="tblwrap"><table><thead><tr><th>Room</th><th>Tenant</th><th>Phone</th><th class="r">Rent</th><th class="r">Deposit</th><th>Since</th><th class="r">Rent baaki</th><th class="r">Bijli baaki</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderSelects(){
  // house select for tenant form
  const hs=document.getElementById("t_house"); const hk=hs.value;
  hs.innerHTML = DB.houses.length ? DB.houses.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join("")
    : '<option value="">— pehle ghar add karein —</option>';
  hs.value=hk || (DB.houses[0]?DB.houses[0].id:"");
  // tenant selects (grouped by house)
  let opts='<option value="">— select tenant —</option>';
  DB.houses.forEach(h=>{ const ts=DB.tenants.filter(t=>t.houseId===h.id); if(!ts.length) return;
    opts+=`<optgroup label="${esc(h.name)}">`+ts.map(t=>`<option value="${t.id}">${esc(t.room)}${t.name?" — "+esc(t.name):""}</option>`).join("")+`</optgroup>`; });
  const orphan=DB.tenants.filter(t=>!DB.houses.some(h=>h.id===t.houseId));
  if(orphan.length) opts+=`<optgroup label="Bina ghar">`+orphan.map(t=>`<option value="${t.id}">${esc(t.room)}${t.name?" — "+esc(t.name):""}</option>`).join("")+`</optgroup>`;
  ["p_tenant","e_tenant","inv_tenant"].forEach(id=>{ const s=document.getElementById(id); const k=s.value; s.innerHTML=opts; s.value=k; });
  const all='<option value="">Sab tenants</option>'+opts.replace('<option value="">— select tenant —</option>',"");
  ["p_filter","e_filter"].forEach(id=>{ const s=document.getElementById(id); const k=s.value; s.innerHTML=all; s.value=k; });
}

function renderPayments(){
  const filt=document.getElementById("p_filter").value;
  let list=DB.payments.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if(filt) list=list.filter(p=>p.tenantId===filt);
  let rows="",tot=0;
  list.forEach(p=>{ tot+=+p.amount||0;
    rows+=`<tr><td>${fmtDate(p.date)}</td><td>${esc(tName(p.tenantId))}</td><td>${monthLabel(p.forMonth)}</td>`+
      `<td class="r money" style="color:var(--ok-deep)">${money(p.amount)}</td><td>${esc(p.mode||"")}</td><td>${esc(p.note||"")}</td>`+
      `<td><div class="rowbtns"><button class="btn sm ghost" onclick="editPayment('${p.id}')">Edit</button>`+
      `<button class="btn sm danger" onclick="delPayment('${p.id}')">✕</button></div></td></tr>`;
  });
  document.querySelector("#payTbl tbody").innerHTML=rows;
  document.getElementById("payEmpty").hidden=list.length>0;
  document.getElementById("payTotal").textContent="Total: "+money(tot);
}

function renderEbills(){
  const filt=document.getElementById("e_filter").value;
  let list=DB.ebills.slice().sort((a,b)=>(b.month||"").localeCompare(a.month||""));
  if(filt) list=list.filter(b=>b.tenantId===filt);
  let rows="",pend=0,coll=0;
  list.forEach(b=>{ if(b.paid) coll+=+b.amount||0; else pend+=+b.amount||0;
    const st=b.paid?'<span class="tag ok">Paid</span>':'<span class="tag due">Unpaid</span>';
    rows+=`<tr><td>${monthLabel(b.month)}</td><td>${esc(tName(b.tenantId))}</td>`+
      `<td class="r">${b.prev||"—"}</td><td class="r">${b.curr||"—"}</td><td class="r">${b.units||"—"}</td>`+
      `<td class="r">${b.rate?"₹"+b.rate:"—"}</td><td class="r money" style="color:var(--mint-deep)">${money(b.amount)}</td><td>${st}</td>`+
      `<td><div class="rowbtns"><button class="btn sm ${b.paid?"ghost":"ok"}" onclick="toggleEbill('${b.id}')">${b.paid?"Unpaid":"Paid"}</button>`+
      `<button class="btn sm ghost" onclick="editEbill('${b.id}')">Edit</button>`+
      `<button class="btn sm danger" onclick="delEbill('${b.id}')">✕</button></div></td></tr>`;
  });
  document.querySelector("#elecTbl tbody").innerHTML=rows;
  document.getElementById("elecEmpty").hidden=list.length>0;
  document.getElementById("elecTotals").innerHTML=`<span style="color:var(--mint-deep)">Baaki: ${money(pend)}</span> &nbsp; <span style="color:var(--ok-deep)">Mila: ${money(coll)}</span>`;
}

/* ---------- ledger ---------- */
function showLedger(tid){
  const t=DB.tenants.find(x=>x.id===tid); if(!t) return; const c=computeT(t);
  document.getElementById("ledgerName").textContent="🧾 "+t.room+(t.name?" — "+t.name:"");
  document.getElementById("ledgerSummary").innerHTML=
    `${esc(hName(t.houseId))} · Rent ${money(t.rent)}/mo · ${c.months} mahine · Due ${money(c.due)} · Paid <b style="color:var(--ok-deep)">${money(c.paid)}</b> · Rent baaki <b style="color:${c.balance>0?"var(--due-deep)":"var(--ok-deep)"}">${money(c.balance)}</b> · Bijli baaki <b style="color:var(--mint-deep)">${money(c.elec)}</b>`;
  const items=[];
  DB.payments.filter(p=>p.tenantId===tid).forEach(p=>items.push({s:p.date,type:"💸 Rent",dm:fmtDate(p.date),amt:p.amount,detail:monthLabel(p.forMonth)+" · "+(p.mode||"")+(p.note?" · "+p.note:""),col:"var(--ok-deep)"}));
  DB.ebills.filter(b=>b.tenantId===tid).forEach(b=>items.push({s:b.month,type:"⚡ Bijli",dm:monthLabel(b.month),amt:b.amount,detail:(b.units?b.units+"u × ₹"+b.rate+" · ":"")+(b.paid?"Paid":"Unpaid")+(b.note?" · "+b.note:""),col:"var(--mint-deep)"}));
  items.sort((a,b)=>(b.s||"").localeCompare(a.s||""));
  document.getElementById("ledgerBody").innerHTML = items.map(it=>`<tr><td>${it.type}</td><td>${it.dm}</td><td class="r money" style="color:${it.col}">${money(it.amt)}</td><td>${esc(it.detail)}</td></tr>`).join("")
    || '<tr><td colspan="4" style="text-align:center;color:var(--ink-soft)">Koi entry nahi</td></tr>';
  document.getElementById("ledgerModal").classList.add("show");
}
function closeModal(){ document.getElementById("ledgerModal").classList.remove("show"); }

/* ---------- invoice ---------- */
function openInvoice(tid){ set("inv_tenant",tid); set("inv_month",curMonth()); renderInvoice(); document.getElementById("invModal").classList.add("show"); }
function closeInv(){ document.getElementById("invModal").classList.remove("show"); }
function renderInvoice(){
  const tid=val("inv_tenant"), m=val("inv_month")||curMonth();
  const t=DB.tenants.find(x=>x.id===tid);
  const area=document.getElementById("invoiceArea");
  if(!t){ area.innerHTML='<div class="invoice"><p style="text-align:center;color:#9a8fb5">Tenant select karein</p></div>'; return; }
  const h=DB.houses.find(x=>x.id===t.houseId)||{};
  const rent=+t.rent||0;
  const bill=DB.ebills.filter(b=>b.tenantId===tid&&b.month===m).sort((a,b)=>(b.paidDate||"").localeCompare(a.paidDate||""))[0];
  const elec=bill?(+bill.amount||0):0;
  const total=rent+elec;
  const invNo="KH-"+m.replace("-","")+"-"+(tid.slice(0,4).toUpperCase());
  let lines=`<tr><td>Room rent — ${esc(t.room)} <span style="color:#9a8fb5">(${monthLabel(m)})</span></td><td>${money(rent)}</td></tr>`;
  if(bill) lines+=`<tr><td>Bijli — ${bill.units||0} units × ₹${bill.rate||0} <span style="color:#9a8fb5">(${bill.prev}→${bill.curr})</span></td><td>${money(elec)}</td></tr>`;
  else lines+=`<tr><td>Bijli — <span style="color:#9a8fb5">is mahine ka bill nahi</span></td><td>${money(0)}</td></tr>`;
  const paidTag = bill && bill.paid ? '<span class="inv-paid y">Bijli PAID</span>' : '<span class="inv-paid n">Bijli DUE</span>';
  area.innerHTML=`<div class="invoice">
    <div class="inv-top">
      <div><div class="inv-brand">🏠 Khata<small>rent &amp; bijli invoice</small></div></div>
      <div class="inv-meta">Invoice <b>${invNo}</b><br>Date: ${fmtDate(today())}<br>Month: <b>${monthLabel(m)}</b></div>
    </div>
    <div class="inv-to"><span class="lbl">Bill to</span><br><b>${esc(t.name||t.room)}</b><br>${esc(h.name||"")}${h.address?" · "+esc(h.address):""}${t.phone?"<br>📞 "+esc(t.phone):""}</div>
    <table class="inv-table"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>
    <div class="inv-total"><div class="box2">
      <div class="ln"><span>Rent</span><span>${money(rent)}</span></div>
      <div class="ln"><span>Bijli</span><span>${money(elec)}</span></div>
      <div class="ln grand"><span>Total</span><span>${money(total)}</span></div>
    </div></div>
    <div style="text-align:right;margin-top:8px">${paidTag}</div>
    <div class="inv-note">Dhanyavaad! 🙏 · Ye invoice Khata se bana hai</div>
  </div>`;
}
function printInvoice(){ if(!val("inv_tenant")) return toast("Tenant select karein",true); window.print(); }

/* ---------- backup ---------- */
function exportJSON(){ dl(new Blob([JSON.stringify(DB,null,2)],{type:"application/json"}),"khata-backup-"+today()+".json"); toast("Backup downloaded ✓"); }
function exportCSV(){ const rows=[["Date","House","Room","Tenant","For Month","Amount","Mode","Note"]];
  DB.payments.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(p=>{ const t=DB.tenants.find(x=>x.id===p.tenantId)||{};
    rows.push([p.date,csv(hName(t.houseId)),csv(t.room),csv(t.name),p.forMonth,p.amount,p.mode,csv(p.note)]); });
  dl(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}),"rent-"+today()+".csv"); toast("Rent CSV ✓"); }
function exportElecCSV(){ const rows=[["Month","House","Room","Tenant","Prev","Curr","Units","Rate","Amount","Status","Note"]];
  DB.ebills.slice().sort((a,b)=>(a.month||"").localeCompare(b.month||"")).forEach(b=>{ const t=DB.tenants.find(x=>x.id===b.tenantId)||{};
    rows.push([b.month,csv(hName(t.houseId)),csv(t.room),csv(t.name),b.prev,b.curr,b.units,b.rate,b.amount,b.paid?"Paid":"Unpaid",csv(b.note)]); });
  dl(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}),"bijli-"+today()+".csv"); toast("Bijli CSV ✓"); }
async function importJSON(e){ const f=e.target.files[0]; if(!f) return;
  try{ const d=JSON.parse(await f.text()); if(!Array.isArray(d.tenants)&&!Array.isArray(d.houses)) throw new Error("galat file");
    if(!confirm("Backup restore karein? Maujooda data replace ho jayega.")){ e.target.value=""; return; }
    await api("POST","/api/import",d); await refresh(); toast("Restore ho gaya ✓");
  }catch(err){ toast("File sahi nahi: "+err.message,true); } e.target.value=""; }
async function wipeAll(){ if(!confirm("PAKKA? Saara data delete ho jayega.")) return; if(!confirm("Aakhri baar — sab delete?")) return;
  try{ await api("POST","/api/wipe"); selHouse=""; await refresh(); toast("Sab delete ho gaya"); }catch(e){ toast(e.message,true); } }
function dl(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function csv(s){ return '"'+String(s==null?"":s).replace(/"/g,'""')+'"'; }

/* ---------- count-up ---------- */
function animateCounts(root){
  if(matchMedia("(prefers-reduced-motion:reduce)").matches) { root.querySelectorAll(".val[data-to]").forEach(el=>el.textContent=fmtVal(+el.dataset.to,el.dataset.fmt)); return; }
  root.querySelectorAll(".val[data-to]").forEach(el=>{
    const to=+el.dataset.to, fmt=el.dataset.fmt, dur=650, t0=performance.now();
    function step(t){ const k=Math.min(1,(t-t0)/dur); const e=1-Math.pow(1-k,3);
      el.textContent=fmtVal(Math.round(to*e),fmt); if(k<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  });
}
function fmtVal(n,fmt){ return fmt==="money"?money(n):(fmt==="int"?n.toLocaleString("en-IN"):n); }

/* ---------- confetti ---------- */
let cfx;
function launchConfetti(){
  if(matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const cv=document.getElementById("confetti"); const ctx=cv.getContext("2d");
  cv.width=innerWidth; cv.height=innerHeight;
  const cols=["#ff8fc0","#b98cff","#5ee6dc","#ffd39e","#8b6ee8","#37c17e"];
  const P=Array.from({length:120},()=>({x:innerWidth/2+(Math.random()-.5)*160,y:innerHeight/3,
    vx:(Math.random()-.5)*11,vy:Math.random()*-13-4,g:.4+Math.random()*.2,
    s:6+Math.random()*7,c:cols[(Math.random()*cols.length)|0],r:Math.random()*6,vr:(Math.random()-.5)*.4,life:0}));
  cancelAnimationFrame(cfx);
  function frame(){ ctx.clearRect(0,0,cv.width,cv.height); let alive=false;
    P.forEach(p=>{ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.life++;
      if(p.y<cv.height+30){ alive=true; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
        ctx.globalAlpha=Math.max(0,1-p.life/140); ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); ctx.restore(); } });
    if(alive) cfx=requestAnimationFrame(frame); else ctx.clearRect(0,0,cv.width,cv.height);
  }
  frame();
}

/* ---------- utils ---------- */
function val(id){ return document.getElementById(id).value; }
function set(id,v){ const el=document.getElementById(id); if(el) el.value=(v==null?"":v); }
function statN(ic,l,to,fmt,cls,sub){
  const disp = fmt==="txt" ? esc(sub) : "0";
  const dataTo = fmt==="txt" ? "" : ` data-to="${to}" data-fmt="${fmt}"`;
  const subHtml = (fmt!=="txt" && sub) ? `<div class="sub">${sub}</div>` : "";
  return `<div class="stat"><span class="ic">${ic}</span><div class="lbl">${l}</div><div class="val ${cls||""}"${dataTo}>${disp}</div>${subHtml}</div>`;
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
let _t;
function toast(msg,err){ const el=document.getElementById("toast"); el.textContent=msg; el.className="toast show"+(err?" err":""); clearTimeout(_t); _t=setTimeout(()=>el.classList.remove("show"),2000); }

document.addEventListener("click",e=>{ if(e.target.id==="ledgerModal") closeModal(); if(e.target.id==="invModal") closeInv(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeModal(); closeInv(); } });

/* ---------- init ---------- */
resetHouseForm(); resetTenantForm(); resetPaymentForm(); resetEbillForm();
refresh().catch(()=>{ setConn(false); toast("Server se connect nahi hua — 'npm start' chalayein",true); });
