/* ===========================================================
   KHATA frontend v4 — "Maybach Noir"
   Per-flat dossier is the hub: rent · bijli · motor · advance/security · KYC.
   State lives on the server (REST API).
   =========================================================== */
const API = "";
let DB = { houses: [], tenants: [], payments: [], ebills: [], motorbills: [] };
let selHouse = "";      // dashboard house filter ("" = all)
let openFlatId = null;  // currently-open dossier

/* ---------- api ---------- */
async function api(method, path, body){
  const res = await fetch(API + path, {
    method, headers: body ? {"Content-Type":"application/json"} : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if(!res.ok) throw new Error((await res.json().catch(()=>({}))).error || res.statusText);
  return res.status===204 ? null : res.json();
}
async function refresh(){ DB = await api("GET","/api/state"); setConn(true); renderAll(); if(openFlatId) renderFlat(openFlatId); }
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
function meterDue(id){ return DB.ebills.filter(b=>b.tenantId===id&&!b.paid).reduce((s,b)=>s+(+b.amount||0),0); }
function motorDue(id){ const t=DB.tenants.find(x=>x.id===id); if(!t||t.status==="vacant") return 0;
  return DB.motorbills.filter(m=>m.houseId===t.houseId && !(m.paid&&m.paid[id])).reduce((s,m)=>s+(+m.shareAmount||0),0); }
function elecDue(id){ return meterDue(id)+motorDue(id); }
function advBal(t){ return Math.max(0,(+t.advanceAgreed||0)-(+t.advancePaid||0)); }
function secBal(t){ return Math.max(0,((t.securityAgreed!=null?+t.securityAgreed:+t.deposit)||0)-(+t.securityPaid||0)); }
function computeT(t){ const months=t.status==="vacant"?0:monthsElapsed(t.moveIn); const due=months*(+t.rent||0);
  const paid=paidFor(t.id); return {months,due,paid,balance:due-paid,elec:elecDue(t.id),meter:meterDue(t.id),motor:motorDue(t.id),
    advBal:advBal(t),secBal:secBal(t)}; }
function tName(id){ const t=DB.tenants.find(x=>x.id===id); return t?(t.room+(t.name?" — "+t.name:"")):"—"; }
function hName(id){ const h=DB.houses.find(x=>x.id===id); return h?h.name:"—"; }
function scopeTenants(){ return selHouse ? DB.tenants.filter(t=>t.houseId===selHouse) : DB.tenants; }
function houseFlats(hid){ return DB.tenants.filter(t=>t.houseId===hid); }
function houseOccupied(hid){ return houseFlats(hid).filter(t=>t.status!=="vacant"); }
function secAgreed(t){ return (t.securityAgreed!=null?+t.securityAgreed:+t.deposit)||0; }

/* ---------- theme ---------- */
function applyTheme(t){ document.documentElement.dataset.theme=t;
  const b=document.getElementById("themeBtn"); if(b) b.textContent = t==="light" ? "☀" : "☾"; }
function toggleTheme(){ const cur=document.documentElement.dataset.theme==="light"?"dark":"light";
  try{ localStorage.setItem("khata-theme",cur); }catch(e){} applyTheme(cur); }
(function initTheme(){ let t="dark"; try{ t=localStorage.getItem("khata-theme")||"dark"; }catch(e){} applyTheme(t); })();

/* ---------- photos (data-URL) ---------- */
function pickPhoto(e, hiddenId, prevId){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ const im=new Image();
    im.onload=()=>{ // downscale + compress so it always fits the store and stays fast
      const max=1280; let w=im.naturalWidth||im.width, h=im.naturalHeight||im.height;
      if(w>max||h>max){ const k=Math.min(max/w,max/h); w=Math.round(w*k); h=Math.round(h*k); }
      const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
      cv.getContext("2d").drawImage(im,0,0,w,h);
      let data=cv.toDataURL("image/jpeg",0.82);
      if(data.length>2600000) data=cv.toDataURL("image/jpeg",0.6);
      if(data.length>3400000) return toast("Photo bahut badi hai — chhoti photo choose karein", true);
      set(hiddenId,data); paintPhoto(prevId,data);
    };
    im.onerror=()=>toast("Photo load nahi hui", true); im.src=r.result;
  };
  r.onerror=()=>toast("Photo padhi nahi gayi", true);
  r.readAsDataURL(f);
}
function clearPhoto(hiddenId, prevId){ set(hiddenId,""); paintPhoto(prevId,""); const f=document.getElementById(prevId.replace("Prev","File")); if(f) f.value=""; }
function paintPhoto(prevId, data){ const el=document.getElementById(prevId); if(!el) return;
  const label = prevId.indexOf("aadhaar")>=0 ? "+ Aadhaar" : "+ Photo";
  if(data){ el.style.backgroundImage="url("+data+")"; el.classList.add("has"); el.innerHTML=""; }
  else { el.style.backgroundImage=""; el.classList.remove("has"); el.innerHTML="<span>"+label+"</span>"; } }

/* ---------- tabs ---------- */
document.getElementById("tabs").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  document.querySelectorAll("#tabs button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  ["dash","flats","props","data"].forEach(t=>{ document.getElementById("tab-"+t).hidden=(t!==b.dataset.tab); });
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
  document.getElementById("hFormTitle").textContent="Edit Ghar"; gotoTab("props"); scrollTop(); }
async function delHouse(id){ const n=DB.tenants.filter(t=>t.houseId===id).length;
  if(!confirm("Ye ghar delete karein?"+(n?" Iske "+n+" flat + unki payments/bijli/motor bhi hat jayenge.":""))) return;
  try{ await api("DELETE","/api/houses/"+id); if(selHouse===id) selHouse=""; await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }
function resetHouseForm(){ ["h_id","h_name","h_addr","h_note"].forEach(k=>set(k,"")); document.getElementById("hFormTitle").textContent="Naya Ghar / Property"; }

/* ---------- tenants (flats) ---------- */
function calcTenantMoney(){
  const aA=+val("t_advA")||0, aP=+val("t_advP")||0, sA=+val("t_secA")||0, sP=+val("t_secP")||0;
  const aB=Math.max(0,aA-aP), sB=Math.max(0,sA-sP);
  const el=document.getElementById("t_calc"); if(!el) return;
  el.innerHTML = (aA||aP||sA||sP)
    ? `Advance: mila <b>${money(aP)}</b> / ${money(aA)} · baaki <b style="color:${aB>0?'var(--rose)':'var(--emerald)'}">${money(aB)}</b>`+
      ` &nbsp;•&nbsp; Security: mila <b>${money(sP)}</b> / ${money(sA)} · baaki <b style="color:${sB>0?'var(--rose)':'var(--emerald)'}">${money(sB)}</b>`
    : "";
}
async function saveTenant(){
  const room=val("t_room").trim(), name=val("t_name").trim();
  if(!room && !name) return toast("Flat ya tenant ka naam zaroori hai", true);
  const body={ houseId:val("t_house"), room, name, phone:val("t_phone").trim(),
    fatherName:val("t_father").trim(), aadhaar:val("t_aadhaar").trim(), permAddress:val("t_perm").trim(),
    photo:val("t_photo"), aadhaarPhoto:val("t_aadhaarPhoto"),
    rent:+val("t_rent")||0,
    advanceAgreed:+val("t_advA")||0, advancePaid:+val("t_advP")||0,
    securityAgreed:+val("t_secA")||0, securityPaid:+val("t_secP")||0,
    moveIn:val("t_movein")||curMonth(), status:val("t_status"), note:val("t_note").trim() };
  const id=val("t_id");
  try{ await api(id?"PUT":"POST","/api/tenants"+(id?"/"+id:""), body); resetTenantForm(); await refresh(); toast("Flat saved ✓"); }
  catch(e){ toast(e.message,true); }
}
function editTenant(id){ const t=DB.tenants.find(x=>x.id===id); if(!t) return; closeFlat();
  set("t_id",t.id);set("t_house",t.houseId);set("t_room",t.room);set("t_name",t.name);set("t_father",t.fatherName);
  set("t_phone",t.phone);set("t_aadhaar",t.aadhaar);set("t_perm",t.permAddress);set("t_rent",t.rent);
  set("t_advA",t.advanceAgreed);set("t_advP",t.advancePaid);
  set("t_secA",secAgreed(t));set("t_secP",t.securityPaid);
  set("t_photo",t.photo||"");set("t_aadhaarPhoto",t.aadhaarPhoto||"");
  paintPhoto("t_photoPrev",t.photo||"");paintPhoto("t_aadhaarPrev",t.aadhaarPhoto||"");
  set("t_movein",t.moveIn);set("t_status",t.status);set("t_note",t.note); calcTenantMoney();
  document.getElementById("tFormTitle").textContent="Edit flat / tenant"; gotoTab("flats"); scrollTop(); }
async function delTenant(id){ if(!confirm("Is flat/tenant ko delete karein? Iski rent + bijli sab hat jayegi.")) return;
  try{ await api("DELETE","/api/tenants/"+id); closeFlat(); await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }
function resetTenantForm(){ ["t_id","t_room","t_name","t_father","t_phone","t_aadhaar","t_perm","t_rent","t_advA","t_advP","t_secA","t_secP","t_note","t_photo","t_aadhaarPhoto"].forEach(k=>set(k,""));
  set("t_movein",curMonth()); set("t_status","occupied"); const c=document.getElementById("t_calc"); if(c)c.textContent="";
  paintPhoto("t_photoPrev","");paintPhoto("t_aadhaarPrev","");
  document.getElementById("tFormTitle").textContent="Naya Flat / Tenant"; }

/* record more advance/security received (from dossier) */
async function receiveMoney(tid, kind){
  const t=DB.tenants.find(x=>x.id===tid); if(!t) return;
  const amt=+val(kind==="adv"?"d_adv":"d_sec")||0; if(amt<=0) return toast("Amount daalein", true);
  const body={ houseId:t.houseId, room:t.room, name:t.name, phone:t.phone, fatherName:t.fatherName,
    aadhaar:t.aadhaar, permAddress:t.permAddress, rent:t.rent,
    advanceAgreed:+t.advanceAgreed||0, advancePaid:+t.advancePaid||0,
    securityAgreed:secAgreed(t), securityPaid:+t.securityPaid||0,
    moveIn:t.moveIn, status:t.status, note:t.note };
  if(kind==="adv") body.advancePaid += amt; else body.securityPaid += amt;
  try{ await api("PUT","/api/tenants/"+tid, body); await refresh(); toast((kind==="adv"?"Advance":"Security")+" +"+money(amt)+" ✓"); }
  catch(e){ toast(e.message,true); }
}

/* ---------- rent (from dossier) ---------- */
async function collectRent(tid){
  const amt=+val("d_p_amount")||0; if(amt<=0) return toast("Amount daalein", true);
  const forMonth=val("d_p_month")||curMonth();
  const body={ tenantId:tid, amount:amt, date:val("d_p_date")||today(), forMonth, mode:val("d_p_mode")||"Cash", note:"" };
  try{ await api("POST","/api/payments", body); await refresh(); toast("Rent received 🎉"); launchConfetti(); openReceipt(tid, forMonth); }
  catch(e){ toast(e.message,true); }
}
async function delPayment(id){ if(!confirm("Ye payment delete karein?")) return;
  try{ await api("DELETE","/api/payments/"+id); await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }

/* ---------- bijli / own meter (from dossier) ---------- */
function dCalcElec(){ const prev=+val("d_e_prev")||0, curr=+val("d_e_curr")||0, rate=+val("d_e_rate")||0;
  const units=Math.max(0,curr-prev), amt=Math.round(units*rate);
  const el=document.getElementById("d_e_calc"); if(el) el.textContent = units>0 ? (units+" units × ₹"+rate+" = "+money(amt)) : "";
  if(rate>0 && units>0) set("d_e_amount",amt); }
async function addBijli(tid){
  const prev=+val("d_e_prev")||0, curr=+val("d_e_curr")||0, rate=+val("d_e_rate")||0;
  const units=Math.max(0,curr-prev); const amt=+val("d_e_amount")|| units*rate ||0;
  if(amt<=0) return toast("Amount ya reading daalein", true);
  const body={ tenantId:tid, month:val("d_e_month")||curMonth(), prev, curr, units, rate, amount:Math.round(amt), paid:false, paidDate:"", note:"" };
  try{ await api("POST","/api/ebills", body); await refresh(); toast("Bijli bill saved ✓"); }
  catch(e){ toast(e.message,true); }
}
async function toggleEbill(id){ const b=DB.ebills.find(x=>x.id===id); if(!b) return;
  const body={...b, paid:!b.paid, paidDate:!b.paid?today():""}; delete body.id;
  try{ await api("PUT","/api/ebills/"+id, body); await refresh(); toast(!b.paid?"Paid 🎉":"Marked unpaid"); if(!b.paid) launchConfetti(); }catch(e){ toast(e.message,true); } }
async function delEbill(id){ if(!confirm("Ye bijli bill delete karein?")) return;
  try{ await api("DELETE","/api/ebills/"+id); await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }

/* ---------- motor (common water meter, per property) ---------- */
function prefillMotor(){ const hid=val("m_house"), m=val("m_month"); if(!hid) return;
  if(!val("m_split")){ const n=houseFlats(hid).length||houseOccupied(hid).length; if(n) set("m_split",n); } // default = TOTAL flats (÷5)
  if(!val("m_prev")){ const bills=DB.motorbills.filter(b=>b.houseId===hid&&b.month!==m).sort((a,b)=>(b.month||"").localeCompare(a.month||""));
    if(bills.length) set("m_prev",bills[0].curr); }
  calcMotor(); }
function calcMotor(){ const prev=+val("m_prev")||0, curr=+val("m_curr")||0, rate=+val("m_rate")||0, split=Math.max(1,+val("m_split")||1);
  const units=Math.max(0,curr-prev); const su=Math.round(units/split*100)/100, sa=Math.round(su*rate);
  const el=document.getElementById("m_preview");
  el.innerHTML = units>0
    ? `<div class="mp-line"><span>Total units</span><b>${units}</b></div>`+
      `<div class="mp-line"><span>÷ ${split} flats</span><b>${su} units / flat</b></div>`+
      `<div class="mp-line"><span>× ₹${rate} / unit</span><b class="mp-amt">${money(sa)} / flat</b></div>`+
      `<div class="mp-line total"><span>Total motor bill</span><b>${money(Math.round(units*rate))}</b></div>`
    : ""; }
async function saveMotor(){
  const hid=val("m_house"); if(!hid) return toast("Ghar select karein", true);
  const prev=+val("m_prev")||0, curr=+val("m_curr")||0, rate=+val("m_rate")||0;
  if(curr<=prev) return toast("Current reading prev se zyada honi chahiye", true);
  if(rate<=0) return toast("Rate daalein", true);
  const id=val("m_id"); const existing=id?DB.motorbills.find(b=>b.id===id):null;
  const body={ houseId:hid, month:val("m_month")||curMonth(), prev, curr, rate,
    splitCount:Math.max(1,+val("m_split")||1), note:val("m_note").trim(),
    paid:existing?existing.paid:{}, paidDate:existing?existing.paidDate:{} };
  try{ await api(id?"PUT":"POST","/api/motorbills"+(id?"/"+id:""), body); resetMotorForm(); await refresh(); toast("Motor reading saved ✓"); }
  catch(e){ toast(e.message,true); }
}
function editMotor(id){ const b=DB.motorbills.find(x=>x.id===id); if(!b) return;
  set("m_id",b.id);set("m_house",b.houseId);set("m_month",b.month);set("m_prev",b.prev);set("m_curr",b.curr);
  set("m_rate",b.rate);set("m_split",b.splitCount);set("m_note",b.note); calcMotor();
  document.getElementById("mFormTitle").textContent="Edit motor reading"; gotoTab("props"); scrollTop(); }
async function delMotor(id){ if(!confirm("Ye motor reading delete karein?")) return;
  try{ await api("DELETE","/api/motorbills/"+id); await refresh(); toast("Deleted"); }catch(e){ toast(e.message,true); } }
async function toggleMotorPaid(id,tid){ const b=DB.motorbills.find(x=>x.id===id); if(!b) return;
  const paid={...(b.paid||{})}, paidDate={...(b.paidDate||{})};
  paid[tid]=!paid[tid]; if(paid[tid]) paidDate[tid]=today(); else delete paidDate[tid];
  const body={...b, paid, paidDate}; delete body.id;
  try{ await api("PUT","/api/motorbills/"+id, body); await refresh(); }catch(e){ toast(e.message,true); } }
function resetMotorForm(){ ["m_id","m_prev","m_curr","m_rate","m_split","m_note"].forEach(k=>set(k,"")); set("m_month",curMonth());
  document.getElementById("m_preview").innerHTML=""; document.getElementById("mFormTitle").textContent="Motor reading"; }
function renderMotorHouseSelect(){ const s=document.getElementById("m_house"); const k=s.value;
  s.innerHTML = DB.houses.length ? DB.houses.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join("")
    : '<option value="">— pehle ghar add karein —</option>';
  s.value=k || (DB.houses[0]?DB.houses[0].id:""); }
function renderMotor(){
  const wrap=document.getElementById("motorList");
  const list=DB.motorbills.slice().sort((a,b)=>(b.month||"").localeCompare(a.month||"")||hName(a.houseId).localeCompare(hName(b.houseId)));
  document.getElementById("motorEmpty").hidden=list.length>0;
  wrap.innerHTML=list.map(b=>{
    const flats=houseOccupied(b.houseId), total=Math.round(b.units*b.rate);
    const paidCount=flats.filter(t=>b.paid&&b.paid[t.id]).length;
    const chips=flats.map(t=>{ const p=b.paid&&b.paid[t.id];
      return `<button class="mchip ${p?'paid':'unpaid'}" onclick="toggleMotorPaid('${b.id}','${t.id}')"><span class="mc-dot"></span>${esc(t.room)}${t.name?" · "+esc(t.name.split(' ')[0]):""} — ${money(b.shareAmount)}</button>`;
    }).join("") || '<span class="soft">Is ghar me koi occupied flat nahi.</span>';
    return `<div class="card glass motor-item"><div class="mi-head">
      <div><div class="mi-title">⚙ ${esc(hName(b.houseId))} <span class="soft">· ${monthLabel(b.month)}</span></div>
        <div class="mi-sub">${b.prev} → ${b.curr} · <b>${b.units} units</b> × ₹${b.rate} = <b>${money(total)}</b> · ÷ ${b.splitCount} = <b style="color:var(--cyan)">${money(b.shareAmount)}/flat</b>${b.note?" · "+esc(b.note):""}</div></div>
      <div class="mi-actions"><span class="pill-total">${paidCount}/${flats.length} paid</span>
        <button class="btn sm ghost" onclick="editMotor('${b.id}')">Edit</button>
        <button class="btn sm danger" onclick="delMotor('${b.id}')">✕</button></div>
      </div><div class="mchips">${chips}</div></div>`;
  }).join("");
}

/* ---------- render orchestration ---------- */
function renderAll(){ renderChips(); renderDash(); renderHouses(); renderProfiles(); renderSelects(); renderMotorHouseSelect(); renderMotor(); }

function renderChips(){
  let h='<button class="'+(selHouse===""?"active":"")+'" onclick="pickHouse(\'\')">Sab ghar</button>';
  DB.houses.forEach(x=>{ h+='<button class="'+(selHouse===x.id?"active":"")+'" onclick="pickHouse(\''+x.id+'\')">'+esc(x.name)+'</button>'; });
  document.getElementById("houseChips").innerHTML = DB.houses.length ? h : '<span class="soft">Properties tab se ghar add karein.</span>';
}
function pickHouse(id){ selHouse=id; renderChips(); renderDash(); renderProfiles(); }

/* ---------- dashboard ---------- */
function renderDash(){
  const ts=scopeTenants();
  let totMonthly=0,totDue=0,totPaid=0,secHeld=0,advDueSum=0,secDueSum=0,occ=0,vac=0;
  ts.forEach(t=>{ if(t.status==="vacant")vac++; else{occ++;totMonthly+=+t.rent||0;} secHeld+=+t.securityPaid||0;
    const c=computeT(t); totDue+=c.due; totPaid+=c.paid; advDueSum+=c.advBal; secDueSum+=c.secBal; });
  const ids=new Set(ts.map(t=>t.id));
  let elecPend=0,elecColl=0;
  DB.ebills.forEach(b=>{ if(!ids.has(b.tenantId)) return; if(b.paid) elecColl+=+b.amount||0; else elecPend+=+b.amount||0; });
  DB.motorbills.forEach(m=>{ ts.forEach(t=>{ if(t.houseId!==m.houseId||t.status==="vacant")return;
    const p=m.paid&&m.paid[t.id]; if(p) elecColl+=+m.shareAmount||0; else elecPend+=+m.shareAmount||0; }); });
  const rentBal=Math.max(0,totDue-totPaid), grand=rentBal+elecPend;

  // hero
  document.getElementById("heroHouse").textContent = selHouse ? hName(selHouse) : "Full portfolio";
  const hd=document.getElementById("heroDue"); hd.dataset.to=grand; hd.dataset.fmt="plain";
  document.getElementById("heroSub").textContent = grand>0 ? "total baaki · rent + bijli + motor" : "sab clear — koi baaki nahi ✦";

  document.getElementById("dashStats").innerHTML=
    statN("Flats",ts.length,"int","",occ+" occupied · "+vac+" vacant") +
    statN("Monthly rent",totMonthly,"money","gold","expected / month") +
    statN("Rent collected",totPaid,"money","ok","ab tak total") +
    statN("Rent baaki",rentBal,"money",rentBal>0?"due":"ok") +
    statN("Bijli + Motor baaki",elecPend,"money",elecPend>0?"cyan":"ok",money(elecColl)+" mila") +
    statN("Grand total baaki",grand,"money",grand>0?"due":"ok","rent + bijli + motor") +
    statN("Security held",secHeld,"money","gold","jama hai") +
    statN("Advance+Security baaki",advDueSum+secDueSum,"money",(advDueSum+secDueSum)>0?"warn":"ok",money(advDueSum)+" adv · "+money(secDueSum)+" sec");
  animateCounts(document.getElementById("dashStats"));
  animateCounts(document.querySelector(".hero"));

  // this-month collection gauge
  const cm=curMonth(); let expThis=0,collThis=0;
  ts.forEach(t=>{ if(t.status==="vacant")return; expThis+=+t.rent||0;
    collThis+=DB.payments.filter(p=>p.tenantId===t.id&&p.forMonth===cm).reduce((s,p)=>s+(+p.amount||0),0); });
  const pct=expThis>0?Math.min(100,Math.round(collThis/expThis*100)):0;
  setGauge(pct);

  // overdue
  let rows="",any=false;
  ts.slice().sort((a,b)=>(computeT(b).balance+computeT(b).elec)-(computeT(a).balance+computeT(a).elec)).forEach(t=>{
    const c=computeT(t), tot=Math.max(0,c.balance)+c.elec; if(tot<=0) return; any=true;
    rows+=`<tr onclick="openFlat('${t.id}')" style="cursor:pointer"><td>${esc(hName(t.houseId))}</td><td><b>${esc(t.room)}</b></td><td>${esc(t.name||"—")}</td>`+
      `<td class="r money" style="color:${c.balance>0?"var(--rose)":"var(--ink-soft)"}">${money(Math.max(0,c.balance))}</td>`+
      `<td class="r money" style="color:${c.elec>0?"var(--cyan)":"var(--ink-soft)"}">${money(c.elec)}</td>`+
      `<td class="r money" style="color:var(--rose)">${money(tot)}</td>`+
      `<td class="r"><span class="chev">›</span></td></tr>`;
  });
  document.querySelector("#overdueTbl tbody").innerHTML=rows;
  document.getElementById("overdueTbl").hidden=!any;
  document.getElementById("overdueEmpty").hidden=any;

  renderChart(ids);
  renderHouseMini();
}
function setGauge(pct){
  const g=document.getElementById("collGauge"); const C=2*Math.PI*52;
  const fill=g.querySelector(".g-fill"); fill.style.strokeDasharray=C; fill.style.strokeDashoffset=C*(1-pct/100);
  document.getElementById("collPct").textContent=pct+"%";
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
    let bal=0; ts.forEach(t=>{ const c=computeT(t); bal+=Math.max(0,c.balance)+c.elec; });
    return `<div class="hm-row"><div class="hm-ring" style="--pct:${pct}%"><i>${occ}/${ts.length}</i></div>`+
      `<div class="hm-info"><b>${esc(h.name)}</b><div class="s">${occ} occupied · ${ts.length} flats</div></div>`+
      `<div class="hm-amt" style="color:${bal>0?"var(--rose)":"var(--emerald)"}">${bal>0?money(bal):"clear ✓"}</div></div>`;
  }).join("");
}

/* ---------- properties (house cards) ---------- */
function renderHouses(){
  const g=document.getElementById("houseGrid");
  g.innerHTML=DB.houses.map(h=>{
    const ts=DB.tenants.filter(t=>t.houseId===h.id);
    const occ=ts.filter(t=>t.status!=="vacant").length;
    let rent=0,bal=0,elec=0; ts.forEach(t=>{ if(t.status!=="vacant") rent+=+t.rent||0; const c=computeT(t); bal+=Math.max(0,c.balance); elec+=c.elec; });
    return `<div class="hcard glass"><div class="hhead"><h3>${esc(h.name)}</h3><div class="addr">${esc(h.address||"—")}</div></div>`+
      `<div class="hbody">`+
        `<div class="hstat"><span class="k">Flats</span><span>${ts.length} (${occ} occ)</span></div>`+
        `<div class="hstat"><span class="k">Monthly rent</span><span>${money(rent)}</span></div>`+
        `<div class="hstat"><span class="k">Rent baaki</span><span style="color:${bal>0?"var(--rose)":"var(--emerald)"}">${money(bal)}</span></div>`+
        `<div class="hstat"><span class="k">Bijli+Motor baaki</span><span style="color:${elec>0?"var(--cyan)":"var(--emerald)"}">${money(elec)}</span></div>`+
        `<div class="hactions"><button class="btn sm gold" onclick="viewHouse('${h.id}')">Flats dekho</button>`+
        `<button class="btn sm ghost" onclick="editHouse('${h.id}')">Edit</button>`+
        `<button class="btn sm danger" onclick="delHouse('${h.id}')">✕</button></div>`+
      `</div></div>`;
  }).join("");
  document.getElementById("houseEmpty").hidden=DB.houses.length>0;
}
function viewHouse(id){ selHouse=id; renderChips(); renderProfiles(); gotoTab("flats"); scrollTop(); }

/* ---------- flat profile cards ---------- */
function maskAadhaar(a){ a=String(a||"").replace(/\s+/g,""); if(a.length<4) return a||"—"; return "•••• •••• "+a.slice(-4); }
function pbar(paid,agreed){ const pct=agreed>0?Math.min(100,Math.round(paid/agreed*100)):(paid>0?100:0);
  return `<div class="pbar"><i style="width:${pct}%"></i></div>`; }
function initialOf(t){ return esc((t.name||t.room||"?").trim().charAt(0).toUpperCase()); }
function avatarHtml(t, cls){
  const style = t.photo ? ` style="background-image:url('${t.photo}')"` : "";
  return `<div class="pc-avatar ${cls||''}${t.photo?' has-photo':''}"${style}>${t.photo?"":initialOf(t)}<span class="pc-flat">${esc(t.room||"—")}</span></div>`;
}

function renderProfiles(){
  const box=document.getElementById("profileCards"); if(!box) return;
  const ts = selHouse ? DB.tenants.filter(t=>t.houseId===selHouse) : DB.tenants;
  document.getElementById("roomsEmpty").hidden=ts.length>0;
  box.innerHTML = ts.slice().sort((a,b)=>String(a.room).localeCompare(String(b.room),undefined,{numeric:true})).map(t=>{
    const c=computeT(t); const vac=t.status==="vacant"; const dues=Math.max(0,c.balance)+c.elec;
    const statusTag = vac?'<span class="tag vacant">Vacant</span>':(dues>0?'<span class="tag due">Baaki '+money(dues)+'</span>':'<span class="tag ok">Clear</span>');
    return `<div class="pcard glass ${vac?'is-vacant':''}" onclick="openFlat('${t.id}')">
      <div class="pc-top">
        ${avatarHtml(t,"")}
        <div class="pc-id"><div class="pc-name">${esc(t.name||"—")}</div>
          <div class="pc-meta">${t.fatherName?"S/o "+esc(t.fatherName)+" · ":""}${esc(hName(t.houseId))}</div></div>
        ${statusTag}
      </div>
      <div class="pc-kv">
        <div class="kv"><span>Phone</span><b>${esc(t.phone||"—")}</b></div>
        <div class="kv"><span>Aadhaar</span><b>${esc(maskAadhaar(t.aadhaar))}</b></div>
        <div class="kv"><span>Fixed rent</span><b class="rent">${money(t.rent)}/mo</b></div>
        <div class="kv"><span>Since</span><b>${monthLabel(t.moveIn)}</b></div>
      </div>
      <div class="pc-money">
        <div class="pm-block"><div class="pm-lbl">Advance</div><div class="pm-val">${money(t.advancePaid)} <span class="soft">/ ${money(t.advanceAgreed)}</span></div>${pbar(+t.advancePaid||0,+t.advanceAgreed||0)}<div class="pm-bal ${c.advBal>0?'due':'ok'}">${c.advBal>0?money(c.advBal)+" baaki":"pura ✓"}</div></div>
        <div class="pm-block"><div class="pm-lbl">Security</div><div class="pm-val">${money(t.securityPaid)} <span class="soft">/ ${money(secAgreed(t))}</span></div>${pbar(+t.securityPaid||0,secAgreed(t))}<div class="pm-bal ${c.secBal>0?'due':'ok'}">${c.secBal>0?money(c.secBal)+" baaki":"pura ✓"}</div></div>
      </div>
      <div class="pc-dues">
        <div class="pd"><span>Rent baaki</span><b style="color:${c.balance>0?'var(--rose)':'var(--emerald)'}">${money(Math.max(0,c.balance))}</b></div>
        <div class="pd"><span>Bijli+Motor</span><b style="color:${c.elec>0?'var(--cyan)':'var(--emerald)'}">${money(c.elec)}</b></div>
        <div class="pd tot"><span>Total baaki</span><b style="color:${dues>0?'var(--rose)':'var(--emerald)'}">${money(dues)}</b></div>
      </div>
      <div class="pc-open">Open dossier <span class="chev">›</span></div>
    </div>`;
  }).join("");
}

/* ---------- flat dossier drawer (the hub) ---------- */
function openFlat(tid){ openFlatId=tid; renderFlat(tid); document.getElementById("flatDrawer").classList.add("show"); document.body.style.overflow="hidden"; }
function closeFlat(){ openFlatId=null; document.getElementById("flatDrawer").classList.remove("show"); document.body.style.overflow=""; }
function renderFlat(tid){
  const t=DB.tenants.find(x=>x.id===tid); if(!t){ closeFlat(); return; }
  const c=computeT(t); const vac=t.status==="vacant"; const cm=curMonth();
  const dues=Math.max(0,c.balance)+c.elec;
  const gotThis=DB.payments.filter(p=>p.tenantId===tid&&p.forMonth===cm).reduce((s,p)=>s+(+p.amount||0),0);
  const statusTag = vac?'<span class="tag vacant">Vacant</span>':(dues>0?'<span class="tag due">Baaki '+money(dues)+'</span>':'<span class="tag ok">Clear ✓</span>');

  // rent history
  const pays=DB.payments.filter(p=>p.tenantId===tid).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const payRows=pays.map(p=>`<tr><td>${fmtDate(p.date)}</td><td>${monthLabel(p.forMonth)}</td><td class="r money" style="color:var(--emerald)">${money(p.amount)}</td><td>${esc(p.mode||"")}</td><td class="r"><button class="btn sm danger" onclick="delPayment('${p.id}')">✕</button></td></tr>`).join("")
    || `<tr><td colspan="5" class="soft" style="text-align:center">Abhi koi rent entry nahi.</td></tr>`;

  // bijli history (own meter)
  const bills=DB.ebills.filter(b=>b.tenantId===tid).sort((a,b)=>(b.month||"").localeCompare(a.month||""));
  const billRows=bills.map(b=>`<tr><td>${monthLabel(b.month)}</td><td class="r">${b.prev||"—"}→${b.curr||"—"}</td><td class="r">${b.units||"—"}u</td><td class="r money" style="color:var(--cyan)">${money(b.amount)}</td><td>${b.paid?'<span class="tag ok">Paid</span>':'<span class="tag due">Unpaid</span>'}</td><td class="r"><button class="btn sm ${b.paid?'ghost':'ok'}" onclick="toggleEbill('${b.id}')">${b.paid?'Unpaid':'Paid'}</button> <button class="btn sm danger" onclick="delEbill('${b.id}')">✕</button></td></tr>`).join("")
    || `<tr><td colspan="6" class="soft" style="text-align:center">Abhi koi bijli bill nahi.</td></tr>`;
  const lastCurr = bills.length ? bills[0].curr : "";

  // motor shares
  const motors=DB.motorbills.filter(m=>m.houseId===t.houseId).sort((a,b)=>(b.month||"").localeCompare(a.month||""));
  const motorRows=motors.map(m=>{ const p=m.paid&&m.paid[tid];
    return `<tr><td>${monthLabel(m.month)}</td><td class="r">${m.shareUnits||0}u ÷${m.splitCount}</td><td class="r money" style="color:var(--cyan)">${money(m.shareAmount)}</td><td>${p?'<span class="tag ok">Paid</span>':'<span class="tag due">Unpaid</span>'}</td><td class="r"><button class="btn sm ${p?'ghost':'ok'}" onclick="toggleMotorPaid('${m.id}','${tid}')">${p?'Unpaid':'Paid'}</button></td></tr>`;
  }).join("") || `<tr><td colspan="5" class="soft" style="text-align:center">Is ghar ka koi motor reading nahi. Properties → Motor se add karein.</td></tr>`;

  document.getElementById("flatDrawerBody").innerHTML = `
    <div class="dr-head">
      <button class="close" onclick="closeFlat()" aria-label="Close">×</button>
      <div class="dr-hero">
        ${avatarHtml(t,"dr-avatar")}
        <div><div class="dr-name">${esc(t.name||"—")}</div>
          <div class="dr-meta">${t.fatherName?"S/o "+esc(t.fatherName)+" · ":""}${esc(hName(t.houseId))} · Flat ${esc(t.room||"—")}</div>
          <div style="margin-top:8px">${statusTag}</div></div>
      </div>
    </div>
    <div class="dr-body">
      <div class="dr-kpis">
        <div class="dk"><span>Fixed rent</span><b class="gold">${money(t.rent)}<small>/mo</small></b></div>
        <div class="dk"><span>${monthLabel(cm)} rent</span><b style="color:${gotThis>=(+t.rent||0)&&(+t.rent||0)>0?'var(--emerald)':'var(--ink)'}">${money(gotThis)}</b></div>
        <div class="dk"><span>Total baaki</span><b style="color:${dues>0?'var(--rose)':'var(--emerald)'}">${money(dues)}</b></div>
      </div>

      <div class="dr-sec">KYC</div>
      <div class="dr-kv">
        <div class="kv"><span>Phone</span><b>${esc(t.phone||"—")}</b></div>
        <div class="kv"><span>Aadhaar</span><b>${esc(t.aadhaar||"—")}</b></div>
        <div class="kv wide"><span>Native address</span><b>${esc(t.permAddress||"—")}</b></div>
        <div class="kv"><span>Move-in</span><b>${monthLabel(t.moveIn)}</b></div>
        <div class="kv"><span>Note</span><b>${esc(t.note||"—")}</b></div>
      </div>
      ${(t.photo||t.aadhaarPhoto)?`<div class="kyc-photos">
        ${t.photo?`<div class="kyc-thumb" style="background-image:url('${t.photo}')" onclick="viewFlatImg('${tid}','photo')"><span>Photo</span></div>`:""}
        ${t.aadhaarPhoto?`<div class="kyc-thumb" style="background-image:url('${t.aadhaarPhoto}')" onclick="viewFlatImg('${tid}','aadhaar')"><span>Aadhaar</span></div>`:""}
      </div>`:""}

      <div class="dr-sec">Advance &amp; Security</div>
      <div class="dr-money">
        <div class="dm-block"><div class="pm-lbl">Advance</div><div class="pm-val">${money(t.advancePaid)} <span class="soft">/ ${money(t.advanceAgreed)}</span></div>${pbar(+t.advancePaid||0,+t.advanceAgreed||0)}
          <div class="pm-bal ${c.advBal>0?'due':'ok'}">${c.advBal>0?money(c.advBal)+" baaki":"pura ✓"}</div>
          <div class="mini-add"><input id="d_adv" type="number" min="0" placeholder="mila (₹)"><button class="btn sm gold" onclick="receiveMoney('${tid}','adv')">+ Add</button></div></div>
        <div class="dm-block"><div class="pm-lbl">Security</div><div class="pm-val">${money(t.securityPaid)} <span class="soft">/ ${money(secAgreed(t))}</span></div>${pbar(+t.securityPaid||0,secAgreed(t))}
          <div class="pm-bal ${c.secBal>0?'due':'ok'}">${c.secBal>0?money(c.secBal)+" baaki":"pura ✓"}</div>
          <div class="mini-add"><input id="d_sec" type="number" min="0" placeholder="mila (₹)"><button class="btn sm gold" onclick="receiveMoney('${tid}','sec')">+ Add</button></div></div>
      </div>

      <div class="dr-sec">Rent — collect &amp; history <span class="soft">· ${money(c.paid)} received · ${money(Math.max(0,c.balance))} baaki</span></div>
      <div class="mini-form">
        <input id="d_p_amount" type="number" min="0" placeholder="Amount ₹" value="${+t.rent||''}">
        <input id="d_p_month" type="month" value="${cm}">
        <input id="d_p_date" type="date" value="${today()}">
        <select id="d_p_mode"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Other</option></select>
        <button class="btn sm ok" onclick="collectRent('${tid}')">Receive rent</button>
      </div>
      <div class="tblwrap"><table><thead><tr><th>Date</th><th>For month</th><th class="r">Amount</th><th>Mode</th><th></th></tr></thead><tbody>${payRows}</tbody></table></div>

      <div class="dr-sec">Bijli — apna meter <span class="soft">· baaki ${money(c.meter)}</span></div>
      <div class="mini-form">
        <input id="d_e_month" type="month" value="${cm}">
        <input id="d_e_prev" type="number" min="0" placeholder="Prev" value="${lastCurr}" oninput="dCalcElec()">
        <input id="d_e_curr" type="number" min="0" placeholder="Curr" oninput="dCalcElec()">
        <input id="d_e_rate" type="number" min="0" step="0.01" placeholder="Rate/unit" oninput="dCalcElec()">
        <input id="d_e_amount" type="number" min="0" placeholder="Amount">
        <button class="btn sm cyan" onclick="addBijli('${tid}')">Add bill</button>
      </div>
      <div class="calc" id="d_e_calc"></div>
      <div class="tblwrap"><table><thead><tr><th>Month</th><th class="r">Reading</th><th class="r">Units</th><th class="r">Amount</th><th>Status</th><th></th></tr></thead><tbody>${billRows}</tbody></table></div>

      <div class="dr-sec">Motor / paani share <span class="soft">· baaki ${money(c.motor)}</span></div>
      <div class="tblwrap"><table><thead><tr><th>Month</th><th class="r">Share</th><th class="r">Amount</th><th>Status</th><th></th></tr></thead><tbody>${motorRows}</tbody></table></div>

      <div class="dr-actions">
        <button class="btn ok" onclick="openReceipt('${tid}')">Receipt / PDF</button>
        <button class="btn gold" onclick="openInvoice('${tid}')">Invoice</button>
        <button class="btn ghost" onclick="waShare('${tid}')">WhatsApp</button>
        <button class="btn ghost" onclick="showLedger('${tid}')">Ledger</button>
        <button class="btn ghost" onclick="editTenant('${tid}')">Edit flat</button>
        <button class="btn danger" onclick="delTenant('${tid}')">Delete</button>
      </div>
    </div>`;
}

/* ---------- selects (flat form, motor form, invoice) ---------- */
function renderSelects(){
  const hs=document.getElementById("t_house"); const hk=hs.value;
  hs.innerHTML = DB.houses.length ? DB.houses.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join("")
    : '<option value="">— pehle ghar add karein —</option>';
  hs.value=hk || (DB.houses[0]?DB.houses[0].id:"");
  // invoice tenant select
  let opts='<option value="">— select tenant —</option>';
  DB.houses.forEach(h=>{ const ts=DB.tenants.filter(t=>t.houseId===h.id); if(!ts.length) return;
    opts+=`<optgroup label="${esc(h.name)}">`+ts.map(t=>`<option value="${t.id}">${esc(t.room)}${t.name?" — "+esc(t.name):""}</option>`).join("")+`</optgroup>`; });
  const orphan=DB.tenants.filter(t=>!DB.houses.some(h=>h.id===t.houseId));
  if(orphan.length) opts+=`<optgroup label="Bina ghar">`+orphan.map(t=>`<option value="${t.id}">${esc(t.room)}${t.name?" — "+esc(t.name):""}</option>`).join("")+`</optgroup>`;
  ["inv_tenant","rcpt_tenant"].forEach(id=>{ const s=document.getElementById(id); if(!s) return; const k=s.value; s.innerHTML=opts; s.value=k; });
}

/* ---------- receipt / account statement ---------- */
/* full lifetime statement */
function stmtFor(t){
  const c=computeT(t), tid=t.id;
  const bills=DB.ebills.filter(b=>b.tenantId===tid);
  const billedMeter=bills.reduce((s,b)=>s+(+b.amount||0),0);
  const paidMeter=bills.filter(b=>b.paid).reduce((s,b)=>s+(+b.amount||0),0);
  const motors=t.status==="vacant"?[]:DB.motorbills.filter(m=>m.houseId===t.houseId);
  const billedMotor=motors.reduce((s,m)=>s+(+m.shareAmount||0),0);
  const paidMotor=motors.filter(m=>m.paid&&m.paid[tid]).reduce((s,m)=>s+(+m.shareAmount||0),0);
  return { mode:"full", months:c.months, rentDue:c.due, rentPaid:c.paid, rentBal:Math.max(0,c.balance),
    billedMeter, paidMeter, dueMeter:billedMeter-paidMeter,
    billedMotor, paidMotor, dueMotor:billedMotor-paidMotor,
    charged:c.due+billedMeter+billedMotor, received:c.paid+paidMeter+paidMotor,
    balance:Math.max(0,c.balance)+(billedMeter-paidMeter)+(billedMotor-paidMotor),
    last:DB.payments.filter(p=>p.tenantId===tid).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0] };
}
/* single-month statement */
function stmtForMonth(t,m){
  const tid=t.id;
  const rentDue=t.status==="vacant"?0:(+t.rent||0);
  const rentPaid=DB.payments.filter(p=>p.tenantId===tid&&p.forMonth===m).reduce((s,p)=>s+(+p.amount||0),0);
  const bills=DB.ebills.filter(b=>b.tenantId===tid&&b.month===m);
  const billedMeter=bills.reduce((s,b)=>s+(+b.amount||0),0);
  const paidMeter=bills.filter(b=>b.paid).reduce((s,b)=>s+(+b.amount||0),0);
  const motors=t.status==="vacant"?[]:DB.motorbills.filter(x=>x.houseId===t.houseId&&x.month===m);
  const billedMotor=motors.reduce((s,x)=>s+(+x.shareAmount||0),0);
  const paidMotor=motors.filter(x=>x.paid&&x.paid[tid]).reduce((s,x)=>s+(+x.shareAmount||0),0);
  const rentBal=Math.max(0,rentDue-rentPaid);
  return { mode:"month", m, months:1, rentDue, rentPaid, rentBal,
    billedMeter, paidMeter, dueMeter:billedMeter-paidMeter,
    billedMotor, paidMotor, dueMotor:billedMotor-paidMotor,
    charged:rentDue+billedMeter+billedMotor, received:rentPaid+paidMeter+paidMotor,
    balance:rentBal+(billedMeter-paidMeter)+(billedMotor-paidMotor),
    last:DB.payments.filter(p=>p.tenantId===tid&&p.forMonth===m).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0] };
}
function receiptStmt(t){ const mode=val("rcpt_mode")||"month", m=val("rcpt_month")||curMonth();
  return mode==="full" ? stmtFor(t) : stmtForMonth(t,m); }
function openReceipt(tid, forMonth){ set("rcpt_tenant",tid);
  set("rcpt_mode", forMonth ? "month" : (val("rcpt_mode")||"month"));
  set("rcpt_month", forMonth || val("rcpt_month") || curMonth());
  renderReceipt(); document.getElementById("rcptModal").classList.add("show"); }
function closeRcpt(){ document.getElementById("rcptModal").classList.remove("show"); }
function renderReceipt(){
  const tid=val("rcpt_tenant"); const t=DB.tenants.find(x=>x.id===tid);
  const area=document.getElementById("rcptArea");
  if(!t){ area.innerHTML='<div class="invoice"><p style="text-align:center;color:#8a86a0">Tenant select karein</p></div>'; return; }
  const h=DB.houses.find(x=>x.id===t.houseId)||{}; const s=receiptStmt(t);
  const isMonth=s.mode==="month";
  const period=isMonth?monthLabel(s.m):"Full statement";
  const no="RCPT-"+(isMonth?s.m.replace("-",""):today().replace(/-/g,""))+"-"+tid.slice(0,4).toUpperCase();
  const rentLabel=isMonth?("Rent — "+monthLabel(s.m)):("Rent — "+s.months+" mahine × "+money(t.rent));
  const row=(head,ch,rc,bal)=>`<tr><td>${head}</td><td>${money(ch)}</td><td style="color:#1a9f63">${money(rc)}</td><td style="color:${bal>0?'#d63a58':'#1a9f63'}">${money(bal)}</td></tr>`;
  const advB=advBal(t), secB=secBal(t);
  area.innerHTML=`<div class="invoice receipt">
    <div class="inv-top">
      <div><div class="inv-brand">KHATA<small>estate ledger · ${isMonth?"payment receipt":"account statement"}</small></div></div>
      <div class="inv-meta">${isMonth?"Receipt":"Statement"} <b>${no}</b><br>Date: ${fmtDate(today())}<br>Period: <b>${period}</b></div>
    </div>
    <div class="inv-to"><span class="lbl">Received with thanks from</span><br><b>${esc(t.name||t.room)}</b><br>Flat ${esc(t.room)} · ${esc(h.name||"")}${h.address?" · "+esc(h.address):""}${t.phone?"<br>☎ "+esc(t.phone):""}</div>
    ${s.last?`<div class="rcpt-hero"><span>Amount received · ${fmtDate(s.last.date)} · ${esc(s.last.mode||"")}</span><b>${money(s.last.amount)}</b></div>`:""}
    <table class="inv-table stmt"><thead><tr><th>Head</th><th>Total hua</th><th>Jama kiya</th><th>Baaki</th></tr></thead><tbody>
      ${row(rentLabel, s.rentDue, s.rentPaid, s.rentBal)}
      ${row("Bijli (apna meter)", s.billedMeter, s.paidMeter, s.dueMeter)}
      ${row("Motor / paani share", s.billedMotor, s.paidMotor, s.dueMotor)}
      <tr class="stmt-total"><td>Total</td><td>${money(s.charged)}</td><td style="color:#1a9f63">${money(s.received)}</td><td style="color:${s.balance>0?'#d63a58':'#1a9f63'}">${money(s.balance)}</td></tr>
    </tbody></table>
    <div class="rcpt-dep"><span>Advance: <b>${money(t.advancePaid)}</b> / ${money(t.advanceAgreed)}${advB>0?" · baaki "+money(advB):" ✓"}</span><span>Security: <b>${money(t.securityPaid)}</b> / ${money(secAgreed(t))}${secB>0?" · baaki "+money(secB):" ✓"}</span></div>
    <div class="rcpt-foot">
      <div class="stamp ${s.balance>0?'due':'paid'}">${s.balance>0?"BALANCE DUE<br>"+money(s.balance):"FULLY PAID"}</div>
      <div class="sign"><span></span>Authorised signature</div>
    </div>
    <div class="inv-note">Dhanyavaad 🙏 · Ye ${isMonth?"receipt":"statement"} KHATA se bana hai</div>
  </div>`;
}
function printReceipt(){ if(!val("rcpt_tenant")) return toast("Tenant select karein",true); window.print(); }
function waReceipt(){
  const t=DB.tenants.find(x=>x.id===val("rcpt_tenant")); if(!t) return;
  const s=receiptStmt(t); const period=s.mode==="month"?monthLabel(s.m):"Full (lifetime)";
  const text=`*KHATA — ${s.mode==="month"?"Payment Receipt":"Account Statement"}*\n${hName(t.houseId)} · Flat ${t.room}${t.name?" ("+t.name+")":""}\nPeriod: ${period}\n\n`+
    (s.last?`Jama hua: *${money(s.last.amount)}* (${fmtDate(s.last.date)}, ${s.last.mode||""})\n\n`:"")+
    `Total hua: ${money(s.charged)}\nJama kiya: ${money(s.received)}\n*Baaki: ${money(s.balance)}*\n\n`+
    `Rent baaki: ${money(s.rentBal)}\nBijli baaki: ${money(s.dueMeter)}\nMotor baaki: ${money(s.dueMotor)}\n\nDhanyavaad 🙏`;
  const ph=waDigits(t.phone);
  window.open((ph?`https://wa.me/${ph}`:`https://wa.me/`)+`?text=${encodeURIComponent(text)}`,"_blank");
}

/* ---------- ledger ---------- */
function showLedger(tid){
  const t=DB.tenants.find(x=>x.id===tid); if(!t) return; const c=computeT(t);
  document.getElementById("ledgerName").textContent=t.room+(t.name?" — "+t.name:"");
  document.getElementById("ledgerSummary").innerHTML=
    `${esc(hName(t.houseId))} · Rent ${money(t.rent)}/mo · ${c.months} mahine · Due ${money(c.due)} · Paid <b style="color:var(--emerald)">${money(c.paid)}</b> · Rent baaki <b style="color:${c.balance>0?'var(--rose)':'var(--emerald)'}">${money(Math.max(0,c.balance))}</b> · Bijli+Motor <b style="color:var(--cyan)">${money(c.elec)}</b>`;
  const items=[];
  DB.payments.filter(p=>p.tenantId===tid).forEach(p=>items.push({s:p.date,type:"Rent",dm:fmtDate(p.date),amt:p.amount,detail:monthLabel(p.forMonth)+" · "+(p.mode||"")+(p.note?" · "+p.note:""),col:"var(--emerald)"}));
  DB.ebills.filter(b=>b.tenantId===tid).forEach(b=>items.push({s:b.month,type:"Bijli",dm:monthLabel(b.month),amt:b.amount,detail:(b.units?b.units+"u × ₹"+b.rate+" · ":"")+(b.paid?"Paid":"Unpaid")+(b.note?" · "+b.note:""),col:"var(--cyan)"}));
  DB.motorbills.filter(m=>m.houseId===t.houseId).forEach(m=>items.push({s:m.month,type:"Motor",dm:monthLabel(m.month),amt:m.shareAmount,detail:(m.shareUnits||0)+"u ÷"+m.splitCount+" flats · "+((m.paid&&m.paid[tid])?"Paid":"Unpaid"),col:"var(--cyan)"}));
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
  if(!t){ area.innerHTML='<div class="invoice"><p style="text-align:center;color:#8a93a1">Tenant select karein</p></div>'; return; }
  const h=DB.houses.find(x=>x.id===t.houseId)||{};
  const rent=+t.rent||0;
  const bills=DB.ebills.filter(b=>b.tenantId===tid&&b.month===m);
  const meter=bills.reduce((s,b)=>s+(+b.amount||0),0);
  const motorB=DB.motorbills.filter(mb=>mb.houseId===t.houseId&&mb.month===m);
  const motor=motorB.reduce((s,mb)=>s+(+mb.shareAmount||0),0);
  const elec=meter+motor; const total=rent+elec;
  const invNo="KH-"+m.replace("-","")+"-"+(tid.slice(0,4).toUpperCase());
  let lines=`<tr><td>Flat rent — ${esc(t.room)} <span style="color:#8a93a1">(${monthLabel(m)})</span></td><td>${money(rent)}</td></tr>`;
  if(bills.length) bills.forEach(b=>{ lines+=`<tr><td>Bijli (apna meter) — ${b.units||0} units × ₹${b.rate||0} <span style="color:#8a93a1">(${b.prev}→${b.curr})</span></td><td>${money(+b.amount||0)}</td></tr>`; });
  else lines+=`<tr><td>Bijli (apna meter) — <span style="color:#8a93a1">is mahine ka bill nahi</span></td><td>${money(0)}</td></tr>`;
  if(motorB.length) motorB.forEach(mb=>{ lines+=`<tr><td>Motor / paani share — ${mb.shareUnits||0} units × ₹${mb.rate||0} <span style="color:#8a93a1">(÷ ${mb.splitCount} flats)</span></td><td>${money(+mb.shareAmount||0)}</td></tr>`; });
  const meterPaid=bills.length?bills.every(b=>b.paid):true;
  const motorPaid=motorB.length?motorB.every(mb=>mb.paid&&mb.paid[tid]):true;
  const paidTag = (meterPaid&&motorPaid) ? '<span class="inv-paid y">Bijli PAID</span>' : '<span class="inv-paid n">Bijli DUE</span>';
  area.innerHTML=`<div class="invoice">
    <div class="inv-top">
      <div><div class="inv-brand">KHATA<small>estate ledger · rent &amp; bijli invoice</small></div></div>
      <div class="inv-meta">Invoice <b>${invNo}</b><br>Date: ${fmtDate(today())}<br>Month: <b>${monthLabel(m)}</b></div>
    </div>
    <div class="inv-to"><span class="lbl">Bill to</span><br><b>${esc(t.name||t.room)}</b><br>${esc(h.name||"")}${h.address?" · "+esc(h.address):""}${t.phone?"<br>☎ "+esc(t.phone):""}</div>
    <table class="inv-table"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>
    <div class="inv-total"><div class="box2">
      <div class="ln"><span>Rent</span><span>${money(rent)}</span></div>
      <div class="ln"><span>Bijli + Motor</span><span>${money(elec)}</span></div>
      <div class="ln grand"><span>Total</span><span>${money(total)}</span></div>
    </div></div>
    <div style="text-align:right;margin-top:8px">${paidTag}</div>
    <div class="inv-deposits"><span>Advance: ${money(t.advancePaid)} / ${money(t.advanceAgreed)}${advBal(t)>0?" · baaki "+money(advBal(t)):" ✓"}</span><span>Security: ${money(t.securityPaid)} / ${money(secAgreed(t))}${secBal(t)>0?" · baaki "+money(secBal(t)):" ✓"}</span></div>
    <div class="inv-note">Dhanyavaad · Ye invoice KHATA se bana hai</div>
  </div>`;
}
function printInvoice(){ if(!val("inv_tenant")) return toast("Tenant select karein",true); window.print(); }

/* ---------- backup ---------- */
function exportJSON(){ dl(new Blob([JSON.stringify(DB,null,2)],{type:"application/json"}),"khata-backup-"+today()+".json"); toast("Backup downloaded ✓"); }
function exportCSV(){ const rows=[["Date","House","Flat","Tenant","For Month","Amount","Mode","Note"]];
  DB.payments.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(p=>{ const t=DB.tenants.find(x=>x.id===p.tenantId)||{};
    rows.push([p.date,csv(hName(t.houseId)),csv(t.room),csv(t.name),p.forMonth,p.amount,p.mode,csv(p.note)]); });
  dl(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}),"rent-"+today()+".csv"); toast("Rent CSV ✓"); }
function exportElecCSV(){ const rows=[["Month","House","Flat","Tenant","Prev","Curr","Units","Rate","Amount","Status","Note"]];
  DB.ebills.slice().sort((a,b)=>(a.month||"").localeCompare(b.month||"")).forEach(b=>{ const t=DB.tenants.find(x=>x.id===b.tenantId)||{};
    rows.push([b.month,csv(hName(t.houseId)),csv(t.room),csv(t.name),b.prev,b.curr,b.units,b.rate,b.amount,b.paid?"Paid":"Unpaid",csv(b.note)]); });
  dl(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}),"bijli-"+today()+".csv"); toast("Bijli CSV ✓"); }
async function importJSON(e){ const f=e.target.files[0]; if(!f) return;
  try{ const d=JSON.parse(await f.text()); if(!Array.isArray(d.tenants)&&!Array.isArray(d.houses)) throw new Error("galat file");
    if(!confirm("Backup restore karein? Maujooda data replace ho jayega.")){ e.target.value=""; return; }
    await api("POST","/api/import",d); await refresh(); toast("Restore ho gaya ✓");
  }catch(err){ toast("File sahi nahi: "+err.message,true); } e.target.value=""; }
async function wipeAll(){ if(!confirm("PAKKA? Saara data delete ho jayega.")) return; if(!confirm("Aakhri baar — sab delete?")) return;
  try{ await api("POST","/api/wipe"); selHouse=""; closeFlat(); await refresh(); toast("Sab delete ho gaya"); }catch(e){ toast(e.message,true); } }
function dl(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function csv(s){ return '"'+String(s==null?"":s).replace(/"/g,'""')+'"'; }

/* ---------- whatsapp share ---------- */
function waDigits(p){ p=String(p||"").replace(/\D/g,""); if(p.length===10) p="91"+p; return p; }
function waShare(tid){
  const t=DB.tenants.find(x=>x.id===tid); if(!t) return;
  const m=curMonth(), c=computeT(t), rentB=Math.max(0,c.balance), tot=rentB+c.elec;
  const text=`*KHATA — ${hName(t.houseId)}*\nFlat: ${t.room}${t.name?" ("+t.name+")":""}\nMonth: ${monthLabel(m)}\n\nFixed rent: ${money(t.rent)}\nRent baaki: ${money(rentB)}\nBijli + Motor baaki: ${money(c.elec)}\n*Total baaki: ${money(tot)}*\n\nDhanyavaad 🙏`;
  const ph=waDigits(t.phone);
  window.open((ph?`https://wa.me/${ph}`:`https://wa.me/`)+`?text=${encodeURIComponent(text)}`,"_blank");
}

/* ---------- image lightbox ---------- */
function viewFlatImg(tid,kind){ const t=DB.tenants.find(x=>x.id===tid); if(!t) return;
  const src=kind==="aadhaar"?t.aadhaarPhoto:t.photo; if(!src) return;
  document.getElementById("imgLightboxImg").src=src; document.getElementById("imgLightbox").classList.add("show"); }

/* ---------- extra exports ---------- */
function exportMotorCSV(){ const rows=[["Month","House","Prev","Curr","Units","Rate","Split","Share/flat","Total bill","Paid flats"]];
  DB.motorbills.slice().sort((a,b)=>(a.month||"").localeCompare(b.month||"")).forEach(m=>{
    const flats=houseOccupied(m.houseId), paidC=flats.filter(t=>m.paid&&m.paid[t.id]).length;
    rows.push([m.month,csv(hName(m.houseId)),m.prev,m.curr,m.units,m.rate,m.splitCount,m.shareAmount,Math.round(m.units*m.rate),paidC+"/"+flats.length]); });
  dl(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}),"motor-"+today()+".csv"); toast("Motor CSV ✓"); }
function exportDepositsCSV(){ const rows=[["House","Flat","Tenant","Phone","Aadhaar","Adv agreed","Adv paid","Adv baaki","Sec agreed","Sec paid","Sec baaki"]];
  DB.tenants.forEach(t=>{ rows.push([csv(hName(t.houseId)),csv(t.room),csv(t.name),csv(t.phone),csv(t.aadhaar),+t.advanceAgreed||0,+t.advancePaid||0,advBal(t),secAgreed(t),+t.securityPaid||0,secBal(t)]); });
  dl(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}),"deposits-"+today()+".csv"); toast("Deposits CSV ✓"); }

/* ---------- auth / lock ---------- */
async function loadAuthStatus(){ const el=document.getElementById("authStatus"); if(!el) return;
  try{ const s=await api("GET","/api/auth-status");
    el.innerHTML = s.envLocked ? "🔒 Server env par lock set hai — yahan se change nahi hoga."
      : s.enabled ? "🔒 <b>Lock ON</b> hai. Naya password set karo ya remove karo."
      : "🔓 Abhi koi lock nahi — URL jise mile wo app khol sakta hai.";
  }catch(e){ el.textContent="Status check nahi hua."; } }
async function setPassword(){ const user=val("au_user").trim(), pass=val("au_pass");
  if(!user||pass.length<4) return toast("Username + kam se kam 4-char password", true);
  if(!confirm("Lock enable karein? Agli baar app kholne par browser login maangega. Password bhool gaye to server par data/auth.json delete karna padega.")) return;
  try{ await api("POST","/api/auth",{user,pass}); set("au_pass",""); toast("Lock enabled ✓"); loadAuthStatus(); }
  catch(e){ toast(e.message,true); } }
async function clearPassword(){ if(!confirm("Lock hata dein? App phir public ho jayega.")) return;
  try{ await api("POST","/api/auth",{disable:true}); toast("Lock removed"); loadAuthStatus(); }catch(e){ toast(e.message,true); } }

/* ---------- count-up ---------- */
function animateCounts(root){ if(!root) return;
  if(matchMedia("(prefers-reduced-motion:reduce)").matches){ root.querySelectorAll(".val[data-to]").forEach(el=>el.textContent=fmtVal(+el.dataset.to,el.dataset.fmt)); return; }
  root.querySelectorAll(".val[data-to]").forEach(el=>{
    const to=+el.dataset.to, fmt=el.dataset.fmt, dur=750, t0=performance.now();
    function step(t){ const k=Math.min(1,(t-t0)/dur); const e=1-Math.pow(1-k,3);
      el.textContent=fmtVal(Math.round(to*e),fmt); if(k<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  });
}
function fmtVal(n,fmt){ return fmt==="money"?money(n):(fmt==="plain"?n.toLocaleString("en-IN"):(fmt==="int"?n.toLocaleString("en-IN"):n)); }

/* ---------- confetti ---------- */
let cfx;
function launchConfetti(){
  if(matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const cv=document.getElementById("confetti"); const ctx=cv.getContext("2d");
  cv.width=innerWidth; cv.height=innerHeight;
  const cols=["#e2c489","#d9b779","#f2e4c4","#5fd0cf","#8fe0dc","#54e3a1"];
  const P=Array.from({length:130},()=>({x:innerWidth/2+(Math.random()-.5)*160,y:innerHeight/3,
    vx:(Math.random()-.5)*11,vy:Math.random()*-13-4,g:.4+Math.random()*.2,
    s:6+Math.random()*7,c:cols[(Math.random()*cols.length)|0],r:Math.random()*6,vr:(Math.random()-.5)*.4,life:0}));
  cancelAnimationFrame(cfx);
  function frame(){ ctx.clearRect(0,0,cv.width,cv.height); let alive=false;
    P.forEach(p=>{ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.life++;
      if(p.y<cv.height+30){ alive=true; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
        ctx.globalAlpha=Math.max(0,1-p.life/150); ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); ctx.restore(); } });
    if(alive) cfx=requestAnimationFrame(frame); else ctx.clearRect(0,0,cv.width,cv.height);
  }
  frame();
}

/* ---------- utils ---------- */
function val(id){ const el=document.getElementById(id); return el?el.value:""; }
function set(id,v){ const el=document.getElementById(id); if(el) el.value=(v==null?"":v); }
function statN(l,to,fmt,cls,sub){
  const subHtml = sub ? `<div class="sub">${sub}</div>` : "";
  return `<div class="stat"><div class="lbl">${l}</div><div class="val ${cls||""}" data-to="${to}" data-fmt="${fmt}">0</div>${subHtml}</div>`;
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
let _t;
function toast(msg,err){ const el=document.getElementById("toast"); el.textContent=msg; el.className="toast show"+(err?" err":""); clearTimeout(_t); _t=setTimeout(()=>el.classList.remove("show"),2200); }

document.addEventListener("click",e=>{ if(e.target.id==="ledgerModal") closeModal(); if(e.target.id==="invModal") closeInv(); if(e.target.id==="rcptModal") closeRcpt(); if(e.target.id==="flatDrawer") closeFlat(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeModal(); closeInv(); closeRcpt(); closeFlat(); } });

/* ---------- init ---------- */
resetHouseForm(); resetTenantForm(); resetMotorForm(); loadAuthStatus();
refresh().catch(()=>{ setConn(false); toast("Server se connect nahi hua — 'npm start' chalayein",true); });
