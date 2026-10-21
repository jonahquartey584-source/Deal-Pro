(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Property strategies. Ids must match STRATEGIES in netlify/lib/ai.mts.
const STRATS=[['R2SA','R2SA','Rent-to-serviced accommodation'],['R2R','R2R','Rent-to-rent, let by the room'],['BTL','BTL','Buy-to-let'],['HMO','HMO','Buy and let by the room'],['BRRR','BRRR','Buy, refurbish, refinance, rent'],['Flip','Flip','Buy, refurbish and sell'],['LeaseOption','Lease option','Purchase lease option'],['SA','Owned SA','Owned serviced accommodation'],['Commercial','Commercial','Commercial property']];
const stratName=k=>(STRATS.find(x=>x[0]===k)||[k,k||'R2SA'])[1];
const gbp=x=>{if(!isFinite(x))return '–';const r=Math.round(x+1e-9);return (r<0?'-£':'£')+Math.abs(r).toLocaleString('en-GB')};
const pct=x=>isFinite(x)?Math.round(x*100)+'%':'–';
const store={get(k,d){try{const v=localStorage.getItem('dealpro:'+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem('dealpro:'+k,JSON.stringify(v))}catch(e){}}};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),Math.min(10000,Math.max(2400,String(m).length*70)))}/* longer messages stay up long enough to read */

const DD_TEMPLATE=[
 {k:'terms',t:'Advertised terms',d:'Written offer, rent, deposit, which bills are included (including council tax), usage caps, inventory, availability.'},
 {k:'consent',t:'Short-let consent',d:'Landlord identity and title checked; signed agreement permitting the use; freeholder, lender and insurer consent.'},
 {k:'ninety',t:'Short-let rules',d:'London: 90 nights a year for stays under 90 consecutive nights without planning permission (90+ night lets don’t count). Scotland: short-term let licence and any control area. Wales and elsewhere: planning, Article 4 and council rules for short lets.'},
 {k:'licence',t:'Licensing',d:'Selective / HMO licensing for the ward; whether the licence allows subletting.'},
 {k:'tax',t:'Council tax and rates',d:'Second-home premium, who pays it, and whether business rates apply.'},
 {k:'location',t:'Location claims',d:'Stations, zone, walking times and other advert claims checked against the address.'},
 {k:'safety',t:'Condition and safety',d:'EPC, gas and electrical certificates, fire-risk assessment, alarms, insurance, inventory.'},
 {k:'rates',t:'Nightly rate evidence',d:'Comparable listings, seasonality, event demand, achieved booking data.'}
];
const SAMPLE_AD=`Deal 2 - (£1,650 studio)
📍 Islington, N4 (zone 2) 📍
🔥 Fully Furnished Studio Flat
🛏 Studio (open-plan bedroom)
💸 Rent + Bills £1,650/month (£19,800/year)
💸 Deposit £1,650
💰 Nightly Rate £180`;

function sampleDeal(){return{
  id:'d1',name:'Finsbury Park Studio Pair',area:'Islington, London N4 (Zone 2)',strat:'R2SA',london:true,status:'Analysing',
  units:[{label:'Studio A',rent:1500,dep:1500,rate:165},{label:'Studio B',rent:1650,dep:1650,rate:180}],
  a:{fee:15,clean:45,stay:3,other:150},
  dd:DD_TEMPLATE.map(x=>({k:x.k,s:'none',n:''})),ai:false,
  pack:{biz:'',redress:'',fee:'',nda:true,final:false},
  send:{co:'',email:'',addr:'',ll:'',role:'Owner / landlord',phone:'',lemail:'',use:'Serviced accommodation',docs:'Advert, photos, landlord emails'}
}}
function secondDeal(){const d=sampleDeal();Object.assign(d,{id:'d2',name:'Islington Studio Flats',area:'Islington, London',status:'Due diligence',
  units:[{label:'Studio 1',rent:1700,dep:1700,rate:180},{label:'Studio 2',rent:1700,dep:1569,rate:180},{label:'Studio 3',rent:1700,dep:1700,rate:180}]});return d}
function freshDeal(){const d=sampleDeal();Object.assign(d,{id:'d'+Date.now(),name:'New deal',area:'',london:false,status:'Analysing',units:[{label:'Unit 1',rent:0,dep:0,rate:0}]});return d}

const PLAN_DEFS={Free:{name:'Free',s:6,w:6},Lite:{name:'Deal Community',s:12,w:75},Pro:{name:'Premium',s:30,w:300},Max5:{name:'Max 5x',s:150,w:1500},Max20:{name:'Max 20x',s:600,w:6000}};
// Stripe payment links. A plan with no link here can't be bought online yet, so its
// button asks the customer to get in touch instead of opening the wrong checkout.
const CHECKOUT={
  Lite:'https://buy.stripe.com/6oUfZha6c5X06YoeIg7g40c',
  Pro:'https://buy.stripe.com/aFa8wP5PW1GK4Qg8jS7g40a',
  Max5:'https://buy.stripe.com/9B6aEX7Y4clo1E47fO7g408',
  Max20:'https://buy.stripe.com/7sYcN52DK5X0gyY57G7g409'
};
const CONTACT_EMAIL='jonahquartey584@gmail.com';
function checkoutLink(id){return CHECKOUT[id]}
// Remember a plan change in progress, so the account can be refreshed when the customer comes back.
function markBilling(){try{sessionStorage.setItem('dealpro:billing',JSON.stringify({from:S.plan,at:Date.now()}))}catch(e){}}
async function openPortal(){try{const r=await fetch('/api/billing-portal',{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));
    if(r.ok&&d.url){markBilling();window.location.assign(d.url);return true}}catch(e){}
  toast(`To change or cancel your plan, email ${CONTACT_EMAIL} and we'll sort it the same day.`);return false}
function startCheckout(id){
  // Existing subscribers change or cancel through Stripe's customer portal, so they're never charged twice.
  if(S.stripe&&S.stripe.customer&&S.plan!=='Free'){openPortal();return true}
  const url=checkoutLink(id);if(url){markBilling();window.location.assign(checkoutURL(url));return true}
  if(id==='Free'){toast(`You're on the Free plan.`);return false}
  const name=PLAN_DEFS[id]?PLAN_DEFS[id].name:'this plan';
  toast(`Online checkout for ${name} is coming soon. Email ${CONTACT_EMAIL} and we'll set it up for you.`);return false}
const COST={search:2,import:1,dd:5,pack:3};// hidden usage units per action; deal numbers are free
let S=store.get('state',null);
if(!S||!S.deal){S=Object.assign({plan:'Free',saved:[]},S&&typeof S==='object'?S:{},{deal:freshDeal()})}/* keep the plan and Stripe link even if no deal was saved yet */
// fields added for per-deal unlocks; older saved state loads with these defaults
// migrate older state: credits are replaced by usage limits; old plan names map to the new plans
{const MAP={Starter:'Free',Team:'Free',TeamStd:'Free',TeamPrem:'Free'};if(S.plan==null)S.plan='Free';if(MAP[S.plan])S.plan=MAP[S.plan];if(!PLAN_DEFS[S.plan])S.plan='Pro';delete S.credits;
  S.usage=Object.assign({sStart:null,sUsed:0,wStart:null,wUsed:0},S.usage);S.extra=Object.assign({on:false,cap:20,spent:0,month:null},S.extra);
  S.timeOffset=0;/* the old demo clock buttons are gone; undo any shift they saved */S.billing='monthly';/* monthly billing only */if(!(S.seats>=5))S.seats=5;S.plansTab='individual';/* team plans removed */if(S.maxTier!=='20')S.maxTier='5';}
if(!Array.isArray(S.analysedDealIds))S.analysedDealIds=[];
if(!Array.isArray(S.unlocked))S.unlocked=[];if(!Array.isArray(S.agreements))S.agreements=[];if(!(S.dealFee>=0))S.dealFee=500;if(!Array.isArray(S.saved))S.saved=[];
const save=()=>{store.set('state',S);window.dispatchEvent(new CustomEvent('dealpro:state-saved',{detail:S}))};
/* ---------- usage limits: rolling 5-hour session and 7-day week ---------- */
const HOUR=3600e3,SESSION=5*HOUR,WEEK=7*24*HOUR,XRATE=0.25;
const now=()=>Date.now()+(+S.timeOffset||0);
const limits=()=>PLAN_DEFS[S.plan]||PLAN_DEFS.Free;
const monthKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+(d.getMonth()+1)};
const hhmm=t=>new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const wkday=t=>new Date(t).toLocaleString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'}).replace(',','');
const money=x=>'£'+(Math.round(x*100)/100).toFixed(2);
function rollWindows(){const t=now(),u=S.usage;
  if(u.sStart!=null&&t-u.sStart>=SESSION){u.sStart=null;u.sUsed=0}
  if(u.wStart!=null&&t-u.wStart>=WEEK){u.wStart=null;u.wUsed=0}
  const mk=monthKey(t);if(S.extra.month!==mk){S.extra.month=mk;S.extra.spent=0}}
function fmtLeft(ms){const m=Math.max(1,Math.ceil(ms/60000)),hr=Math.floor(m/60),mi=m%60;return hr?`${hr} hr ${mi} min`:`${mi} min`}
function nextMonth(t){const d=new Date(t);return new Date(d.getFullYear(),d.getMonth()+1,1)}
const FEAT_NAME={import:'Advert import',dd:'Due diligence research',pack:'Deal packs'};
function limitNote(where,kind,feat){const el=$(where);const u=S.usage;let msg;
  if(kind==='feature')msg=`${FEAT_NAME[feat]} ${feat==='pack'?'are':'is'} included with Premium and Max, from £39 a month.`;
  else if(kind==='weekly')msg=`You've reached your weekly limit. It resets ${wkday(u.wStart+WEEK)}.`;
  else if(kind==='cap')msg=`You've reached your extra usage cap for this month. Raise the cap in Usage, or wait until it resets on ${nextMonth(now()).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}.`;
  else msg=`You've reached your session limit. It resets at ${hhmm(u.sStart+SESSION)}.`;
  if(el){el.innerHTML=`<div>${msg}</div><div class="ln-a"><button class="btn sm primary" data-go="plans">Upgrade</button>${kind!=='feature'&&kind!=='cap'&&!S.extra.on&&S.plan!=='Free'?'<button class="btn sm" data-extra-on>Turn on extra usage</button>':''}${kind==='cap'?'<button class="btn sm" data-go="usage">Open usage</button>':''}<button class="btn ghost sm" data-ln-close>Dismiss</button></div>`;el.hidden=false}
  toast(msg)}
function feature(f,where){if(S.plan!=='Free')return true;limitNote(where,'feature',f);return false}
// returns true if the action may go ahead (within limits, or covered by extra usage under the cap)
function spend(n,what,where){rollWindows();const L=limits(),u=S.usage;
  const room=Math.max(0,Math.min(L.s-u.sUsed,L.w-u.wUsed)),over=Math.max(0,n-room);
  if(over>0){const kind=L.w-u.wUsed<n&&u.wStart!=null&&(L.w-u.wUsed)<=(L.s-u.sUsed)?'weekly':'session';
    if(!S.extra.on||S.plan==='Free'){if(u.sStart==null)u.sStart=now();if(u.wStart==null)u.wStart=now();limitNote(where,kind);save();renderUsage();return false}
    const cost=over*XRATE;if(S.extra.spent+cost>S.extra.cap+1e-9){limitNote(where,'cap');return false}
    S.extra.spent+=cost}
  const t=now();if(u.sStart==null)u.sStart=t;if(u.wStart==null)u.wStart=t;u.sUsed+=n;u.wUsed+=n;
  const el=where&&$(where);if(el)el.hidden=true;save();renderUsage();return true}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-extra-on]')){S.extra.on=true;save();renderUsage();$$('.limit-note').forEach(n=>n.hidden=true);toast('Extra usage is on. Try again.');return}
  const c=e.target.closest('[data-ln-close]');if(c){const n=c.closest('.limit-note');if(n)n.hidden=true}});

/* ---------- model ---------- */
const D=30;
function month(u,occ,rate,a){rate=rate??u.rate;const n=Math.round(D*occ),rev=n*rate,fees=rev*a.fee/100,cl=n/Math.max(a.stay,1)*a.clean;return{n,rev,fees,cl,surplus:rev-fees-cl-u.rent-a.other}}
function be(u,a,rate){rate=rate??u.rate;const per=rate*(1-a.fee/100)-a.clean/Math.max(a.stay,1);if(per<=0)return Infinity;return (u.rent+a.other)/per/D}
const OCC=[.6,.8,1];

/* ---------- strategy models: the Numbers step follows the deal's strategy ---------- */
// R2SA keeps the nightly-rate model above. Owned SA uses it with a mortgage in place of rent.
// Purchases (BTL, HMO, BRRR, flip, commercial) and R2R / lease options get their own figures.
const MODEL_OF={R2SA:'sa',SA:'ownsa',R2R:'r2r',HMO:'hmo',BTL:'btl',Commercial:'btl',BRRR:'brrr',Flip:'flip',LeaseOption:'lo'};
const modelOf=d=>MODEL_OF[d&&d.strat]||'sa';
const BUY_MODELS=new Set(['ownsa','btl','hmo','brrr','flip']);
const DEF_P={dep:25,rate:5.5,costs:15,legal:1500,ltv:75,fin:10,months:6,agent:1.5,hold:250};
const dealP=d=>Object.assign({},DEF_P,d.p||{});
// The figures asked for on each unit, per model: [field, label].
const UNIT_FIELDS={
  sa:[['rent','Rent pcm'],['dep','Deposit'],['rate','Nightly rate']],
  ownsa:[['price','Purchase price'],['refurb','Refurb and furnishing'],['rate','Nightly rate']],
  r2r:[['rent','Rent pcm'],['dep','Deposit'],['bills','Bills pcm'],['rooms','Rooms'],['roomRent','Rent per room pcm']],
  hmo:[['price','Purchase price'],['refurb','Refurb'],['bills','Bills pcm'],['rooms','Rooms'],['roomRent','Rent per room pcm']],
  btl:[['price','Purchase price'],['mrent','Rent pcm'],['refurb','Refurb']],
  brrr:[['price','Purchase price'],['refurb','Refurb'],['gdv','End value'],['mrent','Rent pcm after works']],
  flip:[['price','Purchase price'],['refurb','Refurb'],['gdv','Resale value']],
  lo:[['rent','Monthly payment to owner'],['dep','Option fee'],['mrent','Rent pcm from tenant']],
};
// Assumption inputs each model uses (ids in the Assumptions panel).
const ASM_OF={sa:['aFee','aClean','aStay','aOther'],ownsa:['pDep','pRate','pLegal','aFee','aClean','aStay','aOther'],r2r:['aOther'],
  hmo:['pDep','pRate','pCosts','pLegal'],btl:['pDep','pRate','pCosts','pLegal'],brrr:['pRate','pCosts','pLegal','pLtv'],
  flip:['pDep','pFin','pMonths','pHold','pLegal','pAgent'],lo:['pCosts','pLegal']};
const ASM_NOTE={sa:'30-day month. Other costs cover insurance, software, consumables and minor repairs per unit. Rent is treated as bills-included.',
  ownsa:'Interest-only mortgage on the rest of the price. Stamp duty includes the 5% surcharge for additional properties. Other costs cover insurance, software, consumables, bills and minor repairs.',
  r2r:'Profit at 75%, 90% and 100% of rooms let. Other costs cover insurance, software, cleaning of shared areas and minor repairs per unit.',
  btl:'Interest-only mortgage. Running costs cover letting and management, maintenance, insurance and voids, as a share of rent. Stamp duty includes the 5% surcharge for additional properties.',
  hmo:'Interest-only mortgage. Running costs (management, maintenance, insurance, voids) are a share of room rent; bills are on top. Stamp duty includes the 5% surcharge.',
  brrr:'Bought with cash or bridging, then refinanced on an interest-only mortgage at the loan-to-value shown. Stamp duty includes the 5% surcharge.',
  flip:'Bridging interest on the borrowed part of the price for the months held. Selling costs: the agent fee plus VAT and £1,000 legal fees. Stamp duty includes the 5% surcharge.',
  lo:'Running costs cover letting and management, maintenance and voids, as a share of the rent you charge.'};
const nn=v=>+v||0;
const ioMortgage=(loan,rate)=>loan*rate/100/12;// interest-only, monthly
const R2R_OCC=[.75,.9,1];
function unitCalc(m,u,p,a){const price=nn(u.price),ref=nn(u.refurb),sd=price?sdltAdditional(price):0;
  if(m==='btl'||m==='hmo'){const loan=price*(1-p.dep/100),mo=ioMortgage(loan,p.rate),rooms=nn(u.rooms),rent=m==='hmo'?rooms*nn(u.roomRent):nn(u.mrent),
      costs=rent*p.costs/100+(m==='hmo'?nn(u.bills):0),cash=price*p.dep/100+sd+p.legal+ref,cf=rent-mo-costs;
    return {price,ref,sd,loan,mo,rent,costs,cash,cf,dep:price*p.dep/100,stress:rent-ioMortgage(loan,p.rate+2)-costs,gy:price?rent*12/price:NaN,roi:cash?cf*12/cash:NaN,
      lender:loan?rent/ioMortgage(loan,Math.max(p.rate,5.5)):Infinity}}
  if(m==='brrr'){const gdv=nn(u.gdv),moneyIn=price+sd+p.legal+ref,refi=gdv*p.ltv/100,left=moneyIn-refi,mo=ioMortgage(refi,p.rate),rent=nn(u.mrent),costs=rent*p.costs/100,cf=rent-mo-costs;
    return {price,ref,sd,gdv,moneyIn,refi,left,mo,rent,costs,cf,uplift:gdv-price-ref,roi:left>0?cf*12/left:Infinity}}
  if(m==='flip'){const gdv=nn(u.gdv),loan=price*(1-p.dep/100),fin=ioMortgage(loan,p.fin)*p.months,hold=p.hold*p.months,sale=gdv*p.agent/100*1.2+(gdv?1000:0),
      cash=price*p.dep/100+sd+p.legal+ref+fin+hold,profit=gdv-price-sd-p.legal-ref-fin-hold-sale;
    return {price,ref,sd,gdv,loan,fin,hold,sale,cash,profit,dep:price*p.dep/100,margin:gdv?profit/gdv:NaN,roi:cash?profit/cash:NaN}}
  if(m==='lo'){const rent=nn(u.mrent),pay=nn(u.rent),costs=rent*p.costs/100,cf=rent-pay-costs,cash=nn(u.dep)+p.legal;return {rent,pay,costs,cf,cash,fee:nn(u.dep),roi:cash?cf*12/cash:NaN}}
  if(m==='r2r'){const rooms=nn(u.rooms),rr=nn(u.roomRent),bills=nn(u.bills),rent=nn(u.rent),fixed=rent+bills+a.other,full=rooms*rr;
    return {rooms,rr,bills,rent,full,fixed,dep:nn(u.dep),at:o=>full*o-fixed,be:full?fixed/full:Infinity,cash:rent+nn(u.dep)}}
  if(m==='ownsa'){const loan=price*(1-p.dep/100),mo=ioMortgage(loan,p.rate);return {price,ref,sd,loan,mo,dep:price*p.dep/100,cash:price*p.dep/100+sd+p.legal+ref}}
  return {}}
// Does the deal have the figures its model needs?
const NEEDS={sa:u=>nn(u.rent)>0||nn(u.dep)>0||nn(u.rate)>0,ownsa:u=>nn(u.price)>0&&nn(u.rate)>0,r2r:u=>nn(u.rent)>0&&nn(u.rooms)>0&&nn(u.roomRent)>0,
  hmo:u=>nn(u.price)>0&&nn(u.rooms)>0&&nn(u.roomRent)>0,btl:u=>nn(u.price)>0&&nn(u.mrent)>0,brrr:u=>nn(u.price)>0&&nn(u.gdv)>0,flip:u=>nn(u.price)>0&&nn(u.gdv)>0,lo:u=>nn(u.rent)>0&&nn(u.mrent)>0};
const NEEDS_TXT={sa:'the rent, deposit and expected nightly rate',ownsa:'the purchase price and expected nightly rate',r2r:'the rent, number of rooms and rent per room',
  hmo:'the purchase price, number of rooms and rent per room',btl:'the purchase price and the rent',brrr:'the purchase price and the end value after works',flip:'the purchase price and the resale value',lo:'the monthly payment to the owner and the rent from the tenant'};
const modelHas=d=>(d.units||[]).some(NEEDS[modelOf(d)]);
const sumOf=(L,k)=>L.reduce((s,x)=>s+(+x[k]||0),0);
const pctTxt=x=>isFinite(x)?(Math.round(x*1000)/10).toFixed(1).replace(/\.0$/,'')+'%':'–';
// The four headline figures for a deal, whatever its strategy: [label, value text, note, negative?].
function modelStrip(d){const m=modelOf(d),a=d.a,p=dealP(d),U=d.units||[];
  if(m==='sa'||m==='ownsa'){const own=m==='ownsa',C=own?U.map(u=>unitCalc(m,u,p,a)):null,UU=own?U.map((u,i)=>Object.assign({},u,{rent:C[i].mo})):U;
    const tot=OCC.map(o=>UU.reduce((s,u)=>s+month(u,o,null,a).surplus,0)),bes=UU.map(u=>be(u,a)),w=bes.length?Math.max(...bes):NaN;
    return [[own?'Cash needed':'Upfront cash',gbp(own?sumOf(C,'cash'):sumOf(U,'rent')+sumOf(U,'dep')),own?'Deposit, stamp duty, fees, refurb':'Deposits and first month'],
      ['Surplus at 60%',gbp(tot[0]),'Per month, all units',tot[0]<0],['Surplus at 80%',gbp(tot[1]),'Per month, all units',tot[1]<0],
      ['Break-even',isFinite(w)?pct(w):'Never','Occupancy, weakest unit'],{t60:tot[0],t80:tot[1],up:own?sumOf(C,'cash'):sumOf(U,'rent')+sumOf(U,'dep'),monthly:tot[1]}]}
  const C=U.map(u=>unitCalc(m,u,p,a));
  if(m==='btl'||m==='hmo'){const cash=sumOf(C,'cash'),cf=sumOf(C,'cf'),gy=sumOf(C,'price')?sumOf(C,'rent')*12/sumOf(C,'price'):NaN,roi=cash?cf*12/cash:NaN;
    return [['Cash needed',gbp(cash),'Deposit, stamp duty, fees, refurb'],['Cash flow',gbp(cf),'Per month after mortgage and costs',cf<0],['Gross yield',pctTxt(gy),m==='hmo'?'Room rent a year ÷ price':'Rent a year ÷ price'],['Return on cash',pctTxt(roi),'Cash flow a year ÷ cash needed',roi<0],{up:cash,monthly:cf}]}
  if(m==='brrr'){const mi=sumOf(C,'moneyIn'),left=sumOf(C,'left'),cf=sumOf(C,'cf'),roi=left>0?cf*12/left:Infinity;
    return [['Money in',gbp(mi),'Price, stamp duty, fees, refurb'],['Left in after refinance',left<=0?`${gbp(-left)} out`:gbp(left),left<=0?'All your money back, and more':'Stays in the deal',left>0&&left>mi*.5],['Cash flow',gbp(cf),'Per month after refinance',cf<0],['Return on money left in',isFinite(roi)?pctTxt(roi):'Infinite','Cash flow a year ÷ money left in',roi<0],{up:mi,monthly:cf}]}
  if(m==='flip'){const cash=sumOf(C,'cash'),profit=sumOf(C,'profit'),gdv=sumOf(C,'gdv'),mg=gdv?profit/gdv:NaN,roi=cash?profit/cash:NaN;
    return [['Cash in',gbp(cash),'Deposit, costs, refurb, finance'],['Profit',gbp(profit),'After all buying, holding and selling costs',profit<0],['Margin',pctTxt(mg),'Profit ÷ resale value',mg<.15],['Return on cash',pctTxt(roi),`Over ${dealP(d).months} months`,roi<0],{up:cash,monthly:null}]}
  if(m==='lo'){const cash=sumOf(C,'cash'),cf=sumOf(C,'cf'),roi=cash?cf*12/cash:NaN;
    return [['Upfront',gbp(cash),'Option fee and legal costs'],['Cash flow',gbp(cf),'Per month after the payment and costs',cf<0],['Cash flow a year',gbp(cf*12),'Before tax',cf<0],['Return on upfront',pctTxt(roi),'Cash flow a year ÷ upfront',roi<0],{up:cash,monthly:cf}]}
  if(m==='r2r'){const at=o=>C.reduce((s,c)=>s+c.at(o),0),w=C.length?Math.max(...C.map(c=>c.be)):NaN,up=sumOf(C,'cash');
    return [['Upfront cash',gbp(up),'Deposits and first month'],['Profit at 90%',gbp(at(.9)),'Rooms let, per month',at(.9)<0],['Profit at 100%',gbp(at(1)),'Per month, all rooms let',at(1)<0],['Break-even',isFinite(w)?pct(w):'Never','Rooms let, weakest unit'],{up,monthly:at(.9)}]}
  return []}
// One line per unit, for due diligence research and the Deal Notice.
function unitText(d,u){const m=modelOf(d);
  if(BUY_MODELS.has(m))return `${u.label}: purchase price ${gbp(nn(u.price))}${nn(u.mrent)?`, rent ${gbp(nn(u.mrent))}/month`:''}${nn(u.rooms)?`, ${nn(u.rooms)} rooms at ${gbp(nn(u.roomRent))}`:''}${nn(u.refurb)?`, refurb ${gbp(nn(u.refurb))}`:''}${nn(u.gdv)?`, ${m==='flip'?'resale':'end'} value ${gbp(nn(u.gdv))}`:''}${m==='ownsa'&&u.rate?`, nightly rate £${u.rate}`:''}`;
  if(m==='lo')return `${u.label}: monthly payment ${gbp(nn(u.rent))}, option fee ${gbp(nn(u.dep))}, rent from tenant ${gbp(nn(u.mrent))}/month`;
  if(m==='r2r')return `${u.label}: rent ${gbp(nn(u.rent))}/month, deposit ${gbp(nn(u.dep))}, ${nn(u.rooms)} rooms at ${gbp(nn(u.roomRent))}, bills ${gbp(nn(u.bills))}/month`;
  return `${u.label}: rent ${gbp(nn(u.rent))}/month, deposit ${gbp(nn(u.dep))}${u.rate?`, nightly rate £${u.rate}`:''}`}
// Numbers step for the models other than R2SA and owned SA.
function renderModel(d,m){const a=d.a,p=dealP(d),U=d.units,C=U.map(u=>unitCalc(m,u,p,a)),S4=modelStrip(d);
  let h=`<div class="strip" role="group" aria-label="Deal summary">${S4.slice(0,4).map(([l,v,s,neg])=>`<div class="fig"><div class="fig-l">${l}</div><div class="fig-v${neg?' neg':''}">${v}</div><div class="fig-s">${s}</div></div>`).join('')}</div>`;
  const al=[];
  if(m==='btl'||m==='hmo'){C.forEach((c,i)=>{if(c.cf<0)al.push(`<div class="alert bad"><b>${esc(U[i].label)} loses money each month</b> after the mortgage and running costs (${gbp(c.cf)}).</div>`);
      else if(c.lender<1.25)al.push(`<div class="alert warn"><b>${esc(U[i].label)} may fail a lender's rent check.</b> Lenders usually want the rent to be at least 125% (often 145%) of the mortgage interest at a stressed rate. Here it is ${pct(c.lender)}. A bigger deposit or a limited company mortgage may be needed.</div>`)});
    if(m==='hmo'&&U.some(u=>nn(u.rooms)>=5))al.push(`<div class="alert warn"><b>HMO licence.</b> Five or more tenants from two or more households need a mandatory HMO licence. Check the council's additional licensing and any Article 4 direction before buying.</div>`)}
  if(m==='brrr')C.forEach((c,i)=>{if(c.uplift<=0)al.push(`<div class="alert bad"><b>${esc(U[i].label)}: the end value doesn't cover the price and refurb.</b> There is no uplift to refinance.</div>`);
    else if(c.left>0)al.push(`<div class="alert warn"><b>${esc(U[i].label)}: ${gbp(c.left)} stays in the deal</b> after refinancing at ${p.ltv}% of the end value. The refinance depends on the lender's valuation.</div>`);
    if(c.cf<0)al.push(`<div class="alert bad"><b>${esc(U[i].label)} loses money each month</b> after refinancing (${gbp(c.cf)}).</div>`)});
  if(m==='flip')C.forEach((c,i)=>{if(c.profit<0)al.push(`<div class="alert bad"><b>${esc(U[i].label)} makes a loss</b> of ${gbp(-c.profit)} after costs.</div>`);
    else if(c.margin<.15)al.push(`<div class="alert warn"><b>${esc(U[i].label)}: a thin margin</b> of ${pctTxt(c.margin)}. Many investors aim for 20% of the resale value to cover overruns and price drops.</div>`)});
  if(m==='r2r'){C.forEach((c,i)=>{if(c.be>.9)al.push(`<div class="alert ${c.be>1?'bad':'warn'}"><b>${esc(U[i].label)} needs ${isFinite(c.be)?pct(c.be):'more than 100%'} of rooms let</b> to break even.</div>`)});
    al.push(`<div class="alert warn"><b>Landlord's consent.</b> Get written permission to let by the room. Five or more tenants from two or more households need an HMO licence.</div>`)}
  if(m==='lo')C.forEach((c,i)=>{if(c.cf<0)al.push(`<div class="alert bad"><b>${esc(U[i].label)} loses money each month</b> (${gbp(c.cf)}).</div>`)});
  if(!al.length)al.push(`<div class="alert good">No automatic flags. Due diligence still needs to be completed.</div>`);
  h+=`<div class="alerts">${al.join('')}</div>`;
  const multi=U.length>1;
  const tbl=(title,meta,rows)=>`<section class="sec"><div class="sec-h"><h2>${title}</h2><span class="sec-meta">${meta}</span></div><div class="tw"><table><thead><tr><th>Per unit</th>${U.map(u=>`<th class="gh">${esc(u.label)}</th>`).join('')}${multi?'<th class="gh">All units</th>':''}</tr></thead><tbody>
    ${rows.map(([lab,f,cls,fmt])=>{const vals=C.map(f),all=multi&&fmt!=='none'?vals.reduce((s,v)=>s+(isFinite(v)?v:0),0):null,show=v=>fmt==='pct'?pctTxt(v):typeof v==='number'?gbp(v):v;
      return `<tr class="${cls||''}"><td>${lab}</td>${vals.map(v=>`<td class="n${typeof v==='number'&&v<0?' neg':''}">${show(v)}</td>`).join('')}${multi?`<td class="n">${fmt==='pct'||fmt==='none'?'':gbp(all)}</td>`:''}</tr>`}).join('')}
  </tbody></table></div></section>`;
  if(m==='btl'||m==='hmo'){
    h+=tbl('Buying costs','Cash needed to complete',[['Purchase price',c=>c.price],[`Deposit (${p.dep}%)`,c=>c.dep],['Stamp duty (est.)',c=>c.sd],['Legal and survey',()=>p.legal],['Refurb',c=>c.ref],['Cash needed',c=>c.cash,'total']]);
    h+=tbl('Monthly cash flow','Interest-only mortgage',[[m==='hmo'?'Room rent (all rooms)':'Rent',c=>c.rent],[`Mortgage interest (${p.rate}%)`,c=>-c.mo],[m==='hmo'?`Running costs (${p.costs}%) and bills`:`Running costs (${p.costs}%)`,c=>-c.costs],['Cash flow',c=>c.cf,'total'],[`If rates rise to ${p.rate+2}%`,c=>c.stress],['Gross yield',c=>c.gy,'','pct'],['Return on cash a year',c=>c.roi,'','pct']]);
  }else if(m==='brrr'){
    h+=tbl('Money in','Before refinancing',[['Purchase price',c=>c.price],['Stamp duty (est.)',c=>c.sd],['Legal and survey',()=>p.legal],['Refurb',c=>c.ref],['Money in',c=>c.moneyIn,'total']]);
    h+=tbl('Refinance',`At ${p.ltv}% of the end value`,[['End value',c=>c.gdv],['Uplift over price and refurb',c=>c.uplift],[`New mortgage (${p.ltv}%)`,c=>c.refi],['Money left in',c=>c.left,'total']]);
    h+=tbl('Monthly cash flow','After refinancing, interest-only',[['Rent',c=>c.rent],[`Mortgage interest (${p.rate}%)`,c=>-c.mo],[`Running costs (${p.costs}%)`,c=>-c.costs],['Cash flow',c=>c.cf,'total'],['Return on money left in a year',c=>c.roi,'','pct']]);
  }else if(m==='flip'){
    h+=tbl('Costs','Buying, holding and selling',[['Purchase price',c=>c.price],['Stamp duty (est.)',c=>c.sd],['Legal and survey',()=>p.legal],['Refurb',c=>c.ref],[`Bridging interest (${p.fin}%, ${p.months} months)`,c=>c.fin],[`Holding costs (${p.months} months)`,c=>c.hold],[`Selling costs (${p.agent}% + VAT, legal)`,c=>c.sale]]);
    h+=tbl('Profit','When sold at the resale value',[['Resale value',c=>c.gdv],['Profit',c=>c.profit,'total'],['Margin on resale value',c=>c.margin,'','pct'],['Cash in',c=>c.cash],['Return on cash',c=>c.roi,'','pct']]);
  }else if(m==='lo'){
    h+=tbl('Monthly cash flow','Per month',[['Rent from tenant',c=>c.rent],['Payment to owner',c=>-c.pay],[`Running costs (${p.costs}%)`,c=>-c.costs],['Cash flow',c=>c.cf,'total'],['Upfront (option fee and legal)',c=>c.cash],['Return on upfront a year',c=>c.roi,'','pct']]);
  }else if(m==='r2r'){
    const h1=`<tr><th rowspan="2">Per unit, per month</th>${U.map(u=>`<th colspan="3" class="gh gs">${esc(u.label)}</th>`).join('')}</tr>`,h2=`<tr>${U.map(()=>R2R_OCC.map((o,j)=>`<th class="${j?'':'gs'}">${pct(o)}</th>`).join('')).join('')}</tr>`;
    const row=(lab,f,cls='')=>`<tr class="${cls}"><td>${lab}</td>${C.map(c=>R2R_OCC.map((o,j)=>{const v=f(c,o);return `<td class="n${j?'':' gs'}${typeof v==='number'&&v<0?' neg':''}">${typeof v==='number'?gbp(v):v}</td>`}).join('')).join('')}</tr>`;
    h+=`<section class="sec"><div class="sec-h"><h2>Monthly model</h2><span class="sec-meta">Per unit with 75%, 90% and 100% of rooms let</span></div><div class="tw"><table><thead>${h1}${h2}</thead><tbody>
      ${row('Rooms let (average)',(c,o)=>(Math.round(c.rooms*o*10)/10).toString())}${row('Room income',(c,o)=>c.full*o)}${row('Rent to landlord',c=>-c.rent)}${row('Bills',c=>-c.bills)}${row('Other costs',()=>-a.other)}${row('Profit',(c,o)=>c.at(o),'total')}
    </tbody></table></div><p class="note">Rent per room from the unit's figures. Illustrative only, not a forecast.</p></section>`;
  }
  h+=`<p class="note">${ASM_NOTE[m]} Figures are estimates for checking a deal, not financial advice.</p>`;
  return h}

/* ---------- shell / nav ---------- */
function renderTop(){$('#planPill').textContent=limits().name+' plan';renderUsage();renderFreeCounter()}
/* ---------- free plan: 2 lifetime deal analyses ---------- */
const FREE_ANALYSES=2;
const isExample=d=>!!d&&d.id==='d1';// the preloaded Finsbury Park example never counts
const analysesUsed=()=>S.analysedDealIds.length;
const canAnalyseNew=()=>S.plan!=='Free'||analysesUsed()<FREE_ANALYSES;
function renderFreeCounter(){const box=$('#wsFree');if(!box)return;const free=S.plan==='Free',n=Math.min(analysesUsed(),FREE_ANALYSES);box.hidden=!free;
  $('#wsFreeTxt').textContent=`${n} of ${FREE_ANALYSES} free analyses used`;const b=$('#wsFreeBar');b.style.width=(n/FREE_ANALYSES*100)+'%';b.classList.toggle('full',n>=FREE_ANALYSES);
  if($('#dealMeta')&&S.deal&&S.deal.units)renderMeta()}
function markAnalysed(id){if(!isExample({id})&&!S.analysedDealIds.includes(id))S.analysedDealIds.push(id);save();renderFreeCounter()}
// every path that creates a new analysis goes through here; a 3rd one on Free opens the paywall instead
function startAnalysis(run){if(canAnalyseNew()){run();return true}openPaywall(run);return false}
function renderUsage(){rollWindows();const L=limits(),u=S.usage,t=now();
  const sp=Math.min(100,Math.round(u.sUsed/L.s*100)),wp=Math.min(100,Math.round(u.wUsed/L.w*100));
  const bar=(id,p)=>{const b=$(id);if(b){b.style.width=p+'%';b.classList.toggle('full',p>=100)}};
  bar('#wsUseBar',sp);$('#wsUseTxt').textContent=`${sp}% of session used`;$('#wsPct').textContent=`${sp}% used`;
  if(!$('#uSessBar'))return;
  $('#usagePlan').textContent=`${L.name} plan limits`;
  bar('#uSessBar',sp);$('#uSessPct').textContent=`${sp}% used`;
  $('#uSessReset').textContent=u.sStart==null?'Starts when you next use Deal Pro':`Resets in ${fmtLeft(u.sStart+SESSION-t)}`;
  bar('#uWeekBar',wp);$('#uWeekPct').textContent=`${wp}% used`;
  $('#uWeekReset').textContent=u.wStart==null?'Starts when you next use Deal Pro':`Resets ${wkday(u.wStart+WEEK)}`;
  const x=S.extra,sw=$('#xOn');sw.setAttribute('aria-checked',String(!!x.on));
  const cap=$('#xCap');if(document.activeElement!==cap)cap.value=x.cap;
  $('#xSpentTxt').textContent=`${money(x.spent)} of £${Math.round(x.cap*100)/100} used`;bar('#xBar',x.cap>0?Math.min(100,Math.round(x.spent/x.cap*100)):0);
  $('#xMonth').textContent=`Resets ${nextMonth(t).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`}
setInterval(()=>{try{renderUsage()}catch(e){}},30000);
function syncName(){const n=S.deal.name||'Untitled deal';$('#dealTitle').textContent=n;$$('.js-dealname').forEach(e=>e.textContent=n)}
const VIEWS={usage:['plans','usage'],refer:['plans','refer'],home:['home'],find:['find'],analyser:['analyser'],deals:['deals'],community:['community'],plans:['plans'],
  analyse:['analyser','numbers'],dd:['analyser','dd'],pack:['analyser','pack'],send:['analyser','send'],pricing:['plans']};// old tab names map to the new structure
const STEPS=['numbers','dd','pack','send'];
function curStep(){let s='numbers';try{s=sessionStorage.getItem('dealpro:step')||'numbers'}catch(e){}return STEPS.includes(s)?s:'numbers'}
let curView=null;
function go(v,step){const m=VIEWS[v]||VIEWS.home;v=m[0];step=step||m[1];const changed=curView!==v;
  const apply=()=>{curView=v;document.documentElement.dataset.page=v;
    $$('.tab').forEach(t=>{if(t.dataset.v===v)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current')});
    $$('[data-view]').forEach(s=>s.hidden=s.dataset.view!==v);
    if(v==='home')renderHome();if(v==='find'){renderFind();loadAICredits()}if(v==='analyser'){openAnalyser(step||curStep());loadAICredits()}if(v==='deals')renderDeals();if(v==='community')renderCommunity();if(v==='plans'){renderPlans();loadRefunds();loadReferrals()}
    try{sessionStorage.setItem('dealpro:tab',v)}catch(e){}
    const nav=$('.nav'),act=$(`.tab[data-v="${v}"]`);if(nav&&act&&nav.scrollWidth>nav.clientWidth)nav.scrollLeft=Math.max(0,act.offsetLeft-nav.offsetLeft-24);
    if(v==='plans'&&(step==='usage'||step==='refer')){const us=$(step==='refer'?'#refer':'#usage');if(us)setTimeout(()=>us.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'}),30)}else window.scrollTo(0,0);heroUpdate();placeInd()};
  // one smooth cross-fade with a slight rise between views; instant under reduced motion
  if(changed&&curView&&!reduced()&&document.startViewTransition){try{document.startViewTransition(apply);return}catch(e){}}
  apply();
  if(changed&&!reduced()&&!document.startViewTransition){const sec=$(`[data-view="${v}"]`);if(sec){sec.classList.remove('enter');void sec.offsetWidth;sec.classList.add('enter')}}}
function openAnalyser(step){const has=!!(S.deal&&Array.isArray(S.deal.units));$('#anEmpty').hidden=has;$('#anMain').hidden=!has;if(has)setStep(step)}
function setStep(s){if(!STEPS.includes(s))s='numbers';
  $$('[data-step-panel]').forEach(p=>p.hidden=p.dataset.stepPanel!==s);
  const was=($('.stp[aria-current="step"]')||{}).dataset;
  $$('.stp').forEach(b=>{if(b.dataset.step===s)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
  if(was&&was.step!==s&&!reduced()){const pn=$(`[data-step-panel="${s}"]`);pn.classList.remove('enter');void pn.offsetWidth;pn.classList.add('enter')}
  placeInd();
  if(s==='dd')renderDD();if(s==='pack')renderPack();if(s==='send')renderNotice();
  renderStepBar();try{sessionStorage.setItem('dealpro:step',s)}catch(e){}}
function placeInd(){const ind=$('.stp-ind'),a=$('.stp[aria-current="step"]');if(!ind||!a||!a.offsetWidth)return;ind.style.width=a.offsetWidth+'px';ind.style.transform=`translateX(${a.offsetLeft}px)`}
addEventListener('resize',placeInd);
function renderStepBar(){const d=S.deal;if(!d||!$('#stpS-numbers'))return;const U=d.units||[];
  const n=(d.dd||[]).filter(x=>x&&x.s&&x.s!=='none').length,tot=DD_TEMPLATE.length;
  const st=(id,dot,txt)=>{$('#stpS-'+id).innerHTML=txt?`<span class="dot ${dot}"></span>${txt}`:''};
  st('numbers',U.length?'good':'none',U.length?'Done':'Add a unit');
  st('dd',n===tot?'good':n?'warn':'none',`${n}/${tot} checked`);
  st('pack',d.pack&&d.pack.final?'good':'none',d.pack&&d.pack.final?'Generated':'Not generated');
  st('send','','')}
$$('.stp').forEach(b=>b.addEventListener('click',()=>{setStep(b.dataset.step);const t=$('.stepbar');if(t&&t.getBoundingClientRect().top<0)t.scrollIntoView({block:'start'})}));
document.addEventListener('click',e=>{const b=e.target.closest('[data-step-go]');if(b){setStep(b.dataset.stepGo);window.scrollTo(0,0)}});
$$('.tab').forEach(t=>t.addEventListener('click',()=>go(t.dataset.v)));
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g)go(g.dataset.go)});

/* ---------- analyse ---------- */
function bindDeal(){const d=S.deal;try{renderStratOpts()}catch(e){}/* defined later in the script */
  $('#dName').value=d.name;$('#dArea').value=d.area;$('#dStrat').value=d.strat;$('#dLondon').checked=d.london;
  $('#aFee').value=d.a.fee;$('#aClean').value=d.a.clean;$('#aStay').value=d.a.stay;$('#aOther').value=d.a.other;renderUnits();renderResults()}
function renderUnits(){const d=S.deal;
  $('#units').innerHTML=d.units.map((u,i)=>`<div class="unit" style="${i?'border-top:1px solid var(--line);padding-top:12px;margin-top:12px':''}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="mono muted" style="font-size:12px;min-width:14px">${i+1}</span>
    <input class="inp" style="font-weight:500;height:30px" id="u${i}label" data-i="${i}" data-f="label" value="${esc(u.label)}" aria-label="Unit name">
    ${u.url?`<a class="xlink" style="font-size:12.5px" href="${esc(u.url)}" target="_blank" rel="noopener" aria-label="Open listing for ${esc(u.label)}">Listing ↗</a>`:''}
    ${d.units.length>1?`<button class="btn ghost sm" data-rm="${i}" aria-label="Remove ${esc(u.label)}">Remove</button>`:''}</div>
    ${(()=>{const F=UNIT_FIELDS[modelOf(d)],rows=[];for(let k=0;k<F.length;k+=3)rows.push(F.slice(k,k+3));
      return rows.map(r=>`<div class="row3" style="padding-left:22px${rows.length>1?';margin-bottom:8px':''}">${r.map(([f,lab])=>{const money=f!=='rooms';
        return `<label class="f"><span>${lab}</span><span class="ix">${money?'<span class="pre">£</span>':''}<input class="inp num" type="number" min="0" id="u${i}${f}" data-i="${i}" data-f="${f}" value="${nn(u[f])}"></span></label>`}).join('')}</div>`).join('')})()}
</div></div>`).join('');
}
$('#units').addEventListener('input',e=>{const el=e.target;if(!el.dataset.f)return;const u=S.deal.units[+el.dataset.i];u[el.dataset.f]=el.dataset.f==='label'?el.value:(+el.value||0);tweenNext=true;renderResults();save()});
$('#units').addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(!b)return;S.deal.units.splice(+b.dataset.rm,1);renderUnits();renderResults();save()});
$('#addUnit').addEventListener('click',()=>{const n=S.deal.units.length+1;S.deal.units.push({label:'Unit '+n,rent:0,dep:0,rate:0,price:0,mrent:0,refurb:0,gdv:0,rooms:0,roomRent:0,bills:0});renderUnits();renderResults();save()});
[['#dName','name'],['#dArea','area'],['#dStrat','strat']].forEach(([s,k])=>$(s).addEventListener('input',e=>{S.deal[k]=e.target.value;syncName();renderMeta();if(k==='strat'){renderUnits();renderResults()}save()}));
// Typing the area ticks or clears "In London" (it can still be changed by hand).
$('#dArea').addEventListener('change',e=>{const v=e.target.value.trim();if(!v)return;const lon=isLondonText(v);if(lon!==!!S.deal.london){S.deal.london=lon;$('#dLondon').checked=lon;renderResults();save()}});
$('#dLondon').addEventListener('change',e=>{S.deal.london=e.target.checked;tweenNext=true;renderResults();save()});
const P_IN=[['pDep','dep'],['pRate','rate'],['pCosts','costs'],['pLegal','legal'],['pLtv','ltv'],['pFin','fin'],['pMonths','months'],['pHold','hold'],['pAgent','agent']];
P_IN.forEach(([id,k])=>{const el=$('#'+id);if(el)el.addEventListener('input',e=>{S.deal.p=Object.assign({},dealP(S.deal),{[k]:+e.target.value||0});tweenNext=true;renderResults();save()})});
// The Assumptions panel shows the inputs the deal's strategy uses.
function renderAsm(){const d=S.deal,m=modelOf(d),on=new Set(ASM_OF[m]),p=dealP(d);
  $$('[data-asm]').forEach(el=>{el.hidden=!on.has(el.dataset.asm)});P_IN.forEach(([id,k])=>{const el=$('#'+id);if(el&&document.activeElement!==el)el.value=p[k]});
  const n=$('#asmNote');if(n)n.textContent=ASM_NOTE[m];const ni=$('#numIntro');if(ni)ni.textContent=NUM_INTRO[m]}
const NUM_INTRO={sa:'Monthly model per unit at 60%, 80% and 100% occupancy, with break-even, lower-rate sensitivity and the London 90-night check.',
  ownsa:'Nightly-rate model with an interest-only mortgage in place of rent: cash needed, surplus at 60%, 80% and 100% occupancy and break-even.',
  r2r:'Room-by-room model: profit with 75%, 90% and 100% of rooms let, after rent, bills and other costs, with break-even.',
  btl:'Buy-to-let: cash needed to buy, monthly cash flow after the mortgage and running costs, yield, return on cash and a rate-rise check.',
  hmo:'HMO: cash needed to buy, room income, cash flow after the mortgage, running costs and bills, yield and return on cash.',
  brrr:'BRRR: money in, what stays in after refinancing on the end value, and cash flow after the new mortgage.',
  flip:'Flip: buying, holding and selling costs, profit, margin on the resale value and return on cash.',
  lo:'Lease option: upfront costs, monthly cash flow after the payment to the owner and running costs, and return on upfront.'};
[['#aFee','fee'],['#aClean','clean'],['#aStay','stay'],['#aOther','other']].forEach(([s,k])=>$(s).addEventListener('input',e=>{S.deal.a[k]=+e.target.value||0;tweenNext=true;renderResults();save()}));

function renderMeta(){const d=S.deal,n=d.units.length,ix=S.analysedDealIds.indexOf(d.id);
  $('#dealMeta').textContent=[isExample(d)?'Example':'',d.area,d.strat,n+' unit'+(n>1?'s':''),S.plan==='Free'&&ix>=0?`Free analysis ${ix+1} of ${FREE_ANALYSES}`:''].filter(Boolean).join(' · ')}
function renderResults(){const d=S.deal,a=d.a,m=modelOf(d),own=m==='ownsa',PC=own?d.units.map(u=>unitCalc(m,u,dealP(d),a)):null,U=own?d.units.map((u,i)=>Object.assign({},u,{rent:PC[i].mo,dep:0})):d.units;syncName();renderMeta();renderAsm();
  const hasFigures=modelHas(d);
  if(hasFigures&&m!=='sa'&&!own){$('#results').innerHTML=renderModel(d,m);renderStepBar();tweenNext=false;return}
  if(!hasFigures&&m!=='sa'){const S4=modelStrip(Object.assign({},d,{units:[]}));
    $('#results').innerHTML=`<div class="strip" role="group" aria-label="Deal summary">${S4.slice(0,4).map(([l])=>`<div class="fig"><div class="fig-l">${l}</div><div class="fig-v">—</div><div class="fig-s">Waiting for deal figures</div></div>`).join('')}</div><div class="alerts"><div class="alert">No deal figures yet. Add ${NEEDS_TXT[m]} to see the analysis.</div></div>`;
    renderStepBar();return}
  if(!hasFigures){
    $('#results').innerHTML=`<div class="strip" role="group" aria-label="Deal summary">
      <div class="fig"><div class="fig-l">Upfront cash</div><div class="fig-v">—</div><div class="fig-s">Add the rent and deposit</div></div>
      <div class="fig"><div class="fig-l">Surplus at 60%</div><div class="fig-v">—</div><div class="fig-s">Waiting for deal figures</div></div>
      <div class="fig"><div class="fig-l">Surplus at 80%</div><div class="fig-v">—</div><div class="fig-s">Waiting for deal figures</div></div>
      <div class="fig"><div class="fig-l">Break-even</div><div class="fig-v">—</div><div class="fig-s">Waiting for deal figures</div></div>
    </div><div class="alerts"><div class="alert">No deal figures yet. Add the rent, deposit and expected nightly rate to see the analysis.</div></div>`;
    renderStepBar();return;
  }
  const rent=U.reduce((s,u)=>s+u.rent,0),dep=U.reduce((s,u)=>s+u.dep,0);
  const tot=OCC.map(o=>U.reduce((s,u)=>s+month(u,o,null,a).surplus,0));
  const revs=OCC.map(o=>U.reduce((s,u)=>s+month(u,o,null,a).rev,0));
  const bes=U.map(u=>be(u,a));const worstBE=Math.max(...bes);
  let h=`<div class="strip" role="group" aria-label="Deal summary">
    <div class="fig"><div class="fig-l">${own?'Cash needed':'Upfront cash'}</div><div class="fig-v" id="sumUp" data-v="${own?sumOf(PC,'cash'):rent+dep}">${gbp(own?sumOf(PC,'cash'):rent+dep)}</div><div class="fig-s">${own?'Deposit, stamp duty, fees, refurb':'Deposits and first month'}</div></div>
    <div class="fig"><div class="fig-l">Surplus at 60%</div><div class="fig-v${tot[0]<0?' neg':''}" id="sum60" data-v="${tot[0]}">${gbp(tot[0])}</div><div class="fig-s">Per month, all units</div></div>
    <div class="fig"><div class="fig-l">Surplus at 80%</div><div class="fig-v${tot[1]<0?' neg':''}" id="sum80" data-v="${tot[1]}">${gbp(tot[1])}</div><div class="fig-s">Per month, all units</div></div>
    <div class="fig"><div class="fig-l">Break-even</div><div class="fig-v">${isFinite(worstBE)?pct(worstBE):'Never'}</div><div class="fig-s">Occupancy, weakest unit</div></div>
  </div>`;
  // alerts
  const al=[];
  if(d.london&&d.strat==='R2SA'){const gap=U.reduce((s,u)=>s+90*u.rate-u.rent*12,0);
    al.push(`<div class="alert ${gap<0?'bad':'warn'}"><b>London 90-night limit.</b> At 90 nights a year the units earn ${gbp(U.reduce((s,u)=>s+90*u.rate,0))} against ${gbp(rent*12)} rent, ${gap<0?'a '+gbp(-gap)+' shortfall':'a '+gbp(gap)+' margin'} before any other costs. The limit only counts stays of under 90 consecutive nights: corporate or mid-term lets of 90+ nights don't count, so they can fill the rest of the year. Otherwise year-round short lets need planning permission.</div>`)}
  const vatOcc=OCC.find((o,i)=>revs[i]*12>=90000);
  if(vatOcc!==undefined)al.push(`<div class="alert warn"><b>VAT.</b> Run through one business, revenue reaches ${gbp(revs[OCC.indexOf(vatOcc)]*12)} a year at ${pct(vatOcc)} occupancy, over the £90,000 VAT threshold. VAT at 20% would cut the surplus.</div>`);
  if(!own&&U.some(u=>u.dep>u.rent*12/52*5))al.push(`<div class="alert warn"><b>Deposit above 5 weeks' rent</b> on at least one unit. The cap applies to lets to individuals.</div>`);
  if(!al.length)al.push(`<div class="alert good">No automatic flags. Due diligence still needs to be completed.</div>`);
  h+=`<div class="alerts">${al.join('')}</div>`;
  // per unit table
  const h1=`<tr><th rowspan="2">Per unit, per month</th>${U.map(u=>`<th colspan="3" class="gh gs">${esc(u.label)}</th>`).join('')}</tr>`;
  const h2=`<tr>${U.map(()=>OCC.map((o,j)=>`<th class="${j?'':'gs'}">${pct(o)}</th>`).join('')).join('')}</tr>`;
  const row=(lab,f,cls='')=>`<tr class="${cls}"><td>${lab}</td>${U.map(u=>OCC.map((o,j)=>{const v=f(u,month(u,o,null,a));return `<td class="n${j?'':' gs'}${typeof v==='number'&&v<0?' neg':''}">${typeof v==='number'?gbp(v):v}</td>`}).join('')).join('')}</tr>`;
  h+=`<section class="sec"><div class="sec-h"><h2>Monthly model</h2><span class="sec-meta">Per unit at 60%, 80% and 100% occupancy</span></div><div class="tw"><table><thead>${h1}${h2}</thead><tbody>
    ${row('Occupied nights',(u,m)=>String(m.n))}
    ${row('Booking revenue',(u,m)=>m.rev)}
    ${row(`Platform fees (${a.fee}%)`,(u,m)=>m.fees)}
    ${row('Cleaning and linen',(u,m)=>m.cl)}
    ${row(own?`Mortgage interest (${dealP(d).rate}%)`:'Rent incl. bills',(u,m)=>u.rent)}
    ${row('Other costs',(u,m)=>a.other)}
    ${row('Operating surplus',(u,m)=>m.surplus,'total')}
  </tbody></table></div>
  <p class="note">£${a.clean} cleaning per turnover with a ${a.stay}-night average stay. 100% is a theoretical ceiling. Illustrative only, not a forecast.</p></section>`;
  // sensitivity
  let sr='';U.forEach((u,ui)=>[u.rate,u.rate-15,u.rate-35].forEach((r,k)=>{const v=OCC.map(o=>month(u,o,r,a).surplus);const b=be(u,a,r);
    sr+=`<tr>${k===0?`<td rowspan="3" class="u${ui===U.length-1?' lb':''}">${esc(u.label)}</td>`:''}<td class="n">${k===0?'<span class="base">base</span> ':''}£${r}</td>${v.map(x=>`<td class="n${x<0?' neg':''}">${gbp(x)}</td>`).join('')}<td class="n">${isFinite(b)?'~'+pct(b):'Never'}</td></tr>`}));
  h+=`<section class="sec"><div class="sec-h"><h2>If the nightly rate is lower</h2><span class="sec-meta">Monthly surplus per unit</span></div><div class="tw"><table><thead><tr><th>Unit</th><th>Nightly rate</th><th>60%</th><th>80%</th><th>100%</th><th>Break-even</th></tr></thead><tbody>${sr}</tbody></table></div></section>`;
  // break-even tracks
  h+=`<section class="sec"><div class="sec-h"><h2>Break-even occupancy</h2><span class="sec-meta">Covers ${own?'mortgage interest':'rent'}, platform fees, cleaning and other costs</span></div><div class="be-list">${U.map((u,i)=>{const b=bes[i];const x=Math.min(isFinite(b)?b:1,1)*100;
    return `<div class="be-row"><div><span class="be-unit">${esc(u.label)}</span><span class="be-rate">£${u.rate}/night</span></div>
    <div class="track" role="img" aria-label="${esc(u.label)} break-even ${isFinite(b)?pct(b):'never'}"><span class="rail"></span><span class="fill" style="width:${x}%"></span>
      ${[0,60,80,100].map(t=>`<span class="tick" style="left:${t}%${t===100?';transform:translateX(-1px)':''}"></span><span class="tl${t===0?' first':t===100?' last':''}" style="left:${t}%">${t}%</span>`).join('')}
      <span class="mk" style="left:${x}%"></span></div>
    <div class="be-val">${isFinite(b)&&b<=1?pct(b):'Above 100%'}</div></div>`}).join('')}</div></section>`;
  $('#results').innerHTML=h;renderStepBar();
  // ease the summary figures when the user edits the numbers (not when switching deals)
  ['sumUp','sum60','sum80'].forEach(id=>{const el=$('#'+id),to=+el.dataset.v,from=FIG_PREV[id];
    if(tweenNext&&!reduced()&&from!=null&&isFinite(from)&&isFinite(to)&&Math.round(from)!==Math.round(to)){const t0=performance.now(),dur=280;
      const f=now=>{if(!el.isConnected)return;const q=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-q,3);el.textContent=gbp(from+(to-from)*e);if(q<1)requestAnimationFrame(f);else el.textContent=gbp(to)};el.textContent=gbp(from);requestAnimationFrame(f)}
    FIG_PREV[id]=to});
  tweenNext=false;
}
let tweenNext=false;const FIG_PREV={};

/* advert import */
function parseAd(t){const num=re=>{const m=t.match(re);return m?+m[1].replace(/,/g,''):null};
  const rent=num(/rent[^£\n]*£\s?([\d,]+)/i),dep=num(/deposit[^£\n]*£\s?([\d,]+)/i),rate=num(/nightly\s*rate[^£\n]*£\s?([\d,]+)/i);
  const area=(t.match(/📍\s*([^📍\n]+?)\s*📍/)||[])[1];const lab=(t.match(/\(\s*£[\d,]+\s*([a-z ]+)\)/i)||[])[1];
  return{rent,dep,rate,area,label:lab?lab.trim().replace(/^\w/,c=>c.toUpperCase()):null}}
$('#sampleAd').addEventListener('click',()=>{$('#advert').value=SAMPLE_AD});
$('#doImport').addEventListener('click',()=>{const t=$('#advert').value.trim();if(!t){toast('Paste an advert first');return}
  const p=parseAd(t);if(!p.rent){toast('No rent found. Check the advert includes "Rent £…"');return}
  if(!feature('import','#nImport')||!spend(COST.import,'Advert import','#nImport'))return;
  S.deal.units.push({label:p.label?`${p.label} ${S.deal.units.length+1}`:'Unit '+(S.deal.units.length+1),rent:p.rent,dep:p.dep??p.rent,rate:p.rate??150});
  if(p.area&&!S.deal.area)S.deal.area=p.area;renderUnits();renderResults();save();$('#advert').value=''});

/* ---------- due diligence ---------- */
const SLAB={none:'Not checked',partly:'Partly checked',verified:'Verified',issue:'Issue found'};
const SDOT={none:'none',partly:'warn',verified:'good',issue:'bad'};
/* evidence: files are stored privately via /api/evidence; links and AI sources are kept on the deal */
const EV_ACCEPT='image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.eml,.heic';
const EV_MAX=4*1024*1024;
const kb=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return u}};
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:'';
function evItem(e,i,j){
  if(e.kind==='link')return `<li class="ev-it"><span class="ev-ic" aria-hidden="true">↗</span><a href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener noreferrer">${esc(e.name||hostOf(e.url))}</a><span class="ev-m">${esc(hostOf(e.url))}</span><button class="ev-x" data-ev-del="${i}:${j}" aria-label="Remove ${esc(e.name||'link')}">×</button></li>`;
  if(e.up)return `<li class="ev-it up"><span class="ev-ic" aria-hidden="true">…</span><span>${esc(e.name)}</span><span class="ev-m">Uploading…</span></li>`;
  const src='/api/evidence?id='+encodeURIComponent(e.id),img=/^image\/(jpeg|png|webp|gif)$/.test(e.type);
  return `<li class="ev-it">${img?`<img class="ev-th" src="${src}" alt="" loading="lazy">`:`<span class="ev-ic" aria-hidden="true">${esc((e.name.split('.').pop()||'file').slice(0,4).toUpperCase())}</span>`}<a href="${src}" target="_blank" rel="noopener">${esc(e.name)}</a><span class="ev-m">${kb(e.size||0)}</span><button class="ev-x" data-ev-del="${i}:${j}" aria-label="Remove ${esc(e.name)}">×</button></li>`}
function renderDD(){const d=S.deal;
  d.dd.forEach(x=>{if(!Array.isArray(x.ev))x.ev=[]});
  const c={none:0,partly:0,verified:0,issue:0};d.dd.forEach(x=>c[x.s]++);
  $('#ddSummary').innerHTML=Object.keys(SLAB).map(k=>`<div class="fig"><div class="fig-l"><span class="dot ${SDOT[k]}"></span>${SLAB[k]}</div><div class="fig-v${k==='issue'&&c[k]?' neg':''}">${c[k]}</div></div>`).join('');
  $('#ddMore').innerHTML=d.ai&&d.aiLevel==='quick'?scoutMore('dd'):'';
  $('#ddList').innerHTML=DD_TEMPLATE.map((t,i)=>{const x=d.dd[i]||{s:'none',n:'',ev:[]};const have=new Set(x.ev.filter(e=>e.kind==='link').map(e=>e.url));
    const src=(x.aiSrc||[]).filter(u=>safeUrl(u.url));
    return `<div class="dd-row" data-s="${x.s}" data-i="${i}"><div class="dd-main">
      <div class="dd-h"><span class="dd-i">${i+1}</span><h3>${t.t}</h3></div>
      <p class="dd-d">${t.d}</p>
      ${x.ai?`<div class="ai"><div class="ai-h">Draft<span>Verify before relying on it</span></div>${esc(x.ai)}
        ${src.length?`<ul class="ai-src">${src.map(u=>`<li><a href="${esc(u.url)}" target="_blank" rel="noopener noreferrer">${esc(u.title||hostOf(u.url))}</a> <span class="ev-m">${esc(hostOf(u.url))}</span>${have.has(u.url)?'<span class="ev-m">· added</span>':`<button class="linkbtn" data-ev-src="${i}" data-url="${esc(u.url)}" data-title="${esc(u.title||'')}">Add as evidence</button>`}</li>`).join('')}</ul>`:''}</div>`:''}
    </div><div class="dd-side">
      <label class="f"><span>Status</span><span class="sel"><span class="dot ${SDOT[x.s]}"></span><select class="inp" id="dds${i}" data-i="${i}" aria-label="Status for ${t.t}">${Object.keys(SLAB).map(k=>`<option value="${k}"${k===x.s?' selected':''}>${SLAB[k]}</option>`).join('')}</select></span></label>
      <label class="f"><span>Notes</span><textarea class="inp" id="ddn${i}" data-i="${i}" placeholder="What you checked, who confirmed it and when">${esc(x.n)}</textarea></label>
      <div class="ev"><div class="ev-l">Evidence${x.ev.length?` <span class="ev-m">${x.ev.length}</span>`:''}</div>
        ${x.ev.length?`<ul class="ev-list">${x.ev.map((e,j)=>evItem(e,i,j)).join('')}</ul>`:'<p class="ev-empty">Attach documents, photos or emails, or drop files here.</p>'}
        <div class="ev-a"><button class="btn sm" type="button" data-ev-file="${i}">Attach file</button><button class="btn sm" type="button" data-ev-link="${i}">Add link</button></div>
        <form class="ev-lf" data-ev-form="${i}" hidden><input class="inp" type="url" required placeholder="https://" aria-label="Evidence link for ${t.t}"><input class="inp" type="text" maxlength="120" placeholder="Label (optional)" aria-label="Label"><button class="btn sm primary" type="submit">Add</button></form>
      </div>
    </div></div>`}).join('');renderStepBar();
}
function ddEvidenceAdded(i){const x=S.deal.dd[i];if(x.s==='none')x.s='partly'}
function syncSavedDeal(){const i=S.saved.findIndex(d=>d.id===S.deal.id);if(i>=0)S.saved[i]=JSON.parse(JSON.stringify(S.deal))}
async function shrinkImage(f){if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size<1.5*1024*1024)return f;
  try{const bmp=await createImageBitmap(f),k=Math.min(1,2400/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
    return b&&b.size<f.size?new File([b],f.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}):f}catch(e){return f}}
async function uploadEvidence(i,files){const dealId=S.deal.id;
  for(const raw of files){const f=await shrinkImage(raw);
    if(f.size>EV_MAX){toast(`${raw.name} is over 4 MB. Compress it or split it, then try again.`);continue}
    const ph={up:true,name:f.name};S.deal.dd[i].ev.push(ph);renderDD();
    try{const fd=new FormData();fd.append('file',f,f.name);const r=await fetch('/api/evidence',{method:'POST',credentials:'same-origin',body:fd});const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'The file could not be uploaded.');
      const tgt=S.deal.id===dealId?S.deal:null;if(tgt){const ev=tgt.dd[i].ev,k=ev.indexOf(ph);const item={kind:'file',id:d.id,name:d.name,type:d.type,size:d.size,at:d.at};if(k>=0)ev[k]=item;else ev.push(item);ddEvidenceAdded(i);syncSavedDeal();save()}}
    catch(e){const ev=S.deal.dd[i]&&S.deal.dd[i].ev,k=ev?ev.indexOf(ph):-1;if(k>=0)ev.splice(k,1);toast(e.message||'The file could not be uploaded.')}
    renderDD()}}
function addEvidenceLink(i,url,name){url=safeUrl(url.trim());if(!url){toast('Enter a link starting with https://');return false}
  const ev=S.deal.dd[i].ev;if(!ev.some(e=>e.kind==='link'&&e.url===url))ev.push({kind:'link',url,name:(name||'').trim().slice(0,120),at:new Date().toISOString()});
  ddEvidenceAdded(i);syncSavedDeal();save();renderDD();return true}
const evInput=document.createElement('input');evInput.type='file';evInput.multiple=true;evInput.accept=EV_ACCEPT;evInput.hidden=true;document.body.appendChild(evInput);
evInput.addEventListener('change',()=>{const i=+evInput.dataset.i,fs=[...evInput.files];evInput.value='';if(fs.length)uploadEvidence(i,fs)});
$('#ddList').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.evFile!=null){evInput.dataset.i=b.dataset.evFile;evInput.click();return}
  if(b.dataset.evLink!=null){const f=$(`[data-ev-form="${b.dataset.evLink}"]`);f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus();return}
  if(b.dataset.evSrc!=null){addEvidenceLink(+b.dataset.evSrc,b.dataset.url,b.dataset.title);toast('Source added as evidence');return}
  if(b.dataset.evDel){const [i,j]=b.dataset.evDel.split(':').map(Number),it=S.deal.dd[i].ev[j];if(!it)return;
    if(!confirm(`Remove ${it.name||it.url} from this check?`))return;S.deal.dd[i].ev.splice(j,1);syncSavedDeal();save();renderDD();
    // the file is only deleted when no saved deal still uses it
    if(it.kind==='file'&&!S.saved.some(d=>(d.dd||[]).some(x=>(x.ev||[]).some(v=>v.id===it.id))))fetch('/api/evidence?id='+encodeURIComponent(it.id),{method:'DELETE',credentials:'same-origin'}).catch(()=>{})}});
$('#ddList').addEventListener('submit',e=>{const f=e.target.closest('[data-ev-form]');if(!f)return;e.preventDefault();const [u,l]=f.querySelectorAll('input');addEvidenceLink(+f.dataset.evForm,u.value,l.value)});
$('#ddList').addEventListener('dragover',e=>{const r=e.target.closest('.dd-row');if(!r||![...(e.dataTransfer.types||[])].includes('Files'))return;e.preventDefault();$$('.dd-row.drop').forEach(x=>x!==r&&x.classList.remove('drop'));r.classList.add('drop')});
$('#ddList').addEventListener('dragleave',e=>{const r=e.target.closest('.dd-row');if(r&&!r.contains(e.relatedTarget))r.classList.remove('drop')});
$('#ddList').addEventListener('drop',e=>{const r=e.target.closest('.dd-row');if(!r)return;e.preventDefault();r.classList.remove('drop');const fs=[...e.dataTransfer.files];if(fs.length)uploadEvidence(+r.dataset.i,fs)});
$('#ddList').addEventListener('change',e=>{if(e.target.tagName==='SELECT'){S.deal.dd[+e.target.dataset.i].s=e.target.value;save();renderDD()}});
$('#ddList').addEventListener('input',e=>{if(e.target.tagName==='TEXTAREA'){S.deal.dd[+e.target.dataset.i].n=e.target.value;save()}});
/* AI research: searches the public web for each check and cites its sources */
function ddDealText(d){const u=d.units.map(x=>unitText(d,x)).join('; ');
  return [`Deal: ${d.name||'Untitled'}`,`Location: ${d.send&&d.send.addr||d.area||'not given'}`,`Strategy: ${d.strat}${d.london?' (London)':''}`,`Units: ${u}`,d.sourceText?`Advert or notes:\n${d.sourceText.slice(0,6000)}`:''].filter(Boolean).join('\n')}
function applyResearch(dealId,res){const apply=d=>{if(!d||d.id!==dealId)return;(res.findings||[]).forEach(f=>{const x=d.dd.find(y=>y.k===f.k);if(!x)return;
    x.ai=f.finding;x.aiSrc=f.sources||[];if(x.s==='none'&&(f.status==='partly'||f.status==='issue'))x.s=f.status});d.ai=true;d.aiAt=res.researchedAt;d.aiLevel=res.level};
  apply(S.deal);S.saved.forEach(apply);save()}
async function followResearch(job){const b=$('#runAI'),st=$('#ddStatus'),lv=AI_LEVELS.find(l=>l.id===job.level)||AI_LEVELS[0];
  b.disabled=true;b.textContent='Researching…';const t0=job.at||Date.now(),el=()=>Math.round((Date.now()-t0)/1000),est=estSecs('dd',lv.id);
  const tick=()=>{st.textContent=`${lv.name} is researching each check… ${leftTxt(est,el(),0)} (usually ${estTxt('dd',lv.id)})`};tick();
  try{const res=await pollJob(job.id,tick);
    S.ddJob=null;applyResearch(job.dealId,Object.assign({},res,{level:job.level}));if(S.deal.id===job.dealId)renderDD();st.textContent='Findings drafted with their sources. Check each one, then add your evidence.';toast('Research complete')}
  catch(e){S.ddJob=null;save();st.textContent=e.message||'The research could not be completed.';toast(st.textContent)}
  finally{b.disabled=false;b.textContent='Run research'}}
$('#runAI').addEventListener('click',async()=>{if(!feature('dd','#nDD'))return;const d=S.deal,st=$('#ddStatus'),b=$('#runAI');
  if(!(d.area||'').trim()&&!(d.send&&d.send.addr)&&!d.sourceText){st.textContent='Add the area or address in Numbers first, so the research knows where to look.';return}
  const lv=AI_LEVELS.find(l=>l.id===AIC.level)||AI_LEVELS[0];b.disabled=true;
  try{const r=await fetch('/api/analyze-deal',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'dd',level:lv.id,deal:ddDealText(d),checks:DD_TEMPLATE})});
    const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.error||'The research could not be started.');if(x.credits){AIC.info=x.credits;renderAILevels()}
    S.ddJob={id:x.jobId,level:lv.id,dealId:d.id,at:Date.now()};save();followResearch(S.ddJob)}
  catch(e){b.disabled=false;st.textContent=e.message}});
window.addEventListener('dealpro:signed-in',()=>{if(S.ddJob&&S.ddJob.id)followResearch(S.ddJob)});

/* ---------- pack ---------- */
function bindPack(){const p=S.deal.pack;$('#pBiz').value=p.biz;$('#pRedress').value=p.redress;$('#pFee').value=p.fee;$('#pNDA').checked=p.nda}
[['#pBiz','biz'],['#pRedress','redress'],['#pFee','fee']].forEach(([s,k])=>$(s).addEventListener('input',e=>{S.deal.pack[k]=e.target.value;save();renderPack()}));
$('#pNDA').addEventListener('change',e=>{S.deal.pack.nda=e.target.checked;save();renderPack()});
$('#genPack').addEventListener('click',()=>{if(S.deal.pack.final){toast('Pack already generated');return}if(!feature('pack','#nPack')||!spend(COST.pack,'Deal pack','#nPack'))return;S.deal.pack.final=true;toast('Final pack generated');save();renderPack()});
// Photos taken from the listing when it's analysed, or added by link; the ticked ones go on the pack.
const dealPhotos=()=>Array.isArray(S.deal.photos)?S.deal.photos.filter(x=>x&&/^https:\/\//.test(x.url)):[];
function renderPackPhotos(){const P=dealPhotos(),on=P.filter(x=>x.on!==false).length;
  $('#pPhotoNote').textContent=P.length?`${on} of ${P.length} photo${P.length===1?'':'s'} on the pack. The first ticked photo is the main one.`:'Analyse a listing link in the Deal Analyser and its photos appear here. You can also add a photo link.';
  let n=0;$('#pPhotos').innerHTML=P.map((x,i)=>`<button type="button" class="ph-t${x.on!==false?' on':''}" data-ph="${i}" aria-pressed="${x.on!==false}" aria-label="Photo ${i+1}"><img src="${esc(x.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.hidden=true"><i>${x.on!==false?++n:''}</i></button>`).join('')}
$('#pPhotos').addEventListener('click',e=>{const b=e.target.closest('[data-ph]');if(!b)return;const x=dealPhotos()[+b.dataset.ph];if(!x)return;x.on=x.on===false;save();renderPack()});
$('#pPhotoAdd').addEventListener('click',()=>{const i=$('#pPhotoUrl'),u=i.value.trim();if(!/^https:\/\/\S+$/.test(u)){toast('Paste a photo link that starts with https://');return}
  S.deal.photos=dealPhotos();if(!S.deal.photos.some(x=>x.url===u))S.deal.photos.push({url:u,on:true,added:true});i.value='';save();renderPack()});
$('#pPhotoUrl').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#pPhotoAdd').click()}});
function renderPack(){const d=S.deal,a=d.a,U=d.units,p=d.pack;bindPack();renderPackPhotos();
  $('#genPack').textContent=p.final?'Pack generated':'Generate final pack';
  const rent=U.reduce((s,u)=>s+u.rent,0),dep=U.reduce((s,u)=>s+u.dep,0);
  const area=p.nda?(d.area||'').replace(/,?\s*[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}\b/i,''):(d.send.addr||d.area);
  const kv=(rows)=>`<dl>${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const cols=U.map(u=>`<div><div class="kv-h">${esc(u.label)}</div>${kv([['Rent incl. bills',gbp(u.rent)+'/month'],['Deposit',gbp(u.dep)],['Model rate','£'+u.rate+'/night']])}</div>`).join('')
    +(U.length>1?`<div><div class="kv-h">All units</div>${kv([['Rent',gbp(rent)+'/month'],['Deposits',gbp(dep)],['Upfront',gbp(rent+dep)]])}</div>`:'');
  const m=modelOf(d),sa=m==='sa',S4=modelHas(d)?modelStrip(d):null;
  const cols2=sa?cols:U.map(u=>`<div><div class="kv-h">${esc(u.label)}</div>${kv(UNIT_FIELDS[m].map(([f,l])=>[l,f==='rooms'?String(nn(u[f])):gbp(nn(u[f]))]))}</div>`).join('');
  const keyTable=S4?`<div class="tw"><table><thead><tr><th>Key figure</th><th>All units</th><th style="text-align:left">What it means</th></tr></thead><tbody>${S4.slice(0,4).map(([l,v,n,neg])=>`<tr><td>${l}</td><td class="n" style="${neg?'color:#B42318':''}">${v}</td><td class="l">${n}</td></tr>`).join('')}</tbody></table></div>`:'<p>Add the deal figures to show the key numbers.</p>';
  const tr=U.map(u=>`<tr><td>${esc(u.label)} at £${u.rate}</td>${OCC.map(o=>{const v=month(u,o,null,a).surplus;return `<td class="n" style="${v<0?'color:#B42318':''}">${gbp(v)}</td>`}).join('')}<td class="n">~${pct(be(u,a))}</td></tr>`).join('');
  const ddr=DD_TEMPLATE.map((t,i)=>{const x=d.dd[i],ev=x.ev||[];return `<tr><td class="l">${t.t}</td><td class="l st ${x.s}"><span class="pdot"></span>${SLAB[x.s]}</td><td class="l">${ev.length?ev.map(e=>esc(e.name||hostOf(e.url))).join(', '):'None yet'}</td></tr>`}).join('');
  const today=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  $('#packWrap').innerHTML=`<div class="paper-bar"><span class="dot ${p.final?'good':'none'}"></span>${p.final?'Final pack generated':'Preview. Generate the final pack to remove the watermark.'}</div>
  <article class="pack">${p.final?'':'<div class="wm" aria-hidden="true"><span>PREVIEW</span></div>'}
    <div class="pk-top"><b>Investment summary</b><span>${p.nda?'Pre-NDA':'Full'} · ${today}</span></div>
    <h2>${esc(d.name||'Untitled deal')}</h2><div class="ps">${esc(area)} | ${esc(d.strat)} opportunity | ${U.length} unit${U.length>1?'s':''}</div>
    ${(()=>{const ph=dealPhotos().filter(x=>x.on!==false).slice(0,5),img=(x,c)=>`<img class="${c}" src="${esc(x.url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`;
      return ph.length?`<div class="pk-photos${ph.length===1?' one':''}">${img(ph[0],'pk-main')}${ph.length>1?`<div class="pk-thumbs">${ph.slice(1).map(x=>img(x,'')).join('')}</div>`:''}</div>`:''})()}
    <h3>The deal</h3><p>${BUY_MODELS.has(m)?'A property purchase opportunity. The price and figures are as advertised and need checking against comparables and a survey.':m==='lo'?'A lease option: a monthly payment to the owner with an option to buy later. Terms need written confirmation.':'A rental business opportunity, not a purchase of the property. Terms are as advertised by the landlord and need written confirmation.'}</p>
    <div class="kv">${cols2}</div>
    ${sa?`<h3>Illustrative monthly surplus</h3>
    <div class="tw"><table><thead><tr><th>Per unit</th><th>60%</th><th>80%</th><th>100%</th><th>Break-even</th></tr></thead><tbody>${tr}</tbody></table></div>`:`<h3>Key figures</h3>${keyTable}`}
    <p class="small" style="margin-top:8px">${!sa?`${esc(ASM_NOTE[m])} Estimates only, not a forecast.`:''}${sa?'':'<span hidden>'}${a.fee}% platform fees, £${a.clean} cleaning per ${a.stay}-night stay, £${a.other}/month other costs, 30-day month. Not a forecast; nightly rates and occupancy are unvalidated.${d.london&&d.strat==='R2SA'?' In London, stays of under 90 consecutive nights are limited to 90 nights a year without planning permission; corporate and mid-term lets of 90+ nights are not.':''}${sa?'':'</span>'}</p>
    <h3>Due diligence status</h3>
    <div class="tw"><table><thead><tr><th>Check</th><th style="text-align:left">Status</th><th style="text-align:left">Evidence</th></tr></thead><tbody>${ddr}</tbody></table></div>
    <h3>Next steps</h3>
    <p>Sourcing fee: <b>${esc(p.fee||'on request')}</b>. The full address and landlord introduction are released after you sign the terms of business and pay the reservation fee.</p>
    <p class="small">${p.biz?`Offered by ${esc(p.biz)}`:'Sourcing business not set'}${p.redress?` | Redress: ${esc(p.redress)}`:''}. This summary is not financial, legal or investment advice. Returns depend on performance and are not guaranteed.</p>
    <div class="foot"><span>${esc((d.name||'').toUpperCase())} | ${p.nda?'PRE-NDA SUMMARY':'FULL SUMMARY'}</span><span>Made with Deal Pro</span></div>
  </article>`;renderStepBar();
}

/* ---------- send ---------- */
const SF=[['#sCo','co'],['#sEmail','email'],['#sAddr','addr'],['#sLL','ll'],['#sRole','role'],['#sPhone','phone'],['#sLEmail','lemail'],['#sUse','use'],['#sDocs','docs']];
function bindSend(){SF.forEach(([s,k])=>{$(s).value=S.deal.send[k]??''})}
SF.forEach(([s,k])=>$(s).addEventListener('input',e=>{S.deal.send[k]=e.target.value;save();renderNotice(true)}));
function noticeText(){const d=S.deal,s=d.send,U=d.units;const ref='DN-'+(d.id||'x').replace(/\W/g,'').toUpperCase().slice(-4).padStart(4,'0');
  const today=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  return `To: ${s.co||'[Sourcer company]'} (${s.email||'[notice email]'})
Subject: Deal Notice under Deal Introduction Agreement

Deal Notice reference: ${ref}
Date sent: ${today}

Property address and postcode: ${s.addr||'[full address]'}
Number of units and type: ${U.length} unit${U.length>1?'s':''} (${U.map(u=>u.label).join(', ')})
${BUY_MODELS.has(modelOf(d))?'Price and figures':'Rent and deposit asked'}:
${U.map(u=>`  - ${unitText(d,u)}`).join('\n')}

Introduced Contact: ${s.ll||'[name]'} (${s.role}), ${s.phone||'[phone]'}, ${s.lemail||'[email]'}
Use the landlord has agreed to: ${s.use}
Documents attached: ${s.docs||'-'}

Response needed by: within 3 Business Days of this notice. If no reply is received, this property is a Registered Deal under clause 4.2 of our Deal Introduction Agreement.

Jonah Quartey`}
function renderNotice(skipBind){if(!skipBind)bindSend();$('#notice').textContent=noticeText()}
function selectNotice(){const r=document.createRange();r.selectNodeContents($('#notice'));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);toast('Selected. Press Ctrl/Cmd+C to copy')}
$('#copyNotice').addEventListener('click',()=>{const t=noticeText();
  try{navigator.clipboard.writeText(t).then(()=>toast('Deal Notice copied')).catch(selectNotice)}catch(e){selectNotice()}});

/* ---------- deals ---------- */
/* ---------- deal pipeline ---------- */
$('#dStrat').innerHTML=STRATS.map(([k,n,d])=>`<option value="${k}" title="${esc(d)}">${esc(n)}</option>`).join('');
const STAGES=[['Lead','Found, not analysed yet'],['Analysing','Running the numbers'],['Due diligence','Checking the details'],['Viewing','Viewing booked or done'],['Offer made','Offer or proposal sent'],['Agreed','Terms agreed, paperwork in progress'],['Completed','Live or completed'],['Lost','Rejected or fell through']];
const STAGE_KEYS=STAGES.map(x=>x[0]),OPEN_STAGES=STAGE_KEYS.slice(0,6);
const OLD_STAGE={'Checking':'Analysing','Issue found':'Due diligence','Sent to sourcer':'Offer made'};// statuses used before the pipeline
const stageOf=d=>{const s=OLD_STAGE[d.status]||d.status;return STAGE_KEYS.includes(s)?s:'Analysing'};
const PL={view:store.get('pl-view','board'),strat:'all',q:''};
// Monthly profit: the AI's figure when the deal has been analysed, otherwise the numbers model at 80% for rentals.
function dealProfit(d){const a=d.aiAnalysis;
  if(a&&a.monthly_profit){const m=String(a.monthly_profit).replace(/,/g,'').match(/(-|−|minus\s*|loss of\s*)?£\s?(\d+(?:\.\d+)?)\s*(k)?/i);if(m){let v=+m[2]*(m[3]?1000:1);if(m[1])v=-v;return {v,src:'AI'}}}
  if(modelHas(d)){const x=modelStrip(d)[4];if(x&&x.monthly!=null&&isFinite(x.monthly))return {v:x.monthly,src:'model'}}
  return null}
const dealRent=d=>(d.units||[]).reduce((s,u)=>s+(+u.rent||0),0);
const dealUpfront=d=>{const x=modelHas(d)&&modelStrip(d)[4];return x?x.up:(d.units||[]).reduce((s,u)=>s+(+u.rent||0)+(+u.dep||0),0)};
function ddState(d){const dd=d.dd||[];return {done:dd.filter(x=>x.s==='verified').length,issues:dd.filter(x=>x.s==='issue').length,tot:dd.length||8}}
const daysIn=d=>{const t=Date.parse(d.stageAt||d.savedAt||'');return t?Math.max(0,Math.floor((Date.now()-t)/864e5)):null};
function attention(d){const st=stageOf(d),dd=ddState(d),days=daysIn(d),r=[];if(!OPEN_STAGES.includes(st))return r;
  if(dd.issues)r.push(`${dd.issues} due diligence issue${dd.issues>1?'s':''}`);
  if(days!=null&&days>=14)r.push(`No movement for ${days} days`);
  if(['Offer made','Agreed'].includes(st)&&dd.done<dd.tot)r.push(`${dd.tot-dd.done} of ${dd.tot} checks not verified`);
  return r}
function plRows(){const q=PL.q.trim().toLowerCase();return S.saved.map((d,i)=>({d,i})).filter(({d})=>(PL.strat==='all'||(d.strat||'R2SA')===PL.strat)&&(!q||[d.name,d.area,stratName(d.strat)].join(' ').toLowerCase().includes(q)))}
function renderDeals(){const L=S.saved;
  const open=L.filter(d=>OPEN_STAGES.includes(stageOf(d))),won=L.filter(d=>stageOf(d)==='Completed').length,lost=L.filter(d=>stageOf(d)==='Lost').length;
  const withP=open.map(dealProfit).filter(Boolean),profit=withP.reduce((s,x)=>s+x.v,0),up=open.reduce((s,d)=>s+dealUpfront(d),0);
  $('#plKpis').innerHTML=[
    ['Active deals',String(open.length),`${L.length} saved in total`],
    ['Est. monthly profit',withP.length?gbp(profit):'–',withP.length?`Across ${withP.length} active deal${withP.length>1?'s':''} with figures`:'Analyse a deal to see this'],
    ['Upfront cash',up?gbp(up):'–','First month’s rent and deposits, active deals'],
    ['Completed',String(won),won+lost?`${Math.round(won/(won+lost)*100)}% of closed deals won`:'No closed deals yet'],
  ].map(([l,v,sub],j)=>`<div class="fig"><div class="fig-l">${l}</div><div class="fig-v${j===1&&withP.length&&profit<0?' neg':''}">${v}</div><div class="fig-s">${esc(sub)}</div></div>`).join('');
  const counts=STAGE_KEYS.map(k=>L.filter(d=>stageOf(d)===k).length),mx=Math.max(1,...counts);
  $('#plFunnel').innerHTML=`<ol class="pl-fun">${STAGES.map(([k,desc],j)=>`<li title="${k}: ${counts[j]} deal${counts[j]===1?'':'s'}. ${desc}."><span class="pl-fl">${k}</span><span class="pl-ft"><span class="pl-fb${k==='Lost'?' lost':''}" style="width:${counts[j]?Math.max(4,counts[j]/mx*100):0}%"></span></span><span class="pl-fn">${counts[j]}</span></li>`).join('')}</ol>`;
  const attn=L.map((d,i)=>({d,i,why:attention(d)})).filter(x=>x.why.length);
  $('#plAttn').innerHTML=attn.length?attn.slice(0,6).map(x=>`<li><button class="linkbtn" data-open="${x.i}">${esc(x.d.name||'Untitled deal')}</button><span>${esc(x.why.join(' · '))}</span></li>`).join('')+(attn.length>6?`<li class="muted">and ${attn.length-6} more</li>`:'')
    :'<li class="muted">Nothing needs attention. Deals with due diligence issues, unverified checks at offer stage, or no movement for 14 days show here.</li>';
  const used=STRATS.filter(x=>L.some(d=>(d.strat||'R2SA')===x[0]));
  $('#plStrat').innerHTML=[['all','All strategies',L.length]].concat(used.map(x=>[x[0],x[1],L.filter(d=>(d.strat||'R2SA')===x[0]).length]))
    .map(([k,n,c])=>`<button type="button" class="pl-chip" data-pl-strat="${k}" aria-pressed="${PL.strat===k}">${esc(n)} <span>${c}</span></button>`).join('');
  $$('[data-pl-view]').forEach(b=>{const on=b.dataset.plView===PL.view;b.setAttribute('aria-pressed',String(on));b.classList.toggle('primary',on)});
  if(!L.length){$('#dealList').innerHTML='<div class="dl"><div class="empty">No saved deals yet. Analyse a deal and click Save, and it will appear in your pipeline.</div></div>';return}
  const rows=plRows();
  $('#dealList').innerHTML=!rows.length?'<div class="dl"><div class="empty">No deals match this filter.</div></div>':PL.view==='list'?plList(rows):plBoard(rows)}
const stageSel=(i,d)=>`<select class="inp pl-sel" data-st="${i}" aria-label="Stage for ${esc(d.name||'deal')}">${STAGE_KEYS.map(k=>`<option${k===stageOf(d)?' selected':''}>${k}</option>`).join('')}</select>`;
const scoreOf=d=>d.aiAnalysis&&d.aiAnalysis.score!=null?Math.max(0,Math.min(100,+d.aiAnalysis.score||0)):null;
function plCard({d,i}){const p=dealProfit(d),dd=ddState(d),days=daysIn(d),sc=scoreOf(d),why=attention(d);
  return `<article class="pl-card" draggable="true" data-i="${i}">
    <div class="pl-ct"><button class="pl-name" data-open="${i}">${esc(d.name||'Untitled deal')}</button>${sc!=null?`<span class="pl-score" title="Deal score out of 100">${sc}</span>`:''}</div>
    <div class="pl-sub">${esc(d.area||'No area yet')}</div>
    <div class="ctags"><span class="ctag">${esc(stratName(d.strat||'R2SA'))}</span>${isExample(d)?'<span class="ctag">Example</span>':''}</div>
    <dl class="pl-kv"><div><dt>Profit/mo</dt><dd class="${p&&p.v<0?'neg':''}">${p?gbp(p.v):'–'}</dd></div><div><dt>Checks</dt><dd>${dd.done}/${dd.tot}</dd></div></dl>
    ${why.length?`<p class="pl-why"><span aria-hidden="true">⚠</span> ${esc(why[0])}</p>`:''}
    <div class="pl-foot">${stageSel(i,d)}<span class="muted" title="Time in this stage">${days!=null?(days?days+'d':'Today'):''}</span></div></article>`}
function plBoard(rows){return `<div class="pl-board" role="region" aria-label="Pipeline board, scroll sideways" tabindex="0">${STAGES.map(([k,desc])=>{const r=rows.filter(x=>stageOf(x.d)===k);
  return `<section class="pl-col${k==='Lost'?' lost':''}" data-stage="${k}" aria-label="${k}"><header><div><b>${k}</b><span class="pl-n">${r.length}</span></div><p>${desc}</p></header><div class="pl-cards">${r.map(plCard).join('')||'<p class="pl-empty">Drag a deal here</p>'}</div></section>`}).join('')}</div>`}
function plList(rows){return `<div class="sheet pl-list" tabindex="0" role="region" aria-label="Deals"><table><thead><tr><th>Deal</th><th>Strategy</th><th>Stage</th><th class="nr">Rent pcm</th><th class="nr">Profit/mo</th><th class="nr">Score</th><th>Checks</th><th>In stage</th><th></th></tr></thead><tbody>${rows.map(({d,i})=>{const p=dealProfit(d),dd=ddState(d),days=daysIn(d),sc=scoreOf(d);
  return `<tr><td><button class="pl-name" data-open="${i}">${esc(d.name||'Untitled deal')}</button><div class="pl-sub">${esc(d.area||'')}</div></td><td>${esc(stratName(d.strat||'R2SA'))}</td><td>${stageSel(i,d)}</td><td class="nr mono">${dealRent(d)?gbp(dealRent(d)):'–'}</td><td class="nr mono${p&&p.v<0?' neg':''}">${p?gbp(p.v):'–'}</td><td class="nr mono">${sc??'–'}</td><td>${dd.done}/${dd.tot}${dd.issues?` <span class="pl-iss">${dd.issues} issue${dd.issues>1?'s':''}</span>`:''}</td><td class="muted">${days!=null?(days?days+' days':'Today'):''}</td>
    <td><div class="dl-act"><button class="btn sm" data-open="${i}">Open</button><button class="btn ghost sm" data-del="${i}">Delete</button></div></td></tr>`}).join('')}</tbody></table></div>`}
function setStage(i,st){const d=S.saved[i];if(!d||stageOf(d)===st)return;d.status=st;d.stageAt=new Date().toISOString();if(S.deal.id===d.id){S.deal.status=st;S.deal.stageAt=d.stageAt}save();renderDeals();toast(`${d.name||'Deal'} moved to ${st}`)}
$('#dealList').addEventListener('click',e=>{const o=e.target.closest('[data-open]'),x=e.target.closest('[data-del]');
  if(o){S.deal=JSON.parse(JSON.stringify(S.saved[+o.dataset.open]));save();bindDeal();go('analyser','numbers');toast('Deal opened')}
  if(x){const b=x;if(b.dataset.confirm){S.saved.splice(+b.dataset.del,1);save();renderDeals();toast('Deal deleted')}else{b.dataset.confirm='1';b.textContent='Confirm delete';setTimeout(()=>{if(b.isConnected){delete b.dataset.confirm;b.textContent='Delete'}},3000)}}});
$('#plAttn').addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(o){S.deal=JSON.parse(JSON.stringify(S.saved[+o.dataset.open]));save();bindDeal();go('analyser','dd');toast('Deal opened')}});
$('#dealList').addEventListener('change',e=>{const s=e.target.dataset.st;if(s!=null)setStage(+s,e.target.value)});
$('#plStrat').addEventListener('click',e=>{const b=e.target.closest('[data-pl-strat]');if(b){PL.strat=b.dataset.plStrat;renderDeals()}});
$('#plSearch').addEventListener('input',e=>{PL.q=e.target.value;renderDeals()});
$$('[data-pl-view]').forEach(b=>b.addEventListener('click',()=>{PL.view=b.dataset.plView;store.set('pl-view',PL.view);renderDeals()}));
// drag a card to another stage
$('#dealList').addEventListener('dragstart',e=>{const c=e.target.closest('.pl-card');if(!c)return;e.dataTransfer.setData('text/plain',c.dataset.i);e.dataTransfer.effectAllowed='move';c.classList.add('dragging')});
$('#dealList').addEventListener('dragend',e=>{$$('.pl-card.dragging,.pl-col.over').forEach(x=>x.classList.remove('dragging','over'))});
$('#dealList').addEventListener('dragover',e=>{const col=e.target.closest('.pl-col');if(!col)return;e.preventDefault();$$('.pl-col.over').forEach(x=>x!==col&&x.classList.remove('over'));col.classList.add('over')});
$('#dealList').addEventListener('drop',e=>{const col=e.target.closest('.pl-col');if(!col)return;e.preventDefault();col.classList.remove('over');const i=e.dataTransfer.getData('text/plain');if(i!=='')setStage(+i,col.dataset.stage)});
function saveCurrent(){const c=JSON.parse(JSON.stringify(S.deal));const now=new Date().toISOString();c.status=stageOf(c);if(!c.savedAt)c.savedAt=now;if(!c.stageAt)c.stageAt=now;S.deal.status=c.status;S.deal.savedAt=c.savedAt;S.deal.stageAt=c.stageAt;const i=S.saved.findIndex(d=>d.id===c.id);
  if(i<0&&S.plan==='Free'&&S.saved.length>=3){toast('The Free plan saves up to 3 deals. Upgrade to save more.');return}if(i>=0)S.saved[i]=c;else S.saved.unshift(c);save();renderDeals();toast('Deal saved')}
$('#saveDeal').addEventListener('click',saveCurrent);
$('#saveDealTop').addEventListener('click',saveCurrent);
function newBlankDeal(){startAnalysis(()=>{const d=freshDeal();S.deal=d;markAnalysed(d.id);save();bindDeal();go('analyser','numbers')})}
$('#newDeal').addEventListener('click',newBlankDeal);
$('#anScratch').addEventListener('click',newBlankDeal);

/* ---------- pricing ---------- */
const CHK='<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.2l2.2 2.2 4.8-4.9"/></svg>';
const feats=a=>`<ul>${a.map(x=>`<li>${CHK}<span>${x}</span></li>`).join('')}</ul>`;
function planBtn(id,primary){const cur=S.plan===id;return `${cur?'<div class="cur"><span class="dot good"></span>Current plan</div>':''}<button class="btn block${primary?' primary':''}" data-plan="${id}"${cur?' disabled':''}>${cur?'Your plan':'Switch to '+PLAN_DEFS[id].name}</button>`}
function renderPlans(){
  const ann=S.billing==='annual',team=S.plansTab==='team';
  $('#ptInd').setAttribute('aria-pressed',String(!team));$('#ptTeam').setAttribute('aria-pressed',String(team));
  $('#billSw').setAttribute('aria-checked',String(ann));$('#billM').classList.toggle('on',!ann);$('#billA').classList.toggle('on',ann);
  const box=$('#plans');box.classList.toggle('two',team);
  if(!team){const mt=S.maxTier==='20'?'20':'5',mid='Max'+mt;
    box.innerHTML=`<div class="plan"><div class="plan-h"><h3>Free</h3></div><p class="plan-from">Try Deal Pro</p>
      <div class="price"><span class="mono">£0</span><span class="per">per month</span></div><div class="bill-note">Free forever</div>
      <div class="lead">Limited usage</div>${feats(['3 Deal Finder searches a week','2 Scout deal analyses','Browse the Deal Community, reply and chat','Save up to 3 deals','Secure personal account'])}${planBtn('Free')}</div>
    <div class="plan feat"><div class="plan-h"><h3>Premium</h3><span class="tag">Most popular</span></div><p class="plan-from">For everyday sourcing</p>
      <div class="price"><span class="mono">£${ann?33:39}</span><span class="per">per month</span></div><div class="bill-note">${ann?'Billed annually (£396 upfront)':'Billed monthly'}</div>
      <div class="lead">Everything in Free, plus:</div>${feats(['Analyst and Expert power levels','60 credits a week for searches and analyses','Post 10 deals a month in the Deal Community','Due diligence','Deal packs','Advert import','Unlimited saved deals'])}${planBtn('Pro',true)}</div>
    <div class="plan"><div class="plan-h"><h3>Max</h3></div><p class="plan-from">From £100/month · For sourcers who work deals all day</p>
      <div class="seg segb tier" role="group" aria-label="Max usage tier"><button id="maxT5" data-tier="5" aria-pressed="${mt==='5'}">5x</button><button id="maxT20" data-tier="20" aria-pressed="${mt==='20'}">20x</button></div>
      <div class="price"><span class="mono">£${mt==='20'?200:100}</span><span class="per">per month</span></div><div class="bill-note">Billed monthly</div>
      <div class="lead">Everything in Premium, plus:</div>${feats([`${mt}x more usage than Premium per session`,`${mt==='20'?1200:300} credits a week`,'Unlimited Deal Community posts','Higher limits','Early access to new features','Priority at peak times'])}${planBtn(mid)}</div>
    ${S.dcOpen||S.plan==='Lite'?`<div class="plan dcm-card"><div class="plan-h"><h3>Deal Community membership</h3></div><p class="plan-from">Only for posting your deals in the Deal Community</p>
      <div class="price"><span class="mono">£9.99</span><span class="per">per month</span></div><div class="bill-note">Billed monthly</div>
      ${feats(['Post up to 5 deals a day, off market or on market','Reply and chat across the Deal Community'])}${planBtn('Lite')}</div>`:`<div class="dcm-hint">Only want to post your deals in the Deal Community? <button type="button" class="linkbtn" data-dcm-open>See the Deal Community membership</button></div>`}`}
  renderUsage()}
$('#plans').addEventListener('click',e=>{if(e.target.closest('[data-dcm-open]')){S.dcOpen=true;renderPlans()}});
$('#ptInd').addEventListener('click',()=>{S.plansTab='individual';save();renderPlans()});

$('#billSw').addEventListener('click',()=>{S.billing=S.billing==='annual'?'monthly':'annual';save();renderPlans()});
document.addEventListener('click',e=>{const b=e.target.closest('#seatDec,#seatInc');if(!b)return;S.seats=Math.max(5,Math.min(500,(S.seats||5)+(b.id==='seatInc'?1:-1)));save();renderPlans()});
document.addEventListener('input',e=>{if(e.target.id!=='seatN')return;const v=Math.round(+e.target.value);if(v>=5&&v<=500){S.seats=v;save();renderPlans()}});
$('#plans').addEventListener('click',e=>{const t=e.target.closest('[data-tier]');if(t){S.maxTier=t.dataset.tier;save();renderPlans();const f=$(`[data-tier="${S.maxTier}"]`);if(f)f.focus();return}
  const b=e.target.closest('[data-plan]');if(!b||!PLAN_DEFS[b.dataset.plan])return;const id=b.dataset.plan;
  if(id!==S.plan)startCheckout(id)});
$('#xOn').addEventListener('click',()=>{if(S.plan==='Free'&&!S.extra.on){toast('Extra usage is available on paid plans.');return}S.extra.on=!S.extra.on;save();renderUsage();toast(S.extra.on?'Extra usage on':'Extra usage off')});
$('#xCap').addEventListener('input',e=>{S.extra.cap=Math.max(0,+e.target.value||0);save();renderUsage()});

/* ---------- find deals ---------- */
// Real listings found on 23 Sep 2026 (OpenRent, SpareRoom, Gumtree). The demo "AI search" filters this saved sample.
const LISTINGS=[
{"site":"OpenRent","id":"3022762","landlord":"Landlord 1","type":"1 bed flat","beds":1,"area":"Rupert Street, W1D","postcode":"W1D","price":3450,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3022762","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3042146","landlord":"Landlord 2","type":"1 bed flat","beds":1,"area":"Millbank, SW1P","postcode":"SW1P","price":3600,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3042146","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3046116","landlord":"Landlord 3","type":"2 bed flat","beds":2,"area":"Whitehouse Apartments, SE1","postcode":"SE1","price":4000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3046116","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3046053","landlord":"Landlord 4","type":"1 bed flat","beds":1,"area":"Fareham St, W1F","postcode":"W1F","price":4250,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3046053","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3049034","landlord":"Landlord 5","type":"1 bed flat","beds":1,"area":"Adam & Eve Court, W1D","postcode":"W1D","price":2500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3049034","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3044560","landlord":"Landlord 6","type":"2 bed flat","beds":2,"area":"Bedford Avenue, WC1B","postcode":"WC1B","price":2650,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3044560","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3025682","landlord":"Landlord 7","type":"1 bed flat","beds":1,"area":"Cliffords Inn, EC4A","postcode":"EC4A","price":2495,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3025682","found":"23 Sep 2026"},
{"site":"OpenRent","id":"1444629","landlord":"Landlord 8","type":"1 bed flat","beds":1,"area":"Greencoat Mansions, SW1P","postcode":"SW1P","price":2999,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/1444629","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3026187","landlord":"Landlord 9","type":"2 bed flat","beds":2,"area":"Hill Street, W1J","postcode":"W1J","price":5460,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3026187","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3043796","landlord":"Landlord 10","type":"2 bed flat","beds":2,"area":"Tothill House, SW1P","postcode":"SW1P","price":2850,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3043796","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3047874","landlord":"Landlord 11","type":"2 bed flat","beds":2,"area":"Lambeth High Street, SE1","postcode":"SE1","price":4200,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3047874","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2928255","landlord":"Landlord 12","type":"Studio flat","beds":0,"area":"Holborn, WC1R","postcode":"WC1R","price":2946,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2928255","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3045831","landlord":"Landlord 13","type":"1 bed flat","beds":1,"area":"Minton House, SE11","postcode":"SE11","price":2000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3045831","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3043726","landlord":"Landlord 14","type":"2 bed flat","beds":2,"area":"Holcroft Court, W1W","postcode":"W1W","price":2900,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3043726","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3044446","landlord":"Landlord 15","type":"1 bed flat","beds":1,"area":"Gray's Inn Road, WC1X","postcode":"WC1X","price":1950,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3044446","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3045825","landlord":"Landlord 16","type":"2 bed flat","beds":2,"area":"Patrick Court, SE1","postcode":"SE1","price":2650,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3045825","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3011343","landlord":"Landlord 17","type":"1 bed flat","beds":1,"area":"Hallam St, W1W","postcode":"W1W","price":2475,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3011343","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3044682","landlord":"Landlord 18","type":"2 bed flat","beds":2,"area":"Euston Road, NW1","postcode":"NW1","price":3250,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3044682","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3042174","landlord":"Landlord 2","type":"2 bed flat","beds":2,"area":"Benbow House, SE1","postcode":"SE1","price":4500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3042174","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2970833","landlord":"Landlord 19","type":"Studio flat","beds":0,"area":"Cartwright Gardens, WC1H","postcode":"WC1H","price":2015,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2970833","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2882712","landlord":"Landlord 19","type":"Studio flat","beds":0,"area":"Cartwright Gardens, WC1H","postcode":"WC1H","price":1971,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2882712","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3045143","landlord":"Landlord 20","type":"2 bed flat","beds":2,"area":"King's Cross Station, WC1X","postcode":"WC1X","price":4950,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3045143","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3048992","landlord":"Landlord 21","type":"2 bed flat","beds":2,"area":"Hans Crescent, SW1X","postcode":"SW1X","price":7000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3048992","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3044752","landlord":"Landlord 22","type":"1 bed flat","beds":1,"area":"Skinner Street, EC1R","postcode":"EC1R","price":2100,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3044752","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3049188","landlord":"Landlord 23","type":"2 bed flat","beds":2,"area":"Hyde Park Place, W2","postcode":"W2","price":4100,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3049188","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3046381","landlord":"Landlord 24","type":"Studio flat","beds":0,"area":"Park West Place, W2","postcode":"W2","price":2250,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3046381","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3043328","landlord":"Landlord 25","type":"2 bed flat","beds":2,"area":"Pentonville Road, N1","postcode":"N1","price":3000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3043328","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3043514","landlord":"Landlord 26","type":"1 bed flat","beds":1,"area":"Lennox Gardens, SW1X","postcode":"SW1X","price":3800,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3043514","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3044804","landlord":"Landlord 27","type":"1 bed flat","beds":1,"area":"Central St, EC1V","postcode":"EC1V","price":2750,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3044804","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3050208","landlord":"Landlord 11","type":"Studio flat","beds":0,"area":"Draycott Avenue, SW3","postcode":"SW3","price":2474,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3050208","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3048080","landlord":"Landlord 28","type":"1 bed flat","beds":1,"area":"Sun St, EC2A","postcode":"EC2A","price":3995,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3048080","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3045096","landlord":"Landlord 29","type":"2 bed flat","beds":2,"area":"Corringham, W2","postcode":"W2","price":2800,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3045096","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2995199","landlord":"Landlord 30","type":"2 bed flat","beds":2,"area":"Inverness Terrace, W2","postcode":"W2","price":6000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2995199","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2873501","landlord":"Landlord 31","type":"1 bed flat","beds":1,"area":"Queensway, W2","postcode":"W2","price":1950,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2873501","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3046283","landlord":"Landlord 32","type":"Studio flat","beds":0,"area":"Linden Gardens, W2","postcode":"W2","price":2450,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3046283","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2171709","landlord":"Landlord 33","type":"1 bed flat","beds":1,"area":"Bourchier St, W1D","postcode":"W1D","price":3200,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2171709","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2850987","landlord":"Landlord 34","type":"2 bed flat","beds":2,"area":"Barter St, WC1A","postcode":"WC1A","price":3700,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2850987","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3020556","landlord":"Landlord 35","type":"1 bed flat","beds":1,"area":"Westminster Bridge Road, SE1","postcode":"SE1","price":4100,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3020556","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2867010","landlord":"Landlord 18","type":"Studio flat","beds":0,"area":"Hill St, W1J","postcode":"W1J","price":2817,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2867010","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3048134","landlord":"Landlord 36","type":"1 bed flat","beds":1,"area":"Tothill House, SW1P","postcode":"SW1P","price":2700,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3048134","found":"23 Sep 2026"},
{"site":"OpenRent","id":"1566859","landlord":"Landlord 36","type":"1 bed flat","beds":1,"area":"Tothill House, SW1P","postcode":"SW1P","price":2500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/1566859","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3042753","landlord":"Landlord 2","type":"2 bed flat","beds":2,"area":"Lambeth High St, SE1","postcode":"SE1","price":4200,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3042753","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3044941","landlord":"Landlord 37","type":"2 bed flat","beds":2,"area":"Davenport House, SE11","postcode":"SE11","price":2800,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3044941","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3044597","landlord":"Landlord 38","type":"2 bed flat","beds":2,"area":"Black Prince Road, SE1","postcode":"SE1","price":4190,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3044597","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3044997","landlord":"Landlord 39","type":"Studio flat","beds":0,"area":"Warren Court, NW1","postcode":"NW1","price":2400,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3044997","found":"23 Sep 2026"},
{"site":"OpenRent","id":"2929005","landlord":"Landlord 40","type":"1 bed flat","beds":1,"area":"Gray's Inn Rd, WC1X","postcode":"WC1X","price":2290,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/2929005","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3043973","landlord":"Landlord 41","type":"1 bed flat","beds":1,"area":"Perronet House, SE1","postcode":"SE1","price":2450,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3043973","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3047556","landlord":"Landlord 42","type":"Studio flat","beds":0,"area":"Grays Inn Rd, WC1X","postcode":"WC1X","price":1379,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3047556","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3047298","landlord":"Landlord 43","type":"1 bed flat","beds":1,"area":"Roman House, EC2Y","postcode":"EC2Y","price":2990,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3047298","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3045163","landlord":"Landlord 44","type":"2 bed flat","beds":2,"area":"Wynyatt St, EC1V","postcode":"EC1V","price":2800,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3045163","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3048694","landlord":"Landlord 45","type":"1 bed flat","beds":1,"area":"Park West, W2","postcode":"W2","price":2350,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3048694","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3046828","landlord":"Landlord 46","type":"1 bed flat","beds":1,"area":"Beauchamp Place, SW3","postcode":"SW3","price":2300,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3046828","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3004279","landlord":"Landlord 47","type":"1 bed flat","beds":1,"area":"Claremont Heights, N1","postcode":"N1","price":2500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3004279","found":"23 Sep 2026"},
{"site":"OpenRent","id":"3047404","landlord":"Landlord 48","type":"2 bed flat","beds":2,"area":"Gloucester Terrace, W2","postcode":"W2","price":3500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.openrent.co.uk/3047404","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18120449","landlord":"Landlord 49","type":"1 bed flat","beds":1,"area":"London W2 (W2)","postcode":"W2","price":3200,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18120449","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"17774106","landlord":"Landlord 50","type":"Studio flat","beds":0,"area":"London EC1 (EC1)","postcode":"EC1","price":2500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=17774106","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18393747","landlord":"Landlord 51","type":"2 bed flat","beds":2,"area":"Clerkenwell (EC1)","postcode":"EC1","price":2800,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18393747","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18196512","landlord":"Landlord 52","type":"2 bed flat","beds":2,"area":"Aldgate (E1)","postcode":"E1","price":4800,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18196512","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18434914","landlord":"Landlord 53","type":"2 bed flat","beds":2,"area":"King's Cross (WC1)","postcode":"WC1","price":3500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18434914","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18203480","landlord":"Landlord 54","type":"1 bed flat","beds":1,"area":"Elephant and Castle (SE17)","postcode":"SE17","price":2675,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18203480","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18432989","landlord":"Landlord 55","type":"Studio flat","beds":0,"area":"St John's Wood (NW8)","postcode":"NW8","price":1300,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18432989","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"17260569","landlord":"Landlord 56","type":"Studio flat","beds":0,"area":"Spitalfields (E1)","postcode":"E1","price":1995,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=17260569","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"16851649","landlord":"Landlord 57","type":"Studio flat","beds":0,"area":"Bayswater (W2)","postcode":"W2","price":1800,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=16851649","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"17131570","landlord":"Landlord 57","type":"Studio flat","beds":0,"area":"Bayswater (W2)","postcode":"W2","price":2000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=17131570","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"16851659","landlord":"Landlord 57","type":"Studio flat","beds":0,"area":"Bayswater (W2)","postcode":"W2","price":1950,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=16851659","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18434771","landlord":"Landlord 58","type":"2 bed flat","beds":2,"area":"Liverpool Street (E1)","postcode":"E1","price":3400,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18434771","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"17154650","landlord":"Landlord 59","type":"1 bed flat","beds":1,"area":"Queen's Gate (SW7)","postcode":"SW7","price":3000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=17154650","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18431197","landlord":"Landlord 60","type":"1 bed flat","beds":1,"area":"London E2 (E2)","postcode":"E2","price":2000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18431197","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"17997150","landlord":"Landlord 61","type":"1 bed flat","beds":1,"area":"Earl's Court (SW5)","postcode":"SW5","price":2500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=17997150","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18419588","landlord":"Landlord 62","type":"1 bed flat","beds":1,"area":"London W9 (W9)","postcode":"W9","price":2200,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18419588","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18084552","landlord":"Landlord 54","type":"1 bed flat","beds":1,"area":"Battersea park (SW11)","postcode":"SW11","price":2325,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18084552","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18432745","landlord":"Landlord 63","type":"1 bed flat","beds":1,"area":"Clerkenwell (EC1)","postcode":"EC1","price":4500,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18432745","found":"23 Sep 2026"},
{"site":"SpareRoom","id":"18323072","landlord":"Landlord 64","type":"1 bed flat","beds":1,"area":"Bayswater (W2)","postcode":"W2","price":4000,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=18323072","found":"23 Sep 2026"},
{"site":"Gumtree","id":"1803056154","landlord":"Landlord 65","type":"2 bed flat","beds":2,"area":"Aldgate East, Whitechapel, E1","postcode":"E1","price":2550,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.gumtree.com/p/property-to-rent/x/1803056154","found":"23 Sep 2026"},
{"site":"Gumtree","id":"1802900646","landlord":"Landlord 66","type":"1 bed flat","beds":1,"area":"Tower Bridge, SE1","postcode":"SE1","price":1650,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.gumtree.com/p/property-to-rent/x/1802900646","found":"23 Sep 2026"},
{"site":"Gumtree","id":"1802560654","landlord":"Landlord 67","type":"Studio flat","beds":0,"area":"Bayswater, W2","postcode":"W2","price":1525,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.gumtree.com/p/property-to-rent/x/1802560654","found":"23 Sep 2026"},
{"site":"Gumtree","id":"1802424388","landlord":"Landlord 68","type":"1 bed flat","beds":1,"area":"Holborn, WC1","postcode":"WC1","price":2167,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.gumtree.com/p/property-to-rent/x/1802424388","found":"23 Sep 2026"},
{"site":"Gumtree","id":"1802233608","landlord":"Landlord 69","type":"2 bed flat","beds":2,"area":"Earls Court, SW5","postcode":"SW5","price":3150,"mode":"rent","private":true,"furnished":"Not stated","url":"https://www.gumtree.com/p/property-to-rent/x/1802233608","found":"23 Sep 2026"}
];
const SITES=['OpenRent','SpareRoom','Gumtree','Rightmove','Zoopla','Facebook','RightmoveCommercial','Realla','NovaLoca','LoopNet'];
const SITE_LABEL=s=>({Facebook:'Facebook Marketplace',RightmoveCommercial:'Rightmove Commercial'})[s]||s;
const FIND_DEF=()=>({strategy:'auto',noAuction:false,noFlats:false,noShared:false,fresh:'any',notes:'',mode:'rent',beds:[],min:1200,max:5000,loc:'',priv:false,furn:'any',type:'any',sites:{Gumtree:true,SpareRoom:true,OpenRent:true,Rightmove:true,Zoopla:true,Facebook:true,RightmoveCommercial:false,Realla:false,NovaLoca:false,LoopNet:false}});
if(!S.find||!S.find.f)S.find={f:FIND_DEF(),searched:false,sort:null};
S.find.f=Object.assign(FIND_DEF(),S.find.f);S.find.f.sites=Object.assign(FIND_DEF().sites,S.find.f.sites);
const FS={busy:false,sel:new Set(),showUnconfirmed:false,auto:0,lastRefresh:false};
document.addEventListener('click',e=>{if(e.target.closest('#fShowUnc')){FS.showUnconfirmed=!FS.showUnconfirmed;renderFind()}});
// Live search results (saved to the account). The LISTINGS sample above only feeds the home page preview.
// Results saved before listing links were checked can include search-results pages; hide those.
const NOT_LISTING=/\/(?:search|find|results|browse|properties-to-rent|property-to-rent\/?$|to-rent\/?(?:property\/)?[^/]*\/?$|for-sale\/?(?:property\/)?[^/]*\/?$)|[?&](?:location|searchLocation|q|query|search|keywords?|locationIdentifier)=|\/(?:property-to-rent|to-rent|for-sale|flatshare|property-for-sale)\/[a-z-]+\/?$|\/[A-Za-z-]+\.html$/i;
const listingLink=u=>/^https:\/\//.test(u||'')&&!NOT_LISTING.test(String(u).replace(/[?&](?:flatshare_id|advert_id)=\d+/i,''));
let LIVE=Array.isArray(S.find.live)?S.find.live.filter(r=>listingLink(r.url)):null;const SRC=()=>LIVE||[];
// Whether the AI opened the listing and found it still available.
function liveTag(r){const when=r.checkedAt?new Date(r.checkedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  if(r.verified==='available')return `<span class="live-ok" title="Opened and still available${when?' at '+when:''}${r.details&&r.details.listed?` · listed ${esc(r.details.listed)}`:''}">✓ Live${when?' · '+esc(when.split(',')[0]):''}</span>`;
  if(r.verified==='unknown')return `<span class="muted" title="The listing opened but its availability wasn't clear">Couldn't confirm</span>`;
  return `<span class="muted" title="Found in search results on ${esc(r.found||'')}; the link couldn't be confirmed">Not confirmed</span>`}
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const bedsTxt=b=>b===0?'Studio':String(b);
/* UK-wide location helpers: which region a place is in, and whether it's in Greater London */
const PC_AREA=t=>{const m=String(t||'').toUpperCase().match(/\b([A-Z]{1,2})\d[A-Z\d]?(?:\s*\d[A-Z]{2})?\b/);return m?m[1]:''};
const LONDON_PC=/^(E|EC|N|NW|SE|SW|W|WC|BR|CR|EN|HA|IG|RM|SM|TW|UB)$/;
const LONDON_TXT=/\b(london|camden|islington|hackney|tower hamlets|westminster|southwark|lambeth|wandsworth|lewisham|greenwich|newham|brent|ealing|haringey|barnet|croydon|bromley|enfield|harrow|hillingdon|hounslow|redbridge|havering|barking|bexley|kingston upon thames|merton|sutton|richmond upon thames|waltham forest|hammersmith|fulham|kensington|chelsea|shoreditch|stratford|canary wharf)\b/i;
const isLondonText=t=>{const s=String(t||'');if(/\blondonderry\b/i.test(s))return false;return LONDON_TXT.test(s)||LONDON_PC.test(PC_AREA(s))};
// Rough nightly-rate estimates by area type (studio, 1, 2, 3+ beds). Always shown as estimates.
const PRIME_SA=/\b(edinburgh|oxford|cambridge|bath|brighton|bristol|york|manchester|windsor|harrogate|cheltenham|canterbury|st andrews|stratford-upon-avon|glasgow|liverpool|birmingham)\b/i;
const RATE_TABLE=[[150,170,220,260],[100,115,150,190],[75,90,115,145]];
const RATE_EST=(b,where)=>RATE_TABLE[isLondonText(where)?0:PRIME_SA.test(String(where||''))?1:2][b==null?1:Math.min(3,Math.max(0,b))];
/* bedrooms: [] means any; '4' means 4 or more. Older saved filters used one value or 'any'. */
const bedList=b=>Array.isArray(b)?b.filter(v=>/^[0-4]$/.test(v)):b==null||b==='any'?[]:[String(b)].filter(v=>/^[0-4]$/.test(v));
const bedsMatch=(list,n)=>!list.length||(n!=null&&list.some(v=>v==='4'?n>=4:n===+v));
// Ticking a second size fills in the sizes between, so Studio then 2 picks Studio, 1 and 2.
$('#fBedsSeg').addEventListener('change',e=>{const t=e.target,boxes=$$('input[name="fBeds"]');
  if(t.id==='fBedsAny'){boxes.forEach(c=>{c.checked=false});t.checked=true;return}
  if(t.checked){const on=boxes.filter(c=>c.checked).map(c=>+c.value);if(on.length>1){const lo=Math.min(...on),hi=Math.max(...on);boxes.forEach(c=>{if(+c.value>=lo&&+c.value<=hi)c.checked=true})}}
  $('#fBedsAny').checked=!boxes.some(c=>c.checked)},true);
/* typed criteria: pick out the obvious filters; everything else goes to the AI as the user's own words */
// UK towns, cities and London areas, so a place is recognised however it's typed.
const UK_PLACES=['london','manchester','birmingham','leeds','liverpool','sheffield','bristol','newcastle upon tyne','newcastle','nottingham','leicester','coventry','bradford','cardiff','swansea','newport','edinburgh','glasgow','aberdeen','dundee','inverness','stirling','belfast','derry','londonderry','southampton','portsmouth','brighton','hove','plymouth','exeter','bath','oxford','cambridge','reading','slough','milton keynes','luton','northampton','peterborough','norwich','ipswich','colchester','chelmsford','southend','basildon','stoke','stoke-on-trent','wolverhampton','walsall','derby','lincoln','york','hull','doncaster','wakefield','huddersfield','halifax','harrogate','middlesbrough','sunderland','durham','gateshead','preston','blackpool','bolton','bury','oldham','rochdale','stockport','salford','wigan','warrington','chester','crewe','blackburn','burnley','lancaster','carlisle','worcester','gloucester','cheltenham','swindon','bournemouth','poole','salisbury','winchester','guildford','woking','crawley','canterbury','maidstone','dartford','gravesend','chatham','margate','hastings','eastbourne','watford','st albans','stevenage','hemel hempstead','high wycombe','aylesbury','bedford','telford','shrewsbury','hereford','torquay','truro','barnsley','rotherham','mansfield','grimsby','scunthorpe','croydon','bromley','camden','islington','hackney','tower hamlets','westminster','southwark','lambeth','wandsworth','lewisham','greenwich','newham','brent','ealing','haringey','barnet','enfield','harrow','hillingdon','hounslow','redbridge','romford','ilford','stratford','canary wharf','shoreditch','kingston','richmond','wimbledon','clapham','brixton','peckham','walthamstow','tottenham','wembley','hammersmith','fulham','chelsea','kensington','paddington','bayswater','finsbury park','headingley','didsbury','salford quays','hemel hempstead','hemel','borehamwood','hertfordshire','bedfordshire','buckinghamshire','berkshire','surrey','kent','essex','sussex','hampshire','yorkshire','lancashire','merseyside','greater manchester','west midlands','cheshire','cornwall','devon','dorset','somerset','norfolk','suffolk','nottinghamshire','derbyshire','leicestershire','staffordshire','county durham','northumberland','cumbria','wales','scotland','northern ireland'];
const NUM_WORDS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,single:1,double:2};
const titleCase=t=>t.replace(/\b([a-z])([a-z']*)/g,(m,a,b)=>['upon','on','under','le','by','de','the','of'].includes(m)?m:a.toUpperCase()+b);
/* typed criteria: pick out the obvious filters; everything else goes to the AI as the user's own words */
function parseCriteria(text){const raw=String(text||''),out={},got=[];
  let lo=' '+raw.toLowerCase().replace(/[–—]/g,'-').replace(/(\d),(?=\d{3}\b)/g,'$1')+' ';
  lo=lo.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|single|double)(?=[\s-]*(?:bed|bedroom|br\b))/g,w=>NUM_WORDS[w]);
  lo=lo.replace(/(\d+(?:\.\d+)?)\s*(?:m|mil|million)\b/g,(x,n)=>String(Math.round(+n*1e6)));
  // floor areas aren't prices
  lo=lo.replace(/(\d+(?:\.\d+)?)\s*(?:sqm|sq\.?\s?m|m2|m²|square met(?:re|er)s?|sq\.?\s?ft|sqft|square feet)\b/g,' floor-area ').replace(/\b(\d+)\s*(?:-|to)\s*(\d+)\s*(units|rooms|keys|apartments|flats)\b/g,'$3 $1 to $2');
  // percentages (ROCE, yield, ROI) aren't prices
  lo=lo.replace(/(\d+(?:\.\d+)?)\s*(?:%|per ?cent\b)/g,' percent ');
  lo=lo.replace(/\bhouse (tenants|people|families|residents|clients|them)\b/g,'accommodate $1');
  lo=lo.replace(/\b(?:city|town) cent(?:re|er)\b/g,'centre');/* "Manchester city centre" is Manchester *//* "to house tenants" isn't a property type */
  // amounts relative to something else ("£100-200 over the LHA rate", "£20k below asking") aren't a budget
  lo=lo.replace(/£?\s?\d+(?:\.\d+)?\s*k?(?:\s*(?:-|to)\s*£?\s?\d+(?:\.\d+)?\s*k?)?\s*(?:a month\s*|per month\s*|pcm\s*|a week\s*|pw\s*)?(?:above|over|more than|on top of|below|under|less than)\s+(?:it\b|the\s+|their\s+)?(?:lha|local housing|asking|market|valuation|rate|the rate)?/g,m=>/above|over|more than|on top|below|under|less than/.test(m)&&/(it\b|lha|local housing|asking|market|valuation|rate)\s*$/.test(m)?' relative-amount ':m);
  const money=(n,k)=>Math.round(+n*(k?1000:1));
  if(/\b(buy|buying|purchase|for sale|to buy|btl|brrr|flip|asking price)\b/.test(lo))out.mode='buy';else if(/\b(rent|renting|to let|let|pcm|pw|per month|a month|r2sa|r2r|rent to rent|serviced accommodation|lha|local housing allowance|housing benefit|temporary accommodation)\b/.test(lo))out.mode='rent';
  if(out.mode)got.push(out.mode==='buy'?'To buy':'To rent');
  {const SW=[['Flip',/\b(flip|flips|flipping|buy[ ,-]*refurb(?:ish)?[ ,-]*(?:and )?sell)\b/],['BRRR',/\bbrrr\b|refinance/],['HMO',/\bhmos?\b|let by the room/],['R2R',/\b(r2r|rent to rent|rent-to-rent|lha|local housing allowance|housing benefit|temporary accommodation|supported (?:living|housing))\b/],['R2SA',/\b(r2sa|serviced accommodation|airbnb|short[- ]lets?)\b/],['LeaseOption',/lease options?/],['Commercial',/\bcommercial\b/],['BTL',/\b(btl|buy to let|buy-to-let)\b/]];
    // the strategy mentioned first wins ("R2R ... HMO potential welcome" is R2R)
    const hit=SW.map(([k,re])=>[k,lo.search(re)]).filter(x=>x[1]>=0).sort((a,b)=>a[1]-b[1])[0];if(hit){out.strategy=hit[0];out.strategies=[hit[0]];got.push(STRAT_NAME[hit[0]]||hit[0])}}
  // bedrooms: "2-3 bed", "studio to 2 bed", "3+ bed", "3 bedroom", "studio"
  const bedN=w=>w==='studio'?0:+w;const BED='(?:bed|beds|bedroom|bedrooms|br|bedder)\\b';
  let m=lo.match(new RegExp(`\\b(studio|\\d)\\s*(?:-|to|or)\\s*(\\d)\\+?\\s*${BED}`));
  if(m){const x=bedN(m[1]),y=Math.min(4,+m[2]);out.beds=[];for(let i=Math.min(x,y);i<=Math.max(x,y);i++)out.beds.push(String(Math.min(i,4)))}
  else if((m=lo.match(new RegExp(`\\b(\\d)\\s*\\+\\s*${BED}|\\b(\\d)\\s*${BED}\\s*(?:or more|plus|\\+)`)))){const x=+(m[1]||m[2]);out.beds=[];for(let i=Math.min(x,4);i<=4;i++)out.beds.push(String(i))}
  else if((m=lo.match(new RegExp(`\\b(\\d)\\s*(?:-\\s*)?${BED}`))))out.beds=[String(Math.min(4,+m[1]))];
  else if(/\bstudios?\b/.test(lo))out.beds=['0'];
  if(out.beds){out.beds=[...new Set(out.beds)];got.push(out.beds.length>1?`${out.beds[0]==='0'?'Studio':out.beds[0]}–${out.beds[out.beds.length-1]==='4'?'4+':out.beds[out.beds.length-1]} beds`:out.beds[0]==='0'?'Studio':`${out.beds[0]==='4'?'4+':out.beds[0]} bed`)}
  // price: ranges first, then max and min; numbers next to "bed" are bedrooms, not prices
  const P='£?\\s?(\\d+(?:\\.\\d+)?)\\s*(k)?';
  if((m=lo.match(new RegExp(`(?:between|from)\\s*${P}\\s*(?:and|to|-)\\s*${P}`)))||(m=lo.match(new RegExp(`£\\s?(\\d+(?:\\.\\d+)?)\\s*(k)?\\s*(?:-|to)\\s*£?\\s?(\\d+(?:\\.\\d+)?)\\s*(k)?`)))||(m=lo.match(/\b(\d{1,4}(?:\.\d+)?)\s*(k)\s*(?:-|to)\s*(\d{1,4}(?:\.\d+)?)\s*(k)\b/))||(m=lo.match(/\b(\d{3,7})\s*(k)?\s*(?:-|to)\s*(\d{3,7})\s*(k)?\b(?!\s*(?:bed|br))/))){out.min=money(m[1],m[2]||m[4]);out.max=money(m[3],m[4])}
  else{if((m=lo.match(new RegExp(`(?:under|below|max(?:imum)?|up to|upto|less than|no more than|budget(?: of| is)?|cap(?:ped)? at|<)\\s*${P}`))))out.max=money(m[1],m[2]);
    if((m=lo.match(new RegExp(`(?:over|above|min(?:imum)?|at least|more than|starting at|>)\\s*${P}`))))out.min=money(m[1],m[2]);
    if(out.max==null&&out.min==null&&(m=lo.match(/£\s?(\d+(?:\.\d+)?)\s*(k)?|\b(\d{3,7})\s*(k)?\s*(?:pcm|pm|pw|per month|a month|per week|a week)\b/))){const v=money(m[1]||m[3],m[2]||m[4]);out.max=/(pw|per week|a week)\b/.test(lo)?Math.round(v*52/12):v}}
  // a lone amount like "2 bed 1500" is taken as the budget
  if(out.max==null&&out.min==null&&(m=lo.match(/(?:^|\s)(\d{3,7})\s*(k)?(?=[\s.,!]|$)(?!\s*(?:bed|br|-))/)))out.max=money(m[1],m[2]);
  if(out.max!=null&&/(pw|per week|a week)\b/.test(lo)&&out.max<1000&&out.mode!=='buy'){out.max=Math.round(out.max*52/12);if(out.min)out.min=Math.round(out.min*52/12)}
  if(out.max!=null||out.min!=null){if(out.min==null)out.min='';if(out.max==null)out.max='';got.push(`${out.min!==''?gbp(out.min):'£0'}–${out.max!==''?gbp(out.max):'any'}`)}
  // whole buildings, hotels and blocks: leave the property type open so they aren't hidden
  if(/\b(hotels?|aparthotels?|block|blocks|building|buildings|portfolio|units|rooms|keys)\b/.test(lo)){/* any type */}
  else if(/\b(commercial|office|offices|retail|shop|industrial|warehouse|unit to let)\b/.test(lo))out.type='commercial';else if(/\b(houses?|terraced?|semi|semi-detached|detached|bungalow|townhouse|cottage)\b/.test(lo)&&/\b(flats?|apartments?|maisonettes?)\b/.test(lo)){/* both mentioned: leave the type open */}
  else if(/\b(houses?|terraced?|semi|semi-detached|detached|bungalow|townhouse|cottage)\b/.test(lo))out.type='house';else if(/\b(flats?|apartments?|maisonettes?|penthouse)\b/.test(lo))out.type='flat';else if(out.beds&&out.beds.join()==='0')out.type='studio';
  if(out.type&&!(out.type==='studio'&&out.beds&&out.beds.join()==='0'))got.push(out.type[0].toUpperCase()+out.type.slice(1));
  if(/\bunfurnished\b/.test(lo))out.furn='unfurnished';else if(/\bfurnished\b/.test(lo))out.furn='furnished';if(out.furn)got.push(out.furn[0].toUpperCase()+out.furn.slice(1));
  if(/private landlords?|no agents?|direct(?:ly)? (?:from|with) (?:the )?landlord/.test(lo)){out.priv=true;got.push('Private landlords')}
  if(/\b(?:no|not|exclude|excluding|without|avoid|skip)\s+(?:any\s+)?auctions?\b/.test(lo)){out.noAuction=true;got.push('No auctions')}
  if(/\b(?:no|not|exclude|excluding|without|avoid|skip)\s+(?:any\s+|all\s+)?(?:flats?|apartments?)\b/.test(lo)){out.noFlats=true;got.push('No flats')}
  if(/\b(?:no|not|exclude|excluding|without|avoid|skip)\s+(?:any\s+|all\s+)?shared[\s-]?ownerships?\b/.test(lo)){out.noShared=true;got.push('No shared ownership')}
  if((m=lo.match(/\b(?:last|past|within)\s*(24 ?h(?:ours?)?|day|\d+ days?|week|fortnight)\b|\b(new today|just listed|newly listed|brand new listings?)\b/))){const w=m[1]||'';out.fresh=m[2]?'3':/24|day\b/.test(w)&&!/\d+ days?/.test(w)?'1':/fortnight/.test(w)?'14':/week/.test(w)?'7':String(Math.min(14,Math.max(1,parseInt(w)||7))).replace(/^(2|4|5|6)$/,'7').replace(/^(8|9|10|11|12|13)$/,'14');got.push('Listed recently')}
  // locations: every place named, in the order typed: places after in/near/around (including lists
  // like "in Watford, Hemel and Luton"), known UK towns, counties and London areas, and postcode districts
  const STOP=/^(zone|zones|under|below|over|above|with|for|max|maximum|min|minimum|between|from|up|upto|at|budget|near|close|pcm|pm|pw|per|a|that|which|landlord|landlords|private|furnished|unfurnished|to|rent|let|buy|sale|r2sa|r2r|hmo|btl|serviced|bed|beds|bedroom|bedrooms|studio|flat|flats|house|houses|within|around|area|areas|please|last|past|this|next|week|weeks|month|months|day|days|listed|added|new|newly|recent|recently|properties|property|investor|investors|wants|want|looking|cash|purchase|refurb|refurbishment|temporary|accommodation|is|are|fine|welcome|only|etc|centre|center|postcode|postcodes|postal|code|codes)$/;
  const FILL=/^(the|wider|also|surrounding|nearby|greater-|open|closed|limited|council|councils|procurement|selected|certain|specific|target|priority|these|those|approved)$/;/* generic words that start a phrase like "in open council procurement areas" are skipped, so they aren't read as a place */
  const hits=[];
  for(const mm of lo.matchAll(/\b(?:in|near|around|across|within|nr|also)\s+([a-z][a-z0-9' .,&\/-]{1,120})/g)){let pos=mm.index+mm[0].length-mm[1].length;
    for(const seg of mm[1].split(/\s*(?:,|\/|&|\band\b|\bor\b)\s*/)){const words=[];let started=false;
      for(const w0 of seg.trim().split(/\s+/)){const w=w0.replace(/[.]+$/,'');if(!started&&FILL.test(w))continue;started=true;if(!w||STOP.test(w)||/\d/.test(w))break;words.push(w)}
      const name=words.join(' ');if(name.length>2)hits.push({pos:lo.indexOf(name,pos),name:titleCase(name)});
      if(!/^[^.!?\n]*$/.test(seg))break}}
  UK_PLACES.forEach(pl=>{for(const mm of lo.matchAll(new RegExp(`\\b${pl.replace(/-/g,'[- ]')}\\b`,'g')))hits.push({pos:mm.index,name:titleCase(pl)})});
  // only real UK postcode areas, so planning classes like C1 or E aren't read as places
  const PC_AREAS=new Set('AB AL B BA BB BD BH BL BN BR BS BT CA CB CF CH CM CO CR CT CV CW DA DD DE DG DH DL DN DT DY E EC EH EN EX FK FY G GL GU HA HD HG HP HR HS HU HX IG IP IV KA KT KW KY L LA LD LE LL LN LS LU M ME MK ML N NE NG NN NP NR NW OL OX PA PE PH PL PO PR RG RH RM S SA SE SG SK SL SM SN SO SP SR SS ST SW SY TA TD TF TN TQ TR TS TW UB W WA WC WD WF WN WR WS WV YO ZE'.split(' '));
  for(const mm of raw.matchAll(/\b([A-Za-z]{1,2}\d{1,2}[A-Za-z]?)(?:\s*\d[A-Za-z]{2})?\b/g)){const d=mm[1];if(!PC_AREAS.has(d.replace(/\d.*$/,'').toUpperCase())||/^(\d|x\d)/i.test(d)||new RegExp(`^\\s*(?:bed|br|k\\b)`,'i').test(raw.slice(mm.index+mm[0].length)))continue;hits.push({pos:mm.index,name:d.toUpperCase()})}
  // whole postcode areas named on their own: "DL, TS and DH postcodes", "postcodes LS and BD"
  const PC_NAME={AB:'Aberdeen',AL:'St Albans',B:'Birmingham',BA:'Bath',BB:'Blackburn',BD:'Bradford',BH:'Bournemouth',BL:'Bolton',BN:'Brighton',BR:'Bromley',BS:'Bristol',BT:'Belfast',CA:'Carlisle',CB:'Cambridge',CF:'Cardiff',CH:'Chester',CM:'Chelmsford',CO:'Colchester',CR:'Croydon',CT:'Canterbury',CV:'Coventry',CW:'Crewe',DA:'Dartford',DD:'Dundee',DE:'Derby',DG:'Dumfries',DH:'Durham',DL:'Darlington',DN:'Doncaster',DT:'Dorchester',DY:'Dudley',E:'East London',EC:'Central London',EH:'Edinburgh',EN:'Enfield',EX:'Exeter',FK:'Falkirk',FY:'Blackpool',G:'Glasgow',GL:'Gloucester',GU:'Guildford',HA:'Harrow',HD:'Huddersfield',HG:'Harrogate',HP:'Hemel Hempstead',HR:'Hereford',HS:'Outer Hebrides',HU:'Hull',HX:'Halifax',IG:'Ilford',IP:'Ipswich',IV:'Inverness',KA:'Kilmarnock',KT:'Kingston upon Thames',KW:'Kirkwall',KY:'Kirkcaldy',L:'Liverpool',LA:'Lancaster',LD:'Llandrindod Wells',LE:'Leicester',LL:'Llandudno',LN:'Lincoln',LS:'Leeds',LU:'Luton',M:'Manchester',ME:'Medway',MK:'Milton Keynes',ML:'Motherwell',N:'North London',NE:'Newcastle upon Tyne',NG:'Nottingham',NN:'Northampton',NP:'Newport',NR:'Norwich',NW:'North West London',OL:'Oldham',OX:'Oxford',PA:'Paisley',PE:'Peterborough',PH:'Perth',PL:'Plymouth',PO:'Portsmouth',PR:'Preston',RG:'Reading',RH:'Redhill',RM:'Romford',S:'Sheffield',SA:'Swansea',SE:'South East London',SG:'Stevenage',SK:'Stockport',SL:'Slough',SM:'Sutton',SN:'Swindon',SO:'Southampton',SP:'Salisbury',SR:'Sunderland',SS:'Southend',ST:'Stoke-on-Trent',SW:'South West London',SY:'Shrewsbury',TA:'Taunton',TD:'Scottish Borders',TF:'Telford',TN:'Tonbridge',TQ:'Torquay',TR:'Truro',TS:'Teesside',TW:'Twickenham',UB:'Uxbridge',W:'West London',WA:'Warrington',WC:'Central London',WD:'Watford',WF:'Wakefield',WN:'Wigan',WR:'Worcester',WS:'Walsall',WV:'Wolverhampton',YO:'York',ZE:'Shetland'};
  const LIST='((?:\\b[a-z]{1,2}\\b(?:\\s*(?:,|&|\\/|\\band\\b|\\bor\\b)?\\s*))+)';
  for(const mm of [...lo.matchAll(new RegExp(LIST+'(?:postcode|postal code)s?(?: areas?)?\\b','g')),...lo.matchAll(new RegExp('\\b(?:postcode|postal code)s?(?: areas?)?\\s*(?:of|in|:)?\\s*'+LIST,'g'))]){let pos=mm.index;
    for(const t of mm[1].matchAll(/\b[a-z]{1,2}\b/g)){const a=t[0].toUpperCase();if(!PC_AREAS.has(a)||(/^(me|so)$/.test(t[0])&&mm[1].trim()!==t[0]))continue;
      hits.push({pos:pos+t.index,name:`${a} (${PC_NAME[a]})`})}}
  // keep each place once, prefer the longer name ("Newcastle upon Tyne" over "Newcastle"), in typed order
  // "contains" means whole words, so Newcastle is covered by Newcastle upon Tyne but Cambridge is not swallowed by South Cambridgeshire
  const wc=(x,y)=>(' '+x.replace(/-/g,' ')+' ').includes(' '+y.replace(/-/g,' ')+' ');
  const places=[];hits.filter(h=>h.pos>=0).sort((x,y)=>x.pos-y.pos||y.name.length-x.name.length).forEach(h=>{const k=h.name.toLowerCase();
    if(places.some(p=>wc(p.toLowerCase(),k)||wc(k,p.toLowerCase())&&p.length<k.length&&(places[places.indexOf(p)]=h.name)))return;places.push(h.name)});
  const loc=[...new Set(places)].slice(0,6).join(', ');
  if(loc){out.loc=loc;got.push(loc)}
  return {f:out,got}}
// Several strategies can be ticked; the first is the main one (it drives the search, ranking and analysis).
const findStrats=f=>{const L=(Array.isArray(f.strategies)&&f.strategies.length?f.strategies:[f.strategy||'auto']).filter(x=>x);return L.length?L:['auto']};
function bindFind(){const f=S.find.f;$('#fNotes').value=f.notes||'';{const L=findStrats(f);$$('input[name="fStrat"]').forEach(c=>{c.checked=L.includes(c.value)})}$('#fFresh').value=f.fresh||'any';
  $(f.mode==='buy'?'#fModeBuy':'#fModeRent').checked=true;
  f.beds=bedList(f.beds);$$('input[name="fBeds"]').forEach(c=>{c.checked=f.beds.includes(c.value)});$('#fBedsAny').checked=!f.beds.length;
  $('#fMin').value=f.min;$('#fMax').value=f.max;$('#fLoc').value=f.loc;$('#fPrivate').checked=f.priv;$('#fNoAuction').checked=!!f.noAuction;$('#fNoFlats').checked=!!f.noFlats;$('#fNoShared').checked=!!f.noShared;$('#fFurn').value=f.furn;$('#fType').value=f.type;
  SITES.forEach(s=>{$('#fSite'+s).checked=!!f.sites[s]});findChrome()}
function readFind(){const f=S.find.f,n=v=>String(v).trim()===''?'':Math.max(0,+v||0);
  f.notes=$('#fNotes').value.slice(0,500);{const L=$$('input[name="fStrat"]:checked').map(c=>c.value),keep=findStrats(f).filter(x=>L.includes(x));
    f.strategies=[...keep,...L.filter(x=>!keep.includes(x))];if(!f.strategies.length)f.strategies=['auto'];f.strategy=f.strategies[0]}f.fresh=$('#fFresh').value;f.mode=$('#fModeBuy').checked?'buy':'rent';f.beds=$$('input[name="fBeds"]:checked').map(c=>c.value);
  f.min=n($('#fMin').value);f.max=n($('#fMax').value);f.loc=$('#fLoc').value;f.priv=$('#fPrivate').checked;f.noAuction=$('#fNoAuction').checked;f.noFlats=$('#fNoFlats').checked;f.noShared=$('#fNoShared').checked;f.furn=$('#fFurn').value;f.type=$('#fType').value;
  SITES.forEach(s=>{f.sites[s]=$('#fSite'+s).checked})}
function findChrome(){const f=S.find.f,buy=f.mode==='buy';$('#fPanel').dataset.mode=f.mode;
  $('#fMinL').textContent=buy?'Min price':'Min rent';$('#fMaxL').textContent=buy?'Max price':'Max rent';
  $('#fFurnNote').hidden=f.furn==='any';$('#fRmNote').hidden=!f.sites.Rightmove}
function locMatch(x,q){q=q.trim().toLowerCase();if(!q)return true;const pc=x.postcode.toLowerCase();
  // Postcode district (SE1, W2, W1D): match the district, so SE1 does not also match SE11, but W1 matches W1D.
  if(/^[a-z]{1,2}\d[a-z\d]?$/.test(q))return pc.startsWith(q)&&!/\d/.test(pc.charAt(q.length));
  return new RegExp('(^|[^a-z0-9])'+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test((x.area+' '+x.postcode).toLowerCase())}
/* how fresh a listing is: when it was added, new since the last refresh, or likely to go soon */
const DAY_MS=864e5;
const ageDays=r=>{const t=Date.parse(r.listedAt||'');return Number.isNaN(t)?null:Math.max(0,Math.floor((Date.now()-t)/DAY_MS))};
const ageTxt=d=>d==null?'':d===0?'Today':d===1?'Yesterday':d<14?`${d} days ago`:d<60?`${Math.round(d/7)} weeks ago`:`${Math.round(d/30)} months ago`;
const isFreshNew=r=>{const d=ageDays(r);return (d!=null&&d<=3)||(!!r.newAt&&Date.now()-Date.parse(r.newAt)<3*DAY_MS)};
function freshTags(r){const d=ageDays(r),t=[];if(isFreshNew(r))t.push('<span class="fr-tag new">New</span>');
  if(r.hot)t.push('<span class="fr-tag hot" title="The advert mentions high demand, a closing date or booked-up viewings">Going fast</span>');
  else if(d!=null&&d>=21)t.push('<span class="fr-tag old" title="Listed 3+ weeks ago, so it may go soon or already be taken">Older</span>');return t.join('')}
const freshMatch=(r,f)=>!f.fresh||f.fresh==='any'||(ageDays(r)!=null&&ageDays(r)<=+f.fresh);
// Only listings whose link was opened and confirmed live are shown, unless the member asks to see the rest.
const confirmedLive=x=>x.verified==='available';
function findRows(all=false){const f=S.find.f;
  return SRC().map((x,i)=>Object.assign({k:i,listedTs:Date.parse(x.listedAt||'')||0},x)).filter(x=>(all||FS.showUnconfirmed||FS.autoUnc||confirmedLive(x))&&freshMatch(x,f)&&x.mode===f.mode
    &&bedsMatch(bedList(f.beds),x.beds)
    &&(f.min===''||x.price>=f.min)&&(f.max===''||x.price<=f.max)
    &&(LIVE||locMatch(x,f.loc))&&(!f.priv||x.private!==false)&&(!f.noAuction||!/auction/i.test((x.title||'')+' '+(x.url||'')))&&(!f.noFlats||!/\b(?:flats?|apartments?|maisonettes?|studios?|penthouses?)\b/i.test((x.type||'')+' '+(x.title||'')))&&(!f.noShared||!/shared[\s-]?ownership|part[\s-]?buy|shared[\s-]?equity|staircasing/i.test((x.title||'')+' '+(x.type||'')))
    &&(f.furn==='any'||x.furnished==='Not stated'||x.furnished.toLowerCase()===f.furn)
    &&(f.type==='any'||(f.type==='studio'?x.beds===0:f.type==='flat'?x.beds>=1&&/flat/i.test(x.type):f.type==='commercial'?/commercial|office|retail|shop|industrial/i.test(x.type):/house/i.test(x.type)))
    &&!!f.sites[x.site])}
/* ---------- per-deal unlocks ---------- */
const lid=r=>r.site+':'+r.id;
const isOpen=()=>true;// deals are free: every listing shows its full details and link
const dealFee=()=>Math.max(0,Math.round(+S.dealFee||0));
// Sorting by hidden fields must not reveal locked rows' details: locked rows sort last on those keys.
const HIDDEN_KEYS=['site','landlord','area'];
function sortRows(r){const s=S.find.sort;if(!s)return r;
  const val=(row,k)=>HIDDEN_KEYS.includes(k)&&!isOpen(row)?'￿':row[k];
  return r.slice().sort((a,b)=>{const x=val(a,s.k),y=val(b,s.k);const c=typeof x==='number'?x-y:String(x).localeCompare(String(y),'en-GB',{numeric:true,sensitivity:'base'});return (c||a.k-b.k)*s.dir})}
const LOCK='<svg class="lk" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="2.25" y="5.25" width="7.5" height="5.5" rx="1"/><path d="M4 5.25V3.75a2 2 0 0 1 4 0v1.5"/></svg>';
const CHEV=d=>`<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d<0?'M8.5 3.5L5 7l3.5 3.5':'M5.5 3.5L9 7l-3.5 3.5'}"/></svg>`;
const DEF_A={fee:15,clean:45,stay:3,other:150};
/* strategy-aware figures for Deal Finder cards, the sheet and copied cards. All rough estimates, labelled as such. */
// Long-let rents follow different areas from short-let demand: these are the higher-rent towns and cities.
const PRIME_RENT=/\b(oxford|cambridge|brighton|hove|bristol|bath|edinburgh|reading|guildford|st albans|windsor|winchester|watford|milton keynes|cheltenham|york|aberdeen|surrey|hertfordshire)\b/i;
const areaTier=w=>isLondonText(w)?0:PRIME_RENT.test(String(w||''))?1:2;
const RENT_TABLE=[[1300,1700,2200,2800],[800,1000,1250,1500],[500,625,750,875]];// whole-property market rent pcm, rough
const ROOM_TABLE=[900,650,450];// room rent pcm, rough
const bIdx=b=>b==null?1:Math.min(3,Math.max(0,b));
const RENT_EST=(b,w)=>RENT_TABLE[areaTier(w)][bIdx(b)];
const ROOM_EST=w=>ROOM_TABLE[areaTier(w)];
// Deals analysed from a property for sale before this fix had the asking price saved as the rent and
// deposit. A rent of £20,000 a month or more can only be a price: move it to the purchase price.
function repairPriceAsRent(d){if(!d||!Array.isArray(d.units))return;let fixed=false;
  d.units.forEach(u=>{if(!(+u.price>0)&&+u.rent>=20000){const beds=+(String(u.label).match(/(\d+)\s*bed/i)||[])[1]||null,w=d.area||'';
    Object.assign(u,{price:+u.rent,rent:0,dep:0,mrent:+u.mrent||RENT_EST(beds,w),rooms:+u.rooms||Math.max(1,beds||1),roomRent:+u.roomRent||ROOM_EST(w),bills:+u.bills||100*Math.max(1,beds||1),refurb:+u.refurb||0,gdv:+u.gdv||0});fixed=true}});
  if(fixed&&!BUY_MODELS.has(modelOf(d)))d.strat='BTL';return fixed}
// Repaired in memory only: saving here would make the browser copy differ from the account copy on every
// load, and sign-in reloads the page whenever they differ. The fix is saved with the member's next change.
repairPriceAsRent(S.deal);(S.saved||[]).forEach(repairPriceAsRent);
// Stamp duty in England for an additional property (5% surcharge on top of the standard bands).
function sdltAdditional(p){if(p<40000)return 0;const bands=[[125000,0],[250000,.02],[925000,.05],[1500000,.10],[Infinity,.12]];let t=0,lo=0;for(const [hi,r] of bands){if(p>lo)t+=(Math.min(p,hi)-lo)*r;lo=hi}return Math.round(t+p*.05)}
const STRAT_NAME={R2SA:'R2SA',R2R:'Rent to rent',BTL:'Buy to let',HMO:'HMO',BRRR:'BRRR',Flip:'Flip',SA:'Owned SA',LeaseOption:'Lease option',Commercial:'Commercial',none:'Prices only'};
// The strategy in use for a listing: the member's choice, or R2SA for rentals and BTL for purchases.
function stratFor(r,pick){const s=pick||(S.find&&S.find.f&&S.find.f.strategy)||'auto',buy=r.mode==='buy';
  if(s==='auto')return buy?'BTL':'R2SA';if(s==='R2SA'&&buy)return 'SA';if(s==='SA'&&!buy)return 'R2SA';
  if(['BTL','HMO','BRRR','Flip'].includes(s)&&!buy)return s==='HMO'?'R2R':'none';if(s==='R2R'&&buy)return 'HMO';return s}
// The key figure for each other ticked strategy that fits this listing: [[name,label,value,neg],...]
function extraKeys(r){const f=S.find&&S.find.f;if(!f)return [];const main=stratFor(r),seen=new Set([main,'none']),out=[];
  findStrats(f).slice(1).forEach(s=>{const st=stratFor(r,s);if(seen.has(st))return;seen.add(st);const k=stratFigures(r,s).key;out.push([STRAT_NAME[st]||st,k[0],k[1],!!k[2]])});return out}
// Returns {key:[label,value,neg?], lines:[[emoji,html-safe text],...], note}
function stratFigures(r,pick){const st=stratFor(r,pick),w=r.area+' '+r.postcode,buy=r.mode==='buy',P=r.price,rooms=Math.max(1,r.beds||1);
  const L=[],note='Figures are rough estimates for the area. Analyse the deal for a full, local check.';
  if(st==='R2SA'||st==='SA'){const u={rent:buy?0:P,rate:RATE_EST(r.beds,w)},occ=OCC.map(x=>month(u,x,null,DEF_A).surplus);
    if(buy)L.push(['💷',`Asking price ${gbp(P)}`],['🧾',`Stamp duty about ${gbp(sdltAdditional(P))} (est.)`]);else L.push(['💸',`Rent ${gbp(P)}/month (${gbp(P*12)}/year)`],['💸',`Deposit about ${gbp(P)} (est.)`]);
    L.push(['💰',`Nightly rate about £${u.rate} (est.)`],['💷',OCC.map((x,j)=>`${gbp(occ[j])} at ${pct(x)}`).join(' · ')+` occupancy${buy?' before mortgage':''} (est.)`]);
    return {st,key:['Profit at 80%',gbp(occ[1]),occ[1]<0],lines:L,note:'Nightly rate and occupancy are estimates. Analyse the deal for local figures.'}}
  if(st==='R2R'){const inc=rooms*ROOM_EST(w),bills=100*rooms,prof=inc-P-bills;
    L.push(['💸',`Rent ${gbp(P)}/month`],['🛏',`Let as ${rooms} room${rooms>1?'s':''} at about ${gbp(ROOM_EST(w))} each (est.)`],['💡',`Bills about ${gbp(bills)}/month (est.)`],['💷',`About ${gbp(prof)}/month after rent and bills (est.)`]);
    return {st,key:['Profit/mo',gbp(prof),prof<0],lines:L,note}}
  if(st==='BTL'||st==='HMO'||st==='BRRR'){const rent=st==='HMO'?rooms*ROOM_EST(w):RENT_EST(r.beds,w),sd=sdltAdditional(P),dep=Math.round(P*.25),mort=Math.round(P*.75*.055/12),costs=Math.round(rent*(st==='HMO'?.3:.2)),cf=rent-mort-costs,gy=rent*12/P*100;
    L.push(['💷',`Asking price ${gbp(P)}`],['🧾',`Stamp duty about ${gbp(sdltAdditional(P))} (est., England)`]);
    if(st==='BRRR')L.push(['🔨',`Money in before works: about ${gbp(P+sd+1500)} (est.)`]);else L.push(['🏦',`25% deposit ${gbp(dep)} · cash needed about ${gbp(dep+sd+1500)} (est.)`]);
    L.push(['🏠',`${st==='HMO'?`${rooms} rooms at about ${gbp(ROOM_EST(w))} = `:'Market rent about '}${gbp(rent)}/month (est.)`],['📈',`Gross yield about ${gy.toFixed(1)}% (est.)`],...(gy>15?[['⚠️','Unusually high: cheaper homes often rent for less than the area average. Check local rents before relying on this.']]:[]));
    if(st!=='BRRR')L.push(['💷',`Cash flow about ${gbp(cf)}/month after a 5.5% interest-only mortgage and costs (est.)`]);else L.push(['🔁','Refinance at 75% of the value after works: analyse for the end value']);
    return {st,key:st==='BRRR'?['Money in before works',gbp(P+sd+1500)]:['Gross yield',gy.toFixed(1)+'%',gy<5],lines:L,note}}
  if(st==='Flip'){const sd=sdltAdditional(P),entry=P+sd+1500;
    L.push(['💷',`Asking price ${gbp(P)}`],['🧾',`Stamp duty about ${gbp(sd)} (est., England)`],['💼',`Cash in before works about ${gbp(entry)} incl. legal fees (est.)`],
      ...(r.beds?[['🛏',`${gbp(Math.round(P/Math.max(1,r.beds)))} per bedroom`]]:[]),['🔨','Refurb cost, resale value and margin: analyse the deal']);
    return {st,key:['Cash in',gbp(entry)],lines:L,note:'Purchase costs are estimates. Analyse for comparable sales, refurb and margin.'}}
  if(st==='LeaseOption'){L.push(buy?['💷',`Asking price ${gbp(P)}`]:['💸',`Rent ${gbp(P)}/month`],['📝','Option fee, monthly payment and term: analyse the deal']);return {st,key:[buy?'Price':'Rent',gbp(P)],lines:L,note}}
  L.push(buy?['💷',`${st==='Commercial'?'Price':'Asking price'} ${gbp(P)}`]:['💸',`Rent ${gbp(P)}/month`]);
  return {st,key:[buy?'Price':'Rent',gbp(P)],lines:L,note:'Analyse the deal for the figures that matter to your strategy.'}}
const bedWord=b=>b===0?'studio':b+' bed';
const fmtDate=iso=>{try{return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}catch(e){return String(iso)}};
const CARD_SORTS=[['','Listing order'],['price:1','Rent, low to high'],['price:-1','Rent, high to low'],['beds:1','Fewest bedrooms'],['beds:-1','Most bedrooms'],['postcode:1','Postcode']];
// Locked cards show postcode district, type and figures only: no street, landlord, source site or link.
function dealCard(r,i,o={}){const SF=o.preview?null:stratFigures(r),open=!o.preview&&isOpen(r),u={rent:r.price,rate:RATE_EST(r.beds,r.area+' '+r.postcode)},occ=OCC.map(x=>month(u,x,null,DEF_A).surplus);
  const li=(em,txt)=>`<li>${o.plain?'<span class="em-dot" aria-hidden="true"></span>':`<span class="em" aria-hidden="true">${em}</span>`}<span>${txt}</span></li>`;
  const act=o.preview?`<button class="btn sm" data-go="find">Open in Deal Finder</button>`
    :open?`<button class="btn sm primary" data-build="${r.k}">Analyse deal</button><a class="btn sm" href="${esc(r.url)}" target="_blank" rel="noopener">Open listing ↗</a>${r.pack?`<a class="btn sm" href="/pack/${esc(r.pack.id)}" target="_blank" rel="noopener">Deal pack ↗</a>`:''}`
    :`<button class="btn sm" data-unlock="${r.k}" data-n="${i+1}">${LOCK}Unlock this deal · ${gbp(dealFee())}</button>`;
  return `<article class="dcard${open?' is-open':''}${FS.justOpened===r.k&&open?' just-open':''}" data-k="${r.k}" aria-label="Deal ${i+1}">
    <h3>Deal ${i+1} (${gbp(r.price)} ${bedWord(r.beds)})${r.ai>=0?` <span class="ai-sc ${r.ai>=75?'hi':r.ai>=55?'mid':'lo'}" title="Score · ${esc(r.aiv||'')}">${r.ai}</span>`:''}</h3>${o.preview?'':`<p class="dc-live">${liveTag(r)}${ageDays(r)!=null?` <span class="muted">· listed ${ageTxt(ageDays(r)).toLowerCase()}</span>`:''} ${freshTags(r)}</p>`}
    <ul class="adv">${li('📍',`${esc(o.preview?String(r.area||r.postcode).replace(/\s*\(.*\)$/,''):[r.postcode,(r.area||'').split(',').pop().trim()].filter(Boolean).join(', '))}${o.plain?'':' <span class="em" aria-hidden="true">📍</span>'}`)}${open?li('🏠',esc(r.area)):''}${li('🛏',esc(r.type))}</ul>
    <ul class="adv">${(o.preview?{lines:[['💸',`Rent ${gbp(r.price)}/month (${gbp(r.price*12)}/year)`],['💰',`Nightly rate about £${u.rate} (est.)`],...OCC.map((x,j)=>['💷',`${gbp(occ[j])} at ${pct(x)} occupancy`])]}:SF).lines.map(([e,t])=>li(e,esc(t))).join('')}</ul>${o.preview?'':(()=>{const X=extraKeys(r);return X.length?`<ul class="adv">${X.map(([n,l,v])=>li('🔁',esc(`As ${n}: ${l} ${v} (est.)`))).join('')}</ul>`:''})()}
    ${open?`<ul class="adv">${r.title?li('📝',esc(r.title)):''}${li('🔗',`Source: ${esc(SITE_LABEL(r.site))}`)}</ul>`:''}
    <div class="dc-foot"><div class="dc-note"><span>${o.preview?'Figures illustrative. Nightly rate estimated.':esc(SF.note)}${SF?` · <b>${esc(STRAT_NAME[SF.st]||SF.st)}</b>`:''}</span></div>
      <div class="dc-act">${act}</div></div>
  </article>`}
function renderFind(){findChrome();syncFee();if(FS.busy)return;const box=$('#fResults');
  if(!LIVE){box.innerHTML=`<div class="fempty"><h2>Search live property listings</h2><p>Set your filters, tick the sites and choose a power level, then run Search. Deal Pro searches every ticked site for current listings, shows them in a sheet with a link to each one, and picks out the best deals. Copy them into Google Sheets or analyse any of them in the Deal Analyser.</p></div>`;return}
  if(S.find.viewV!==2){S.find.view='map';S.find.viewV=2}
  const view=['cards','sheet','map'].includes(S.find.view)?S.find.view:'map',prevScroll=($('#fCards')||{}).scrollLeft||0;
  // If none of the listings could be confirmed (the sites blocked the check), show them anyway with a warning.
  {const all=findRows(true);FS.autoUnc=!FS.showUnconfirmed&&all.length>0&&!all.some(confirmedLive)}
  const SC=aiScores(),base=findRows();base.forEach(r=>{const x=SC.get(r.k);r.ai=x?x.score:-1;r.aiv=x?x.verdict:''});
  // With a ranking, the list is sorted by AI score unless the member picked another sort.
  const rows=S.find.sort?sortRows(base):SC.size?base.slice().sort((a,b)=>b.ai-a.ai||a.k-b.k):base,keys=new Set(rows.filter(isOpen).map(r=>r.k));[...FS.sel].forEach(k=>{if(!keys.has(k))FS.sel.delete(k)});
  FS.lastRows=rows;const keyHead=rows.length?stratFigures(rows[0]).key[0]+' (est.)':'Estimate';
  const pr=rows.map(r=>r.price).sort((a,b)=>a-b),m=pr.length,med=m?(m%2?pr[(m-1)/2]:(pr[m/2-1]+pr[m/2])/2):NaN,nOpen=keys.size;
  const ll=new Set(rows.map(r=>r.site)).size,buy=S.find.f.mode==='buy',so=S.find.sort,sv=so?`${so.k}:${so.dir}`:'';
  const hidden=FS.showUnconfirmed||FS.autoUnc?0:findRows(true).length-rows.length,nUnc=findRows(true).filter(x=>!confirmedLive(x)).length;
  const sum=`<b class="mono">${m}</b> ${FS.showUnconfirmed?'':'live '}listing${m===1?'':'s'} from <b class="mono">${ll}</b> site${ll===1?'':'s'}${m?` · median <b class="mono">${gbp(med)}</b>${buy?'':' pcm'}`:''}${S.find.liveAt?` · searched ${fmtDate(S.find.liveAt)}`:''}`;
  const unc=FS.autoUnc?`<div class="fsub warn-note">These sites wouldn't let Deal Pro confirm the listings automatically, so they're shown unconfirmed. Open each link to check it's still available, or run Analyst or Expert, which confirm more.</div>`:nUnc?`<div class="fsub">${FS.showUnconfirmed?`Showing ${nUnc} listing${nUnc===1?'':'s'} that couldn't be confirmed live. Their links may not work.`:`${hidden} more couldn't be confirmed live, so they're hidden.`} <button class="linkbtn" type="button" id="fShowUnc">${FS.showUnconfirmed?'Hide them':'Show them anyway'}</button></div>`:'';
  const th=(k,lab,cls='')=>{const on=so&&so.k===k;return `<th class="${cls}" aria-sort="${on?(so.dir>0?'ascending':'descending'):'none'}"><button class="sort" data-sort="${k}">${lab}<span class="sa" aria-hidden="true">${on?(so.dir>0?'↑':'↓'):''}</span></button></th>`};
  const toggle=`<div class="seg segb" role="group" aria-label="Results view"><button id="fViewMap" aria-pressed="${view==='map'}">Photos + map</button><button id="fViewCards" aria-pressed="${view==='cards'}">Cards</button><button id="fViewSheet" aria-pressed="${view==='sheet'}">Sheet</button></div>`;
  const acts=view==='map'
    ?(m?`<button class="btn sm primary" id="fCopyCards"${nOpen?'':' disabled'}>${cardsLabel(nOpen)}</button><button class="btn sm" id="fShareLink"${nOpen?'':' disabled'} title="Make a web page of these deal cards and get a link to send on WhatsApp">Share as link</button>${packBtn(nOpen)}<label class="cardlinks" title="Untick for a pre-NDA version: no listing links or street names"><input type="checkbox" id="fCardLinks"${S.find.cardLinks===false?'':' checked'}${nOpen?'':' disabled'}> Include links</label><label class="sortl"><span class="sr">Sort deals</span><select class="inp inp-sm" id="fSortSel">${CARD_SORTS.some(x=>x[0]===sv)?'':`<option value="${sv}" selected>Sheet order</option>`}${CARD_SORTS.map(([v,t])=>`<option value="${v}"${v===sv?' selected':''}>${t}</option>`).join('')}</select></label>`:'')
    :view==='cards'
    ?(m?`<button class="btn sm primary" id="fCopyCards"${nOpen?'':' disabled'}>${cardsLabel(nOpen)}</button><button class="btn sm" id="fShareLink"${nOpen?'':' disabled'} title="Make a web page of these deal cards and get a link to send on WhatsApp">Share as link</button>${packBtn(nOpen)}<label class="cardlinks" title="Untick for a pre-NDA version: no listing links or street names"><input type="checkbox" id="fCardLinks"${S.find.cardLinks===false?'':' checked'}${nOpen?'':' disabled'}> Include links</label><label class="sortl"><span class="sr">Sort deals</span><select class="inp inp-sm" id="fSortSel">${CARD_SORTS.some(x=>x[0]===sv)?'':`<option value="${sv}" selected>Sheet order</option>`}${CARD_SORTS.map(([v,t])=>`<option value="${v}"${v===sv?' selected':''}>${t}</option>`).join('')}</select></label>
      <button class="btn sm car-arrow" id="fPrev" aria-label="Previous deals">${CHEV(-1)}</button><button class="btn sm car-arrow" id="fNext" aria-label="Next deals">${CHEV(1)}</button>`:'')
    :`<button class="btn sm primary" id="fBuildSel" disabled>Analyse selected</button><button class="btn sm" id="fCopyCards"${nOpen?'':' disabled'}>${cardsLabel(nOpen)}</button><button class="btn sm" id="fShareLink"${nOpen?'':' disabled'} title="Make a web page of these deal cards and get a link to send on WhatsApp">Share as link</button>${packBtn(nOpen)}<label class="cardlinks" title="Untick for a pre-NDA version: no listing links or street names"><input type="checkbox" id="fCardLinks"${S.find.cardLinks===false?'':' checked'}${nOpen?'':' disabled'}> Include links</label><button class="btn sm" id="fCopy"${nOpen?'':' disabled'}>Copy ${nOpen} to Google Sheets</button>`;
  const L=`<span class="lockc">${LOCK}Locked</span>`;
  let body;
  if(!m)body=`<div class="fempty"><h2>${hidden?'No listings confirmed live':'No listings match these filters'}</h2><p>${hidden?'Every listing found either had a dead link or its site blocked the check. Try Analyst or Expert, which open more listings to confirm them, or show the unconfirmed ones.':'Try a wider price range, a different location or more sites.'}</p></div>`;
  else if(view==='map'){const nPin=rows.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng)).length,nAp=rows.filter(r=>Number.isFinite(r.lat)&&r.geo!=='exact').length;
    body=`<div class="pmap"><div class="pgrid" id="fPhotos" role="list" aria-label="Listings with photos">${rows.map((r,i)=>photoCard(r,i)).join('')}</div>
      <div class="pm-side"><div class="pm-map" id="fMap" role="region" aria-label="Map of the listings">${nPin?'':`<div class="pm-msg">${S.find.liveAt&&!rows.some(r=>'lat' in r)?'Run Refresh &amp; find new to put these listings on the map.':'These listings have no location to show on the map.'}</div>`}</div>
      ${nPin?`<div class="pm-note">${nPin} of ${m} on the map${nAp?` · <i class="ap" aria-hidden="true"></i>${nAp} placed by postcode area`:''}</div>`:''}</div></div>`}
  else if(view==='cards')body=`<div class="cards" id="fCards" tabindex="0" role="region" aria-label="Deal cards, scroll sideways">${rows.map((r,i)=>dealCard(r,i)).join('')}</div>`;
  else body=`<div id="fTsvWrap" hidden><label class="f"><span>Deals as tab-separated rows. Copy them, then paste into cell A1 of a Google Sheet.</span><textarea class="inp mono" id="fTsv" readonly></textarea></label></div>
    <div class="sheet" tabindex="0" role="region" aria-label="Search results"><table><thead><tr><th class="rn"><span class="sr">Row</span></th><th class="ck"><input type="checkbox" id="fSelAll" aria-label="Select all rows"${nOpen?'':' disabled'}></th>
      ${SC.size?th('ai','Score','nr'):''}${th('site','Site')}${th('title','Listing')}${th('type','Type')}${th('beds','Beds','nr')}${th('area','Area')}${th('postcode','Postcode')}${th('price',S.find.f.mode==='buy'?'Price':'Rent pcm','nr')}<th class="nr" title="The main figure for your strategy (estimate)">${esc(keyHead)}</th><th>Furnished</th>${th('listedTs','Listed')}<th>Checked</th><th>Link</th><th>Action</th></tr></thead>
      <tbody>${rows.map((r,i)=>{const o=isOpen(r);return `<tr data-k="${r.k}"><td class="rn">${i+1}</td><td class="ck">${o?`<input type="checkbox" id="fsel${r.k}" data-sel="${r.k}" aria-label="Select ${esc(r.type)}, ${esc(r.area)}"${FS.sel.has(r.k)?' checked':''}>`:''}</td>
        ${SC.size?`<td class="nr">${r.ai>=0?`<span class="ai-sc ${r.ai>=75?'hi':r.ai>=55?'mid':'lo'}" title="${esc(r.aiv)}">${r.ai}</span>`:'<span class="muted">–</span>'}</td>`:''}<td>${esc(SITE_LABEL(r.site))}</td><td class="clip" title="${esc(r.title||'')}">${esc(r.title||'')}</td><td>${esc(r.type)}</td><td class="nr" style="font-variant-numeric:tabular-nums">${bedsTxt(r.beds)}</td><td class="clip wide"${o?` title="${esc(r.area)}"`:''}>${o?esc(r.area):L}</td><td class="mono">${esc(r.postcode)}</td><td class="nr mono">${gbp(r.price)}</td>${(()=>{const k=stratFigures(r).key;return `<td class="nr mono${k[2]?' neg':''}" title="${esc(k[0])} (estimate)">${esc(k[1])}</td>`})()}<td class="muted">${esc(r.furnished)}</td><td class="fr-cell"><span class="muted">${ageTxt(ageDays(r))||'–'}</span>${freshTags(r)}</td><td>${liveTag(r)}</td>
        <td>${o?`<a class="xlink" href="${esc(r.url)}" target="_blank" rel="noopener">Open ↗</a>${r.pack?` <a class="xlink" href="/pack/${esc(r.pack.id)}" target="_blank" rel="noopener">Pack ↗</a>`:''}`:L}</td><td>${o?`<button class="btn xs" data-build="${r.k}">Analyse deal</button>`:`<button class="btn xs" data-unlock="${r.k}" data-n="${i+1}">Unlock · ${gbp(dealFee())}</button>`}</td></tr>`}).join('')}</tbody></table></div>`;
  const ageH=S.find.liveAt?(Date.now()-Date.parse(S.find.liveAt))/36e5:0,stale=ageH>=24,nNew=rows.filter(isFreshNew).length;
  const fresh=`<div class="fresh-bar${stale?' stale':''}"><span>${stale?`These results are from ${ageH<48?'yesterday':Math.round(ageH/24)+' days ago'}. Some listings may have gone.`:`Searched ${ageH<1?'just now':Math.round(ageH)+'h ago'}.`}${nNew?` <b>${nNew} new</b> in the last 3 days.`:''}</span><button class="btn sm ghost" type="button" id="fEditSearch" title="Change the criteria for this search">Edit search</button><button class="btn sm${stale?' primary':''}" type="button" id="fRefresh" title="Re-check every listing, remove ones that have gone, and look for new ones">Refresh &amp; find new</button></div>`;
  box.innerHTML=rankHTML()+fresh+`<div class="ftool"><div><div class="fsum" id="fSummary">${sum}</div>${unc}${view==='sheet'?'<div class="fsub">Copy, then paste into cell A1 of a Google Sheet.</div>':''}</div>
    <div class="ph-actions">${acts}${toggle}</div></div>${body}`;
  const c=$('#fCards');if(c){c.style.scrollBehavior='auto';c.scrollLeft=prevScroll;c.style.scrollBehavior='';
    const upd=()=>{const p=$('#fPrev'),n=$('#fNext');if(p)p.disabled=c.scrollLeft<=2;if(n)n.disabled=c.scrollLeft+c.clientWidth>=c.scrollWidth-2};c.addEventListener('scroll',upd,{passive:true});upd()}
  if(view==='map'&&m)drawMap(rows);else if(LMAP){LMAP.remove();LMAP=null}
  FS.justOpened=null;syncSel()}
function syncSel(){const n=FS.sel.size,b=$('#fBuildSel');if(b){b.disabled=!n;b.textContent=n?`Analyse selected (${n})`:'Analyse selected'}
  const cc=$('#fCopyCards');if(cc)cc.textContent=cardsLabel((FS.lastRows||[]).filter(isOpen).length);syncPackBtn();
  $$('#fResults tr[data-k]').forEach(tr=>tr.classList.toggle('is-sel',FS.sel.has(+tr.dataset.k)));
  const all=$('#fSelAll');if(all){const cb=$$('#fResults [data-sel]');all.checked=cb.length>0&&cb.every(c=>c.checked);all.indeterminate=!all.checked&&cb.some(c=>c.checked)}}
function syncFee(){$$('.js-fee').forEach(e=>e.textContent=gbp(dealFee()))}
function onFind(){readFind();save();renderFind();$$('#fLevelOpts .lv-time').forEach(e=>{e.textContent='Takes ~'+estTxt('search',e.dataset.lv,findSiteCount())})}
$('#fStrats').addEventListener('change',e=>{const c=e.target;if(c.name!=='fStrat')return;const solo=['auto','none'],all=$$('input[name="fStrat"]');
  if(c.checked&&solo.includes(c.value))all.forEach(x=>{if(x!==c)x.checked=false});else if(c.checked)all.forEach(x=>{if(solo.includes(x.value))x.checked=false});
  if(!all.some(x=>x.checked))all.find(x=>x.value==='auto').checked=true},true);
$('#fPanel').addEventListener('input',onFind);$('#fPanel').addEventListener('change',onFind);
$('#fReset').addEventListener('click',()=>{S.find.f=FIND_DEF();bindFind();save();renderFind()});
$('#fNotesFill').addEventListener('click',()=>{const text=$('#fNotes').value.trim(),msg=$('#fNotesMsg');if(!text){msg.textContent='Type what you’re looking for first.';$('#fNotes').focus();return}
  const {f,got}=parseCriteria(text);readFind();
  // No price in the text: drop the starting £1,200–£5,000 range so it doesn't hide matches.
  const d=FIND_DEF();if(f.min==null&&f.max==null&&+S.find.f.min===d.min&&+S.find.f.max===d.max){f.min='';f.max=''}
  Object.assign(S.find.f,f);bindFind();save();renderFind();
  msg.textContent=got.length?`Filled in: ${got.join(' · ')}. Check the filters, then search.`:'No filters to fill in. It will still search with what you wrote.'});
const FIND_MSG=m=>{const n=$('#nFind');n.classList.remove('share-note');n.innerHTML=`<div>${esc(m)}</div><div class="ln-a"><button class="btn sm primary" data-go="plans">Upgrade</button><button class="btn sm" data-ln-close>Dismiss</button></div>`;n.hidden=false};
// Checks on an AI job every 2 seconds. A dropped connection, a busy server or a sign-in being renewed
// is retried for up to 3 minutes (the job carries on in the background), and the result is confirmed
// once received so the server can delete it.
const netMsg=e=>e instanceof TypeError||/failed to fetch|load failed|network/i.test(String(e&&e.message))?"Couldn't reach Deal Pro. Check your internet connection and try again.":e&&e.message;
async function pollJob(jobId,onTick,onProgress,maxMs=17*60e3){const t0=Date.now(),url='/api/analyze-deal?job='+encodeURIComponent(jobId);let fails=0,failSince=0;
  for(;;){await sleep(fails?Math.min(8000,2000*2**fails):2000);
    let p=null,d={};try{p=await fetch(url,{credentials:'same-origin'});d=await p.json().catch(()=>({}))}catch(e){p=null}
    if(!p||p.status>=500||p.status===429||p.status===401||(p.ok&&!d.status)){fails++;failSince=failSince||Date.now();
      if(Date.now()-failSince>3*60e3)throw Object.assign(new Error(!p?"Lost connection to Deal Pro for 3 minutes. Check your internet connection, then press Reconnect. The search carries on in the background.":p.status===401?'Your sign-in needs renewing. Sign in again, then press Reconnect. The search carries on in the background.':`Deal Pro's server isn't responding (error ${p.status}). Press Reconnect in a minute. The search carries on in the background.`),{resume:true});
      if(onTick)onTick(Math.round((Date.now()-t0)/1000));continue}
    fails=0;failSince=0;
    if(!p.ok)throw new Error(p.status===404?'This search has already finished or expired, so its results are no longer available. Please run it again.':d.error||'It could not finish. Please try again.');
    if(d.credits){AIC.info=d.credits;renderAILevels()}
    if(d.progress&&onProgress)onProgress(d.progress);
    if(d.status==='done'||d.status==='error')fetch(url,{method:'DELETE',credentials:'same-origin'}).catch(()=>{});
    if(d.status==='done')return d.analysis;if(d.status==='error')throw Object.assign(new Error((d.error||'It could not finish. Please try again.')+(d.detail?` (Admin detail: ${d.detail})`:'')),{retry:!!d.retryable});
    if(onTick)onTick(Math.round((Date.now()-t0)/1000));if(Date.now()-t0>maxMs)throw new Error('This is taking too long. Please try again.')}}
/* A search that fails because of a service problem (an outage, a block, a rate limit) is tried again by itself:
   its credits were already given back, so waiting and re-running is safe. Up to 3 more tries, a little longer each time. */
const AUTO_TRIES=3,autoWait=n=>window.DP_AUTO_WAIT||[20,45,90][n]||90;
function stopAuto(){if(FS.autoT){clearInterval(FS.autoT);FS.autoT=null}}
function autoRetry(why){stopAuto();const n=$('#fErr');let left=autoWait(FS.auto);FS.auto++;FS.err={msg:why,at:new Date().toISOString(),resume:false};if(!n){return}
  const draw=()=>{n.innerHTML=`<div><b>The service is busy</b></div><div>Trying your search again automatically in ${left}s (attempt ${FS.auto+1} of ${AUTO_TRIES+1}). Your credits haven't been used.</div><div class="ln-a"><button class="btn sm primary" type="button" data-ferr="retry">Try now</button><button class="btn sm" type="button" data-ferr="copy">Copy error details</button><button class="btn sm ghost" type="button" data-ferr="close">Stop</button></div>`;n.hidden=false};
  draw();n.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});FS.autoT=setInterval(()=>{left--;if(left<=0){stopAuto();clearFindError();startSearch(FS.lastRefresh,true)}else draw()},1000)}
// Deal Finder errors stay on screen until dismissed, with details to copy and send to support.
function findError(msg,resume){const at=new Date(),n=$('#fErr');FS.err={msg,at:at.toISOString(),resume:!!resume};if(!n)return;
  n.innerHTML=`<div><b>${resume?'The search lost touch with Deal Pro':'The search hit a problem'}</b> <span class="muted">${at.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span></div><div>${esc(msg)}</div>
    <div class="ln-a">${resume?'<button class="btn sm primary" type="button" data-ferr="resume">Reconnect</button>':'<button class="btn sm primary" type="button" data-ferr="retry">Try again</button>'}<button class="btn sm" type="button" data-ferr="copy">Copy error details</button><button class="btn sm ghost" type="button" data-ferr="close">Dismiss</button></div>`;
  n.hidden=false;n.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'})}
function clearFindError(){stopAuto();FS.err=null;const n=$('#fErr');if(n){n.hidden=true;n.innerHTML=''}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ferr]');if(!b)return;const E=FS.err||{},a=b.dataset.ferr;
  if(a==='close')clearFindError();
  else if(a==='retry'){clearFindError();startSearch(false)}
  else if(a==='resume'){clearFindError();if(S.find.pending&&!FS.busy)followSearch(S.find.pending)}
  else{const f=S.find.f||{},t=['Deal Pro search error',`Time: ${E.at}`,`Message: ${E.msg}`,`Page: ${location.href}`,`Power level: ${AIC.level}`,`Mode: ${f.mode} · Strategy: ${f.strategy||'auto'} · Location: ${f.loc||'-'} · Price: ${f.min||0}-${f.max||'any'}`,`Sites: ${SITES.filter(s=>(f.sites||{})[s]).join(', ')}`,`Browser: ${navigator.userAgent}`].join('\n');
    const ok=()=>toast('Error details copied. Paste them in a message to support.');
    try{navigator.clipboard.writeText(t).then(ok).catch(()=>{prompt('Copy these error details:',t)})}catch(x){prompt('Copy these error details:',t)}}});
function drawSearch(sites,lv,prog,sec){const P=(prog&&prog.sites)||{},phase=prog&&prog.phase||'search',box=$('#fResults');
  const done=sites.filter(s=>P[s]&&P[s].status!=='searching').length;
  const head=phase==='check'?`Opening every link to make sure each listing exists… ${prog.checked||0} of ${prog.found||0}`:phase==='verify'?`Confirming listings are still available… ${prog.verified||0} opened${prog.removed?` · ${prog.removed} dead link${prog.removed===1?'':'s'} removed`:''}`:phase==='rank'||phase==='done'?'Ranking the best deals…':`${esc(lv.name)} is searching ${sites.length} site${sites.length>1?'s':''} for live listings…`;
  box.innerHTML=`<div class="fprog" role="status" aria-live="polite"><div class="fprog-t">${head}${sec?` <span class="muted">${sec<120?sec+'s':Math.round(sec/60)+' min'}</span>`:''}</div>
    <div class="meter"><span style="width:${phase==='search'?Math.round(done/sites.length*100):100}%"></span></div>
    <ol>${sites.map(s=>{const st=P[s]||{status:'searching',found:0};const rounds=st.rounds>1?` · round ${Math.min(st.round+(st.status==='searching'?1:0),st.rounds)} of ${st.rounds}`:'';
      return `<li class="${st.status==='searching'?'act':'done'}"><span class="dot ${st.status==='done'?'good':st.status==='error'?'bad':'none'}"></span>${SITE_LABEL(s)}<span class="mono muted">${st.status==='error'?'unavailable':`${st.found||0} found${rounds}`}</span></li>`}).join('')}</ol>
    ${prog&&prog.found?`<p class="fnote">${prog.found} unique listings so far.</p>`:''}<p class="fnote"><b>${leftTxt(estSecs('search',lv.id,sites.length),sec||0,searchFrac(sites,prog,lv))}</b> · usually takes ${estTxt('search',lv.id,sites.length)}.${lv.id==='deep'?' Expert searches every site round after round, then opens the best listings to check they are still available. You can leave this page and come back.':''}</p>
    <div class="fprog-acts"><button class="btn sm" type="button" id="fCancel">Cancel search</button><button class="btn sm ghost" type="button" id="fEditRun">Edit search</button></div></div>`}
// Share of the search done: the rounds across all sites, then (Expert) the listing checks, then ranking.
const VERIFY_N={quick:10,standard:25,deep:60};/* listings each level opens to check; matches SEARCH_LEVEL in netlify/lib/ai.mts */
function searchFrac(sites,prog,lv){if(!prog)return 0;const P=prog.sites||{},sw=.7;
  if(prog.phase==='rank'||prog.phase==='done')return .95;if(prog.phase==='check')return sw+.1*Math.min(1,(prog.checked||0)/Math.max(1,prog.found||1));
  if(prog.phase==='verify')return sw+.1+.15*Math.min(1,(prog.verified||0)/(VERIFY_N[lv.id]||20));
  const r=sites.reduce((a,s)=>{const x=P[s];return a+(!x?0:x.status!=='searching'?1:(x.round||0)/(x.rounds||1))},0)/Math.max(1,sites.length);return sw*r}
async function followSearch(p){const lv=AI_LEVELS.find(l=>l.id===p.level)||AI_LEVELS[0],btn=$('#fSearch');
  clearFindError();FS.busy=true;btn.disabled=true;let last=null,keep=false;const t0=Date.parse(p.at)||Date.now(),secs=()=>Math.round((Date.now()-t0)/1000);drawSearch(p.sites,lv,null,secs());
  const gone=()=>FS.cancelled===p.id;const stop=()=>{if(gone())throw Object.assign(new Error('cancelled'),{cancelled:true})};
  try{const res=await pollJob(p.id,()=>{stop();drawSearch(p.sites,lv,last,secs())},pr=>{stop();last=pr;drawSearch(p.sites,lv,pr,secs())},100*60e3);if(gone())return;
    LIVE=(res.listings||[]).slice(0,500);/* the server only returns single-listing links */
    // After a refresh, mark listings that weren't in the previous results as new.
    if(p.prev){const prev=new Set(p.prev),now=new Date().toISOString();LIVE.forEach(x=>{if(!prev.has(x.url))x.newAt=now;else if(p.prevNew&&p.prevNew[x.url])x.newAt=p.prevNew[x.url]})}S.find.live=LIVE;S.find.liveAt=new Date().toISOString();S.find.liveSites=res.sites||{};S.find.searched=true;FS.sel.clear();
    FS.rank=res.ranking?{status:'done',level:lv,data:res.ranking}:null;S.find.rank=res.ranking?{level:lv.id,data:res.ranking}:null;S.find.removed=res.removed||0;
    const missed=Object.entries(res.sites||{}).filter(([,v])=>v.status==='error').map(([k])=>SITE_LABEL(k));
    const live=LIVE.filter(confirmedLive).length;FS.showUnconfirmed=false;
    const rf=res.refreshed;if(!LIVE.length){toast(`No listings found${S.find.f.loc?` in ${S.find.f.loc}`:''}, even after searching nearby areas. Try a wider price range, more sites or Analyst.`);return}
    saveFindHistory(lv,p.sites.length);
    toast(rf?`Refreshed: ${rf.gone} listing${rf.gone===1?' has':'s have'} gone and ${rf.gone===1?'was':'were'} removed, ${rf.added} new one${rf.added===1?'':'s'} found. ${live} live now.${missed.length?` Couldn't reach: ${missed.join(', ')}.`:''}`
      :`${live} live listing${live===1?'':'s'} across ${p.sites.length} site${p.sites.length>1?'s':''}, every link checked.${res.removed?` Removed ${res.removed} dead or taken link${res.removed===1?'':'s'}.`:''}${missed.length?` Couldn't reach: ${missed.join(', ')}.`:''}`)}
  catch(e){if(e.cancelled||gone())return;keep=!!e.resume;if(e.retry&&!keep&&FS.auto<AUTO_TRIES)autoRetry(netMsg(e)||e.message);else findError(netMsg(e)||'The search failed. Please try again.',keep)}
  finally{if(!gone()){if(!keep)delete S.find.pending;save();FS.busy=false;btn.disabled=false;renderFind()}}}
// Cancel the running search (credits refunded); "Edit" also takes you back to the criteria to change them.
async function cancelSearch(edit){const p=S.find.pending;if(!p)return;FS.cancelled=p.id;delete S.find.pending;save();FS.busy=false;$('#fSearch').disabled=false;renderFind();
  try{const r=await fetch('/api/analyze-deal?job='+encodeURIComponent(p.id),{method:'DELETE',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(d.credits){AIC.info=d.credits;renderAILevels()}}catch(e){}
  toast(edit?'Search cancelled. Change your criteria, then search again. Your credits weren’t used.':'Search cancelled. Your credits weren’t used.');if(edit)editSearch()}
function editSearch(){const panel=$('#fPanel');if(!panel)return;panel.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});setTimeout(()=>{const n=$('#fNotes');if(n)n.focus({preventScroll:true})},350)}
document.addEventListener('click',e=>{if(e.target.closest('#fCancel'))cancelSearch(false);else if(e.target.closest('#fEditRun'))cancelSearch(true);else if(e.target.closest('#fEditSearch'))editSearch()});
// refresh: re-check the current results, drop the ones that have gone, and look for new listings
const RENT_ONLY_SITES=['OpenRent','SpareRoom'];
async function startSearch(refresh=false,auto=false){if(FS.busy)return;if(!auto)FS.auto=0;FS.lastRefresh=refresh;readFind();let sites=SITES.filter(s=>S.find.f.sites[s]);
  // OpenRent and SpareRoom only list homes to rent, so they're left out of a search for property to buy.
  if(S.find.f.mode==='buy'&&sites.some(s=>!RENT_ONLY_SITES.includes(s))){const skip=sites.filter(s=>RENT_ONLY_SITES.includes(s));sites=sites.filter(s=>!RENT_ONLY_SITES.includes(s));if(skip.length)toast(`${skip.map(SITE_LABEL).join(' and ')} only list rentals, so they're left out of this purchase search.`)}
  if(!sites.length){toast('Tick at least one site to search');return}
  const lv=AI_LEVELS.find(l=>l.id===AIC.level)||AI_LEVELS[0],btn=$('#fSearch');
  const existing=refresh&&LIVE?LIVE.map(r=>({site:r.site,url:r.url,title:r.title,type:r.type,beds:r.beds,area:r.area,postcode:r.postcode,price:r.price,mode:r.mode,private:r.private,furnished:r.furnished,found:r.found,listedAt:r.listedAt})):[];
  FS.busy=true;btn.disabled=true;$('#nFind').hidden=true;clearFindError();drawSearch(sites,lv,null,0);
  try{const r=await fetch('/api/analyze-deal',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'search',level:lv.id,filters:S.find.f,sites,...(refresh?{existing}:{})})});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.error||'The search could not be started.'),{limit:r.status===402});
    if(d.credits){AIC.info=d.credits;renderAILevels()}
    // Remember the running search so it can be picked up again after leaving the page.
    S.find.pending={id:d.jobId,level:lv.id,sites,at:new Date().toISOString(),...(refresh?{prev:existing.map(x=>x.url),prevNew:Object.fromEntries((LIVE||[]).filter(x=>x.newAt).map(x=>[x.url,x.newAt]))}:{})};save();
    FS.busy=false;followSearch(S.find.pending)}
  catch(e){FS.busy=false;btn.disabled=false;if(e.limit)FIND_MSG(e.message);else findError(netMsg(e)||'The search could not be started. Please try again.');renderFind()}}
$('#fSearch').addEventListener('click',()=>startSearch(false));
document.addEventListener('click',e=>{if(e.target.closest('#fRefresh'))startSearch(true)});
window.addEventListener('dealpro:signed-in',()=>{if(S.find.pending&&!FS.busy)followSearch(S.find.pending)});
// The AI matches picks by listing id; if it mentions one ("similar to id 4"), show the listing's name instead.
const rankText=v=>String(v??'').replace(/\b(?:listing\s+)?ids?\s*[:#]?\s*(\d+)\b/gi,(m,n)=>{const r=SRC()[+n];return r?`the ${r.type.toLowerCase()} on ${(r.area||r.title||'').split(',')[0].replace(/\s*\(.*\)$/,'')}`:m});
/* Scout is a good quick look; this shows what the deeper levels add */
const SCOUT_MORE={
  search:'Scout did one quick search per site, checked every link and picked the top 3. Analyst searches every site twice from different angles, confirms up to 25 listings the sites wouldn’t let us check directly, and ranks the top 10. Expert searches round after round and confirms up to 60.',
  analyse:'Scout gives a quick first look with a quick local check. Analyst checks the figures against fuller local evidence (comparable rents, nightly rates and prices) and works through every cost and risk. Expert also stress-tests the deal with a lower nightly rate, lower occupancy, higher costs and an empty month.',
  dd:'Scout gives one quick fact per check. Analyst researches each check properly with more sources, and Expert researches every check separately in depth.'};
function scoutMore(kind){let free=true;try{free=!AIC.info||AIC.info.free||AIC.info.scoutOnly}catch(e){}/* AIC is set up later in the script */
  return `<div class="scout-more"><p><b>Want more?</b> ${SCOUT_MORE[kind]}</p>${free?'<button class="btn sm primary" type="button" data-go="plans">Upgrade for Analyst and Expert</button>':'<span class="muted">Choose Analyst or Expert and run it again.</span>'}</div>`}
// The AI's scores for every confirmed listing, by row index.
function aiScores(){const a=FS.rank&&FS.rank.status==='done'?FS.rank.data||{}:{},m=new Map(),v=x=>Math.max(0,Math.min(100,Math.round(+x.score||0)));
  (Array.isArray(a.scores)?a.scores:[]).forEach(x=>{if(x&&SRC()[+x.id])m.set(+x.id,{score:v(x),verdict:String(x.verdict||'')})});
  (Array.isArray(a.picks)?a.picks:[]).forEach(x=>{if(x&&SRC()[+x.id]&&!m.has(+x.id))m.set(+x.id,{score:v(x),verdict:String(x.verdict||'')})});return m}
// Restore a saved ranking when results are reopened.
function restoreRank(){if(FS.rank||!LIVE||!S.find.rank||!S.find.rank.data)return;try{FS.rank={status:'done',level:AI_LEVELS.find(l=>l.id===S.find.rank.level)||AI_LEVELS[0],data:S.find.rank.data}}catch(e){}}
async function rankNow(){const conf=SRC().map((r,i)=>({r,i})).filter(x=>confirmedLive(x.r));if(!conf.length){toast('There are no confirmed listings to rank.');return}
  // Confirmed listings come first in the results, so their positions double as ids.
  const lv=AI_LEVELS.find(l=>l.id===AIC.level)||AI_LEVELS[0];FS.rank={status:'loading',level:lv};renderFind();
  try{const r=await fetch('/api/analyze-deal',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'rank',level:lv.id,filters:S.find.f,
      listings:conf.slice(0,80).map(({r,i})=>({id:String(i),site:SITE_LABEL(r.site),type:r.type,beds:r.beds,area:r.area,postcode:r.postcode,[r.mode==='buy'?'asking_price':'rent_pcm']:r.price,...(r.details?{checked_details:r.details}:{})}))})});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'The ranking could not be started.');if(d.credits){AIC.info=d.credits;renderAILevels()}
    const data=await pollJob(d.jobId);FS.rank={status:'done',level:lv,data};S.find.rank={level:lv.id,data};save()}
  catch(e){FS.rank={status:'error',level:lv,error:e.message||'The ranking could not be completed.'}}renderFind()}
document.addEventListener('click',e=>{if(e.target.closest('#fRankNow'))rankNow()});
// Untick "Include links" for pre-NDA cards: no listing links or street names.
document.addEventListener('change',e=>{if(e.target.id==='fCardLinks'){S.find.cardLinks=e.target.checked;save();toast(e.target.checked?'Copied cards will include listing links and full areas.':'Pre-NDA: copied cards will leave out links and street names.')}});
function rankHTML(){restoreRank();const R=FS.rank;
  if(!R){const n=SRC().filter(confirmedLive).length;return n?`<div class="rank"><div class="rank-h"><b>These results haven't been ranked yet</b></div><p class="muted">Rank the ${n} confirmed listing${n===1?'':'s'} and get an explanation of what the search found.</p><button class="btn sm primary" type="button" id="fRankNow">Rank results</button></div>`:''}
  const lv=R.level;
  if(R.status==='loading')return `<div class="rank lv-${lv.id}" role="status"><div class="rank-h"><i class="lv-dot" aria-hidden="true"></i><b id="fRankT">${esc(lv.name)} is ranking these deals…</b></div><p class="muted">Results are below. Scores, top picks and a summary of what was found will appear here.</p></div>`;
  if(R.status==='error')return `<div class="rank lv-${lv.id}"><div class="rank-h"><i class="lv-dot" aria-hidden="true"></i><b>Ranking unavailable</b></div><p class="muted">${esc(R.error)}</p><button class="btn sm" type="button" id="fRankNow">Try again</button></div>`;
  const a=R.data||{},picks=(Array.isArray(a.picks)?a.picks:[]).filter(p=>SRC()[+p.id]);
  const li=p=>{const r=SRC()[+p.id];const notes=Array.isArray(p.notes)&&p.notes.length?`<ul class="rank-notes">${p.notes.map(n=>`<li>${esc(rankText(n))}</li>`).join('')}</ul>`:'';
    return `<li><div class="rank-top"><b>${esc(r.type)} · ${esc(r.area)}</b><span class="mono">${gbp(r.price)}${r.mode==='buy'?'':' pcm'}</span><span class="muted">${esc(SITE_LABEL(r.site))}</span><span class="rank-score">${Math.max(0,Math.min(100,+p.score||0))}/100 · ${esc(String(p.verdict||''))}</span></div>
      <p>${esc(rankText(p.reason))}${p.key_figure?` <span class="muted">${esc(String(p.key_figure))}</span>`:p.monthly_profit_80?` <span class="muted">Est. at 80%: ${esc(String(p.monthly_profit_80))}</span>`:''}</p>${notes}
      <div class="rank-act"><button class="btn xs primary" data-build="${+p.id}">Analyse deal</button><a class="btn xs" href="${esc(r.url)}" target="_blank" rel="noopener">Open listing ↗</a></div></li>`};
  const hl=Array.isArray(a.highlights)?a.highlights.filter(Boolean).slice(0,6):[];
  const conf=SRC().filter(confirmedLive).length,unc=SRC().length-conf,rem=S.find.removed||0;
  return `<div class="rank lv-${lv.id}"><div class="rank-h"><i class="lv-dot" aria-hidden="true"></i><b>What ${esc(lv.name)} found</b></div>
    <p class="rank-stats">${conf} confirmed live listing${conf===1?'':'s'}${rem?` · ${rem} dead or taken link${rem===1?'':'s'} removed`:''}${unc?` · ${unc} couldn't be confirmed`:''} · every listing below is scored and sorted, best first</p>
    ${a.explanation?`<p class="rank-exp">${esc(rankText(a.explanation))}</p>`:a.summary?`<p class="rank-exp">${esc(rankText(a.summary))}</p>`:''}
    ${hl.length?`<ul class="rank-hl">${hl.map(h=>`<li>${esc(rankText(h))}</li>`).join('')}</ul>`:''}
    ${picks.length?`<h3 class="rank-sub">Top picks</h3>${a.explanation&&a.summary?`<p>${esc(rankText(a.summary))}</p>`:''}<ol class="rank-list">${picks.map(li).join('')}</ol>`:''}
    ${Array.isArray(a.watch_outs)&&a.watch_outs.length?`<p class="muted">Watch out: ${a.watch_outs.map(w=>esc(rankText(w))).join(' · ')}</p>`:''}${lv.id==='quick'?scoutMore('search'):''}</div>`}
function openRows(){return sortRows(findRows()).filter(isOpen)}
function findTsv(){const c=v=>{const s=String(v??'').replace(/[\t\r\n]+/g,' ');return /^[=+\-@]/.test(s)?"'"+s:s};
  return [['Site','Listing','Type','Beds','Area','Postcode',S.find.f.mode==='buy'?'Price':'Rent pcm','Furnished','Checked','URL'],
    ...openRows().map(r=>[SITE_LABEL(r.site),r.title||'',r.type,bedsTxt(r.beds),r.area,r.postcode,r.price,r.furnished,r.verified==='available'?'Live '+(r.checkedAt||'').slice(0,10):r.verified==='unknown'?"Couldn't confirm":'Not checked',r.url])].map(a=>a.map(c).join('\t')).join('\n')}
function copyTsv(){const n=openRows().length;if(!n){toast('No deals to copy.');return}const t=findTsv(),lab=`${n} deal${n>1?'s':''}`;
  const fb=()=>{const w=$('#fTsvWrap'),ta=$('#fTsv');if(!w)return;w.hidden=false;ta.value=t;ta.focus();ta.select();ta.scrollTop=0;ta.scrollLeft=0;toast(`Selected ${lab}. Press Ctrl/Cmd+C, then paste into cell A1 of a Google Sheet.`)};
  try{navigator.clipboard.writeText(t).then(()=>toast(`Copied ${lab}. Paste into cell A1 of a Google Sheet.`)).catch(fb)}catch(e){fb()}}
/* copy deal cards to send to a client: WhatsApp-ready text, plus formatted cards for email */
const cardsLabel=n=>FS.sel.size?`Copy ${FS.sel.size} selected card${FS.sel.size===1?'':'s'}`:`Copy all ${n} deal card${n===1?'':'s'}`;
function cardRows(){const shown=(FS.lastRows||sortRows(findRows())).filter(isOpen);return FS.sel.size?shown.filter(r=>FS.sel.has(r.k)):shown}
const preNDA=()=>S.find.cardLinks===false;
function cardFacts(r,i){const buy=r.mode==='buy',town=String(r.area||'').replace(/\s*\(.*?\)/g,'').split(',').pop().trim();
  const where=(preNDA()?[town,r.postcode]:[r.area,r.postcode]).filter(Boolean).join(' ').replace(/\s*\(.*?\)/g,'').trim();
  const SF=stratFigures(r);
  const live=r.verified==='available'&&r.checkedAt?new Date(r.checkedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'';
  return {head:`Deal ${i+1} · ${r.type}${buy?` · ${gbp(r.price)}`:` · ${gbp(r.price)}/month`}`,lines:[
    ['📍',where],['🛏',[r.type,r.furnished&&r.furnished!=='Not stated'?r.furnished:''].filter(Boolean).join(' · ')],['🎯',`Strategy: ${STRAT_NAME[SF.st]||SF.st}`],
    ...SF.lines,...extraKeys(r).map(([n,l,v])=>['🔁',`As ${n}: ${l} ${v} (est.)`]),
    ...(r.ai>=0?[['⭐',`Deal score ${r.ai}/100${r.aiv?' · '+r.aiv:''}`]]:[]),
    ...(ageDays(r)!=null?[['🆕',`Listed ${ageTxt(ageDays(r)).toLowerCase()}${r.hot?' · going fast':''}`]]:r.hot?[['🔥','Going fast']]:[]),
    ...(live?[['✅',`Listing checked live ${live}`]]:[]),...(r.pack?[['📊',`Analysed: ${r.pack.verdict||'see pack'}${r.pack.score!=null?` · ${r.pack.score}/100`:''}`],['📄',`Deal pack: ${location.origin}/pack/${r.pack.id}`]]:[]),...(preNDA()?[]:[['🔗',r.url]])]}}
function cardsTitle(n){const f=S.find.f,today=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  return {title:`${n} property deal${n===1?'':'s'}${f.loc?` · ${f.loc}`:''} · ${today}${preNDA()?' · Pre-NDA summary':''}`,
    foot:(preNDA()?'Pre-NDA summary: the full address and listing details are shared once an NDA is in place. ':'')+'Figures are rough estimates for the area and are not verified. Please check all details before committing.'}}
function copyCards(){const rows=cardRows();if(!rows.length){toast('No deals to copy.');return}
  const {title,foot}=cardsTitle(rows.length);
  const cards=rows.map(cardFacts);
  const text=[title,'',...cards.map(c=>[`*${c.head}*`,...c.lines.filter(l=>l[1]).map(([e,t])=>`${e} ${t}`)].join('\n')+'\n'),foot,'','Found with Deal Pro · usedealpro.com'].join('\n');
  const eh=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const html=`<div style="font-family:Arial,Helvetica,sans-serif;color:#15171a"><p style="font-size:16px;font-weight:bold;margin:0 0 12px">${eh(title)}</p>${cards.map(c=>`<div style="border:1px solid #d9dbe0;border-radius:8px;padding:12px 14px;margin:0 0 12px;max-width:560px"><p style="font-size:15px;font-weight:bold;margin:0 0 6px">${eh(c.head)}</p>${c.lines.filter(l=>l[1]).map(([e,t])=>`<p style="margin:2px 0;font-size:14px">${e} ${e==='🔗'?`<a href="${eh(t)}">${eh(t)}</a>`:eh(t)}</p>`).join('')}</div>`).join('')}<p style="font-size:12px;color:#5b606a">${eh(foot)}</p><p style="font-size:12px;color:#5b606a">Found with Deal Pro · usedealpro.com</p></div>`;
  const lab=`${rows.length} deal card${rows.length===1?'':'s'}`;
  const fb=()=>{const w=$('#fTsvWrap'),ta=$('#fTsv');if(!w){toast('Copying isn’t available in this browser.');return}w.hidden=false;ta.value=text;ta.focus();ta.select();ta.scrollTop=0;toast(`Selected ${lab}. Press Ctrl/Cmd+C to copy.`)};
  const done=()=>toast(`Copied ${lab}${preNDA()?' (pre-NDA, no links)':''}. Paste into WhatsApp, an email or a message.`);
  try{if(window.ClipboardItem&&navigator.clipboard.write){navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]).then(done).catch(()=>navigator.clipboard.writeText(text).then(done).catch(fb))}
    else navigator.clipboard.writeText(text).then(done).catch(fb)}catch(e){fb()}}
/* ---------- Photos + map view: listing photos (copied onto Deal Pro by /listing-photo) and a pin per listing ---------- */
const PHOTO=u=>'/listing-photo?u='+encodeURIComponent(u);
const rowPhotos=r=>(Array.isArray(r.photos)?r.photos:[]).filter(u=>/^https:\/\//.test(u));
// Short pin labels, never rounded up (£99,950 shows as £99.9k, not £100k).
const kPrice=r=>{const p=r.price;if(r.mode!=='buy')return gbp(p);const t=(v,d)=>String(Math.floor(v*10**d)/10**d);return p>=1e6?'£'+t(p/1e6,2)+'m':'£'+t(p/1e3,p<1e5?1:0)+'k'};
const NO_PHOTO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>';
function photoCard(r,i){const ph=rowPhotos(r),SF=stratFigures(r),k=SF.key,buy=r.mode==='buy';
  const place=[r.area,r.postcode].filter(Boolean).join(' · ');
  return `<article class="pcard" data-k="${r.k}" id="pc${r.k}" role="listitem" aria-label="Deal ${i+1}: ${esc(r.type)}, ${esc(gbp(r.price))}">
    <div class="pc-photo">${ph.length?`<img src="${esc(PHOTO(ph[0]))}" alt="${esc(r.type)} in ${esc(r.area||r.postcode)}, photo 1 of ${ph.length}" loading="${i<6?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer" data-i="0">`:''}
      <div class="pc-none"${ph.length?' hidden':''}>${NO_PHOTO}<span>Photos on the listing</span></div>
      <div class="pc-tags"><span class="pc-chip">${esc(SITE_LABEL(r.site))}</span>${SF.st&&SF.st!=='none'?`<span class="pc-chip">${esc(STRAT_NAME[SF.st]||SF.st)}</span>`:''}</div>
      ${r.ai>=0?`<span class="pc-score ${r.ai>=75?'hi':r.ai>=55?'mid':'lo'}" title="Deal score${r.aiv?' · '+esc(r.aiv):''}">${r.ai}</span>`:''}
      ${ph.length>1?`<button class="pc-arr l" type="button" data-ph-step="-1" aria-label="Previous photo">${CHEV(-1)}</button><button class="pc-arr r" type="button" data-ph-step="1" aria-label="Next photo">${CHEV(1)}</button><span class="pc-cnt" aria-hidden="true">1/${ph.length}</span>`:''}</div>
    <div class="pc-body"><div class="pc-price">${gbp(r.price)}${buy?'':' <small>pcm</small>'}</div>
      <h3 title="${esc(r.title||r.type)}">${esc(r.type)}${r.beds!=null&&!/\d\s*bed|studio/i.test(r.type||'')?` · ${bedWord(r.beds)}`:''}</h3>
      <p class="pc-meta" title="${esc(place)}">${esc(place)}</p>
      <p class="pc-key">${esc(k[0])} (est.) <b class="${k[2]?'neg':''}">${esc(k[1])}</b></p>${extraKeys(r).map(([n,l,v,neg])=>`<p class="pc-key">${esc(n)}: ${esc(l)} <b class="${neg?'neg':''}">${esc(v)}</b></p>`).join('')}
      <p class="pc-foot">${liveTag(r)}${ageDays(r)!=null?`<span>· listed ${ageTxt(ageDays(r)).toLowerCase()}</span>`:''}${freshTags(r)}</p>
      <div class="pc-act"><button class="btn sm primary" data-build="${r.k}">Analyse deal</button><a class="btn sm" href="${esc(r.url)}" target="_blank" rel="noopener">Listing ↗</a>${Number.isFinite(r.lat)?`<button class="btn sm ghost" type="button" data-pin="${r.k}" aria-label="Show deal ${i+1} on the map">Map</button>`:''}${r.pack?`<a class="btn sm" href="/pack/${esc(r.pack.id)}" target="_blank" rel="noopener">Pack ↗</a>`:''}</div></div>
  </article>`}
const rowByK=k=>(FS.lastRows||[]).find(r=>r.k===k);
function photoStep(k,d){const r=rowByK(k),ph=r?rowPhotos(r):[],c=$('#pc'+k),img=c&&c.querySelector('.pc-photo img');if(!img||ph.length<2)return;
  const i=((+img.dataset.i||0)+d+ph.length)%ph.length;img.dataset.i=i;img.hidden=false;c.querySelector('.pc-none').hidden=true;img.src=PHOTO(ph[i]);img.alt=img.alt.replace(/photo \d+ of/,`photo ${i+1} of`);
  const n=c.querySelector('.pc-cnt');if(n)n.textContent=`${i+1}/${ph.length}`}
// A photo the site no longer serves: try the next one, then show the placeholder.
document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement))return;
  if(img.closest('.pm-pop')){img.remove();return}
  const c=img.closest('.pcard');if(!c||!img.closest('.pc-photo'))return;const r=rowByK(+c.dataset.k),ph=r?rowPhotos(r):[];
  const tried=new Set((img.dataset.bad||'').split(',').filter(Boolean));tried.add(img.dataset.i);img.dataset.bad=[...tried].join(',');
  const next=ph.findIndex((u,j)=>!tried.has(String(j)));
  if(next>=0){img.dataset.i=next;img.src=PHOTO(ph[next]);const n=c.querySelector('.pc-cnt');if(n)n.textContent=`${next+1}/${ph.length}`}
  else{img.hidden=true;c.querySelector('.pc-none').hidden=false;c.querySelectorAll('.pc-arr,.pc-cnt').forEach(x=>x.hidden=true)}},true);
let LMAP=null;const LMK=new Map();
function loadLeaflet(){if(window.L&&window.L.map)return Promise.resolve();if(loadLeaflet.p)return loadLeaflet.p;
  return loadLeaflet.p=new Promise((ok,no)=>{const c=document.createElement('link');c.rel='stylesheet';c.href='/assets/vendor/leaflet/leaflet.css';document.head.appendChild(c);
    const s=document.createElement('script');s.src='/assets/vendor/leaflet/leaflet.js';s.onload=()=>ok();s.onerror=()=>{loadLeaflet.p=null;no(new Error('map'))};document.head.appendChild(s)})}
function pinPop(r){const ph=rowPhotos(r),d=document.createElement('div');
  d.innerHTML=`${ph.length?`<img src="${esc(PHOTO(ph[0]))}" alt="" referrerpolicy="no-referrer">`:''}<div class="pp"><b>${gbp(r.price)}${r.mode==='buy'?'':' pcm'}</b><span>${esc(r.type)} · ${esc([r.area,r.postcode].filter(Boolean).join(', '))}</span>${r.geo==='exact'?'':'<span>Position: centre of the postcode area</span>'}<a href="${esc(r.url)}" target="_blank" rel="noopener">Open listing ↗</a></div>`;return d}
function hlPin(k,on){const m=LMK.get(k),el=m&&m.getElement();if(el)el.classList.toggle('hl',on);if(m)m.setZIndexOffset(on?1000:0)}
function showPin(k){const m=LMK.get(k);if(!m||!LMAP)return;const side=$('.pm-side');if(side&&(side.getBoundingClientRect().bottom<0||matchMedia('(max-width:900px)').matches))side.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});
  LMAP.setView(m.getLatLng(),Math.max(LMAP.getZoom(),14),{animate:!reduced()});m.openPopup()}
function focusCard(k){const c=$('#pc'+k);if(!c)return;c.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});c.classList.remove('flash');void c.offsetWidth;c.classList.add('flash')}
async function drawMap(rows){const el=$('#fMap');if(!el)return;const sig=(S.find.liveAt||'')+'|'+rows.map(r=>r.k).join(',');
  const keep=LMAP&&FS.mapSig===sig?{c:LMAP.getCenter(),z:LMAP.getZoom()}:null;if(LMAP){LMAP.remove();LMAP=null}LMK.clear();
  const pts=rows.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng));if(!pts.length)return;
  try{await loadLeaflet()}catch(e){el.innerHTML='<div class="pm-msg">The map couldn\'t load. Check your connection and try again.</div>';return}
  if(!el.isConnected||$('#fMap')!==el)return;const Lf=window.L;
  LMAP=Lf.map(el,{scrollWheelZoom:false,zoomSnap:.5});FS.mapSig=sig;LMAP.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  // OpenStreetMap's own tiles need no API key (CARTO's free basemap now does); the tile pane is inverted in CSS to keep the dark look.
  let tileOk=false,tileBad=0;
  const tl=Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(LMAP);
  tl.on('tileload',()=>{tileOk=true});
  tl.on('tileerror',()=>{if(!tileOk&&++tileBad===4&&el.isConnected&&!el.querySelector('.pm-msg')){const m=document.createElement('div');m.className='pm-msg pm-note';m.textContent='Map tiles couldn\'t load. The pins still show where each listing is.';el.appendChild(m)}});
  el.addEventListener('click',()=>LMAP&&LMAP.scrollWheelZoom.enable(),{once:true});
  const seen=new Map(),ll=[];
  pts.forEach(r=>{let lat=r.lat,lng=r.lng;const key=lat.toFixed(4)+','+lng.toFixed(4),n=seen.get(key)||0;seen.set(key,n+1);
    // Listings placed at the same point (one postcode area) are fanned out so each pin can be clicked.
    if(n){const a=n*2.4,d=.0022*Math.sqrt(n);lat+=d*Math.cos(a);lng+=d*Math.sin(a)*1.6}
    const m=Lf.marker([lat,lng],{icon:Lf.divIcon({className:'pm-pin'+(r.geo==='exact'?'':' approx'),html:`<span>${esc(kPrice(r))}</span>`,iconSize:null}),title:`${r.type}, ${gbp(r.price)}${r.geo==='exact'?'':' (approximate position)'}`,riseOnHover:true,keyboard:true}).addTo(LMAP);
    m.bindPopup(()=>pinPop(r),{className:'pm-pop',maxWidth:232,minWidth:232,autoPanPadding:[20,20]});
    m.on('click',()=>focusCard(r.k));m.on('mouseover',()=>{const c=$('#pc'+r.k);if(c)c.classList.add('hl')});m.on('mouseout',()=>{const c=$('#pc'+r.k);if(c)c.classList.remove('hl')});
    LMK.set(r.k,m);ll.push([lat,lng])});
  if(keep)LMAP.setView(keep.c,keep.z,{animate:false});else LMAP.fitBounds(ll,{padding:[40,40],maxZoom:14});
  setTimeout(()=>{if(LMAP)LMAP.invalidateSize()},80);
  // The panel can change size after the map is drawn (page animation, layout, window resize): resize the map with it and,
  // until the member moves the map themselves, fit the pins again so tiles fill the box and every pin is in view.
  try{let touched=!!keep;['mousedown','wheel','touchstart'].forEach(ev=>el.addEventListener(ev,()=>{touched=true},{passive:true}));
    const map=LMAP,ro=new ResizeObserver(()=>{if(LMAP!==map||!el.isConnected)return;map.invalidateSize();if(!touched)map.fitBounds(ll,{padding:[40,40],maxZoom:14,animate:false})});
    ro.observe(el);map.on('unload',()=>ro.disconnect())}catch(e){}}
$('#fResults').addEventListener('mouseover',e=>{const c=e.target.closest('.pcard');if(c&&!c.contains(e.relatedTarget))hlPin(+c.dataset.k,true)});
$('#fResults').addEventListener('mouseout',e=>{const c=e.target.closest('.pcard');if(c&&!c.contains(e.relatedTarget))hlPin(+c.dataset.k,false)});
/* Share as link: publish the deal cards as one web page at /deals/<id>, to send on WhatsApp, email or text */
let SHARING=false;
async function shareLink(){if(SHARING)return;const rows=cardRows();if(!rows.length){toast('No deals to share.');return}
  if(!document.body.dataset.userId){toast('Sign in to share deals as a link.');return}
  const {title,foot}=cardsTitle(rows.length);
  const cards=rows.map((r,i)=>{const c=cardFacts(r,i);return {head:c.head,lines:c.lines.filter(l=>l[1]),url:preNDA()?'':r.url,pack:r.pack?r.pack.id:'',photo:preNDA()?'':rowPhotos(r)[0]||''}});
  const b=$('#fShareLink');SHARING=true;if(b){b.disabled=true;b.textContent='Making link…'}
  try{const res=await fetch('/api/deal-lists',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({list:{title,foot,preNDA:preNDA(),cards}})});
    const d=await res.json().catch(()=>({}));if(!res.ok)throw new Error(d.error||'The link could not be made. Please try again.');
    const link=location.origin+d.url,wa='https://wa.me/?text='+encodeURIComponent(`${title}\n${link}`);
    const n=$('#nFind');n.classList.remove('ferr');n.classList.add('share-note');
    n.innerHTML=`<div><b>Your deals are ready to share.</b> Anyone with this link can see ${rows.length} deal${rows.length===1?'':'s'}${preNDA()?' (pre-NDA: no listing links or street names)':''}.</div>
      <input class="inp" id="shareUrl" readonly value="${esc(link)}" aria-label="Link to the shared deals">
      <div class="ln-a"><a class="btn sm primary" href="${esc(wa)}" target="_blank" rel="noopener">Send on WhatsApp</a><button class="btn sm" type="button" id="shareCopy">Copy link</button><a class="btn sm" href="${esc(link)}" target="_blank" rel="noopener">Open page ↗</a><button class="btn sm" type="button" data-ln-close>Dismiss</button></div>`;
    n.hidden=false;n.scrollIntoView({block:'nearest',behavior:'smooth'});toast('Link ready. Send it on WhatsApp or copy it.')}
  catch(e){toast(netMsg(e)||e.message)}
  finally{SHARING=false;if(b){b.disabled=false;b.textContent='Share as link'}}}
document.addEventListener('click',e=>{if(!e.target.closest('#shareCopy'))return;const i=$('#shareUrl');if(!i)return;
  const sel=()=>{i.focus();i.select();toast('Link selected. Press Ctrl/Cmd+C to copy.')};
  try{navigator.clipboard.writeText(i.value).then(()=>toast('Link copied.')).catch(sel)}catch(err){sel()}});
/* ---------- Analyse & package (Premium and Max): analyse every deal card and publish a shareable pre-NDA pack for each ---------- */
const PACK_PLANS=['Pro','Max5','Max20'],canPack=()=>!!S.admin||PACK_PLANS.includes(S.plan);
const FP={busy:false,done:0,total:0,failed:0};
const packLabel=n=>FP.busy?`Packaging ${Math.min(FP.done+1,FP.total)} of ${FP.total}…`:FS.sel.size?`Analyse & package ${FS.sel.size}`:`Analyse & package all ${n}`;
const packBtn=n=>`<button class="btn sm" id="fPackAll"${n&&!FP.busy?'':' disabled'} title="Analyse every deal and create a shareable deal pack for each. Premium and Max.">${canPack()?'':LOCK}${packLabel(n)}</button>`;
function syncPackBtn(){const b=$('#fPackAll');if(!b)return;const n=(FS.lastRows||[]).filter(isOpen).length;b.disabled=!n||FP.busy;b.innerHTML=(canPack()?'':LOCK)+esc(packLabel(n))}
const postcodeArea=pc=>String(pc||'').trim().split(/\s+/)[0].toUpperCase();
// The shared pack is pre-NDA: town and postcode district only, no listing link, site or advertiser.
function packFrom(r,a,strat){const buy=r.mode==='buy',pp=S.deal&&S.deal.pack||{},district=postcodeArea(r.postcode);
  // Areas read "Street, Town" or "Street, W2": leave the street out, keep the town and postcode district.
  const parts=String(r.area||'').replace(/\s*\(.*?\)/g,'').split(',').map(t=>t.trim()).filter(Boolean),rest=parts.length>1?parts.slice(1):parts;
  let where=rest.join(', ');if(district&&!where.toUpperCase().includes(district))where=[where,district].filter(Boolean).join(' ');
  const town=rest.filter(t=>!/^[A-Z]{1,2}\d/i.test(t)).map(t=>t.replace(/\s+[A-Z]{1,2}\d[\dA-Z]?\b.*$/i,'')).pop()||district;
  const photos=[...new Set(((a&&a.links_read)||[]).flatMap(l=>Array.isArray(l.photos)?l.photos:[]))];
  const kv=(label,value)=>value!=null&&String(value).trim()?{label,value:String(value)}:null;
  return {title:`${r.type||'Property'}${town?` in ${town}`:''}`,location:where,strategy:STRAT_NAME[strat]||strat,
    facts:[kv(buy?'Asking price':'Rent',buy?gbp(r.price):`${gbp(r.price)} a month`),kv('Property',r.type),kv('Bedrooms',r.beds===0?'Studio':r.beds),kv('Furnished',r.furnished&&r.furnished!=='Not stated'?r.furnished:'')].filter(Boolean),
    verdict:a.verdict,score:a.score,summary:a.summary,
    metrics:[kv('Monthly profit',a.monthly_profit),kv('Upfront cash',a.upfront_cash),kv('Break-even',a.break_even),...(Array.isArray(a.strategy_metrics)?a.strategy_metrics.map(m=>kv(m&&m.label,m&&m.value)):[])].filter(Boolean),
    scenarios:(Array.isArray(a.occupancy_scenarios)?a.occupancy_scenarios:[]).map(o=>kv(`At ${o.occupancy}`,o.monthly_profit)).filter(Boolean),
    risks:Array.isArray(a.risks)?a.risks:[],photos,biz:pp.biz||'',redress:pp.redress||'',fee:pp.fee||''}}
async function packOne(r,lv){const st=stratFor(r),strat=st==='none'?(r.mode==='buy'?'BTL':'R2SA'):st;
  const res=await fetch('/api/analyze-deal',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'analyse',deal:listingBrief([r]),level:lv.id,strategy:strat})});
  const d=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(new Error(d.error||'The analysis could not be started.'),{stop:[401,402,403].includes(res.status)});
  if(d.credits){AIC.info=d.credits;renderAILevels()}
  const a=await pollJob(d.jobId);
  const pr=await fetch('/api/packs',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({pack:packFrom(r,a||{},strat)})});
  const pj=await pr.json().catch(()=>({}));if(!pr.ok)throw Object.assign(new Error(pj.error||'The deal pack could not be saved.'),{stop:[401,402,403].includes(pr.status)});
  const pk={id:pj.id,score:Number.isFinite(+a.score)?Math.round(+a.score):null,verdict:String(a.verdict||'').slice(0,60),at:new Date().toISOString()};
  // Rows are copies of the search results: store the pack on the saved listing too, so it stays after a reload.
  r.pack=pk;const src=SRC()[r.k];if(src&&src.url===r.url)src.pack=pk;save()}
async function packageAll(){if(FP.busy)return;
  if(!canPack()){toast('Analyse & package is included with Premium and Max. Upgrade to analyse every deal at once and share a deal pack link with each card.');go('plans');return}
  const rows=cardRows(),todo=rows.filter(r=>!r.pack);if(!rows.length){toast('No deals to package.');return}
  if(!todo.length){toast('These deals are already packaged. Copy the deal cards to share them with their pack links.');return}
  const lv=AI_LEVELS.find(l=>l.id===AIC.level)||AI_LEVELS[0];
  if(!confirm(`Analyse and package ${todo.length} deal${todo.length===1?'':'s'} at ${lv.name}?\n\nEach deal gets a full analysis, which uses credits just like analysing it on its own, and a shareable pre-NDA deal pack (no listing link or exact address).${rows.length>todo.length?`\n\n${rows.length-todo.length} already packaged will be skipped.`:''}`))return;
  Object.assign(FP,{busy:true,done:0,total:todo.length,failed:0});syncPackBtn();toast(`Packaging ${todo.length} deal${todo.length===1?'':'s'}. You can keep working; leave this page open.`);
  const q=todo.slice();let stop='';
  const worker=async()=>{while(q.length&&!stop){const r=q.shift();try{try{await packOne(r,lv)}catch(e){if(!e.retry)throw e;await sleep(25000);await packOne(r,lv)}}catch(e){FP.failed++;if(e.stop)stop=e.message;console.warn('Packaging failed',e)}FP.done++;syncPackBtn()}};
  await Promise.all([worker(),worker(),worker()]);
  const ok=FP.done-FP.failed;FP.busy=false;save();renderFind();
  toast(stop?`${stop}${ok?` ${ok} deal${ok===1?' was':'s were'} packaged first.`:''}`:`Packaged ${ok} of ${FP.total} deal${FP.total===1?'':'s'}.${FP.failed?` ${FP.failed} couldn't be analysed; try those again.`:''} Copy the deal cards to share them with their pack links.`)}
// Start a new deal from pasted or posted text and run the AI analysis on it straight away.
function analyseText(text,name){text=String(text||'').trim();if(!text){toast('Paste the deal details first.');return}
  startAnalysis(()=>{const d=freshDeal();d.name=String(name||'').trim().slice(0,80)||'Pasted deal';S.deal=d;markAnalysed(d.id);save();bindDeal();go('analyser','numbers');
    $('#aiDealInput').value=text;renderAIAnalysis(null);$('#analyseWithAI').click()})}
function buildDeal(ls){ls=ls.filter(Boolean).filter(isOpen);if(!ls.length)return;startAnalysis(()=>{const d=sampleDeal(),areas=[...new Set(ls.map(x=>x.area))],short=a=>a.split(',')[0].trim();
  Object.assign(d,{id:'d'+Date.now(),name:areas.length>1?`${areas[0]} + ${areas.length-1} more`:areas[0],area:areas.join('; '),strat:(()=>{const st=stratFor(ls[0]);return st==='none'?(ls[0].mode==='buy'?'BTL':'R2SA'):st})(),london:ls.some(x=>isLondonText(x.area+' '+x.postcode)),status:'Analysing',
    units:ls.map(x=>{const w=x.area+' '+x.postcode,rooms=Math.max(1,x.beds||1),base={label:`${x.type} · ${short(x.area)}`,rate:RATE_EST(x.beds,w),rooms,roomRent:ROOM_EST(w),bills:100*rooms,url:x.url};
      // A property for sale: its price is the purchase price, never the rent.
      return x.mode==='buy'?Object.assign(base,{price:x.price,mrent:RENT_EST(x.beds,w),rent:0,dep:0,refurb:0,gdv:0})
        :Object.assign(base,{rent:x.price,dep:Math.round(x.price*12/52*5)})})});
  d.aiStrategy=d.strat;S.deal=d;FS.sel.clear();markAnalysed(d.id);save();bindDeal();go('analyser','numbers');
  // Fill in the deal for the AI and start the analysis straight away.
  $('#aiDealInput').value=listingBrief(ls);renderAIAnalysis(null);$('#analyseWithAI').click();
  toast(`Analysing ${ls.length} listing${ls.length>1?'s':''} as ${STRAT_NAME[d.strat]||d.strat}.`)})}
function listingBrief(ls){const st=stratFor(ls[0]);
  const one=x=>[`${x.type} in ${x.area}${x.postcode&&!x.area.includes(x.postcode)?` (${x.postcode})`:''}, listed on ${x.site}`,
    x.mode==='buy'?`Asking price ${gbp(x.price)}`:`Rent ${gbp(x.price)} a month`,
    ...(st==='R2SA'?[`Deposit about ${gbp(x.price)} (estimated, not stated in the listing)`,`Nightly rate about ${gbp(RATE_EST(x.beds,x.area+' '+x.postcode))} (estimated)`]:[]),
    `Furnished: ${x.furnished}`,`Listing: ${x.url}`].join('\n');
  return `${STRAT_NAME[st]&&st!=='none'?STRAT_NAME[st]+' ':''}deal found with Deal Finder.${S.find.f.notes?`\nInvestor criteria: ${S.find.f.notes}`:''}\n\n`+(ls.length>1?ls.map((x,i)=>`Unit ${i+1}: ${one(x)}`).join('\n\n'):one(ls[0]))}
$('#fResults').addEventListener('click',e=>{
  const s=e.target.closest('[data-sort]');if(s){const k=s.dataset.sort,c=S.find.sort;S.find.sort=c&&c.k===k?(c.dir>0?{k,dir:-1}:null):{k,dir:1};save();renderFind();const nb=$(`#fResults [data-sort="${k}"]`);if(nb)nb.focus();return}
  const u=e.target.closest('[data-unlock]');if(u){openUnlock(+u.dataset.unlock,+u.dataset.n||0);return}
  const b=e.target.closest('[data-build]');if(b){buildDeal([SRC()[+b.dataset.build]]);return}
  if(e.target.closest('#fViewMap')){S.find.view='map';save();renderFind();$('#fViewMap').focus();return}
  const st=e.target.closest('[data-ph-step]');if(st){photoStep(+st.closest('.pcard').dataset.k,+st.dataset.phStep);return}
  const pin=e.target.closest('[data-pin]');if(pin){showPin(+pin.dataset.pin);return}
  if(e.target.closest('#fViewCards')){S.find.view='cards';save();renderFind();$('#fViewCards').focus();return}
  if(e.target.closest('#fViewSheet')){S.find.view='sheet';save();renderFind();$('#fViewSheet').focus();return}
  const ar=e.target.closest('#fPrev,#fNext');if(ar){const c=$('#fCards');if(c){const step=312*Math.max(1,Math.floor(c.clientWidth/312));c.scrollBy({left:(ar.id==='fPrev'?-1:1)*step,behavior:reduced()?'auto':'smooth'})}return}
  if(e.target.closest('#fBuildSel')){buildDeal($$('#fResults [data-sel]').filter(c=>c.checked).map(c=>SRC()[+c.dataset.sel]));return}
  if(e.target.closest('#fCopy'))copyTsv();if(e.target.closest('#fCopyCards'))copyCards();if(e.target.closest('#fShareLink'))shareLink();if(e.target.closest('#fPackAll'))packageAll()});
$('#fResults').addEventListener('change',e=>{const t=e.target;
  if(t.id==='fSortSel'){const v=t.value;S.find.sort=v?{k:v.split(':')[0],dir:+v.split(':')[1]}:null;save();renderFind();const s=$('#fSortSel');if(s)s.focus();return}
  if(t.id==='fSelAll'){$$('#fResults [data-sel]').forEach(c=>{c.checked=t.checked;const k=+c.dataset.sel;if(t.checked)FS.sel.add(k);else FS.sel.delete(k)});syncSel();return}
  if(t.dataset.sel!=null){const k=+t.dataset.sel;if(t.checked)FS.sel.add(k);else FS.sel.delete(k);syncSel()}});

/* ---------- unlock panel: 1 sign agreement, 2 pay ---------- */
/* ---------- paywall ---------- */
const pw=$('#payWall');let pwRun=null,pwOpener=null;
function openPaywall(run){pwRun=run;pwOpener=document.activeElement;const ann=S.billing==='annual';
  
  try{pw.showModal()}catch(e){pw.setAttribute('open','')}const t=$('#pwTitle');if(t)t.focus()}
function closePaywall(){pwRun=null;try{pw.close()}catch(e){pw.removeAttribute('open')}}
pw.addEventListener('close',()=>{if(pwOpener&&pwOpener.isConnected)try{pwOpener.focus()}catch(e){}});
pw.addEventListener('click',e=>{if(e.target===pw)closePaywall()});
function checkoutURL(base){const u=new URL(base);const uid=document.body.dataset.userId,email=document.body.dataset.userEmail;if(uid)u.searchParams.set('client_reference_id',uid);if(email)u.searchParams.set('prefilled_email',email);return u.toString()}
function subscribe(id){if(!startCheckout(id))closePaywall()}
$('#pwPro').addEventListener('click',()=>subscribe('Pro'));$('#pwMax').addEventListener('click',()=>subscribe('Max5'));
$('#pwNot').addEventListener('click',closePaywall);$('#pwClose').addEventListener('click',closePaywall);
$('#pwAll').addEventListener('click',()=>{closePaywall();go('plans')});

const sg=$('#signPanel');let sgOpener=null;const sgTouched=new Set();
const UL={k:null,n:0,signed:null,busy:false};
const SGF={name:'#sgName',email:'#sgEmail',agree:'#sgAgree',start:'#sgStart',sig:'#sgSig'};
function termsHTML(){const p=S.deal.pack||{},biz=esc(p.biz||'[Sourcing business]'),red=esc(p.redress||'[redress no.]'),fee=gbp(dealFee());
  return `<li><b>Confidentiality.</b> The address, landlord details and listing link are confidential and for your own use or your own investor clients only.</li>
  <li><b>Non-circumvention.</b> For 24 months you won't contact or deal with the landlord or property except through us. If you do, the deal fee and any sourcing fee earned is payable in full.</li>
  <li><b>Deal fee.</b> ${fee} for this deal, paid now to release the details. Refunded only if the landlord withdraws before you're introduced.</li>
  <li><b>Your responsibility.</b> You market the deal to your investors under your own redress scheme, terms and compliance. Figures are illustrative, not financial advice. You do your own due diligence.</li>
  <li><b>Cancellation.</b> If you're an individual you have 14 days to cancel. You ask us to release the details now, and once they're released the fee is non-refundable except under term 3.</li>
  <li>Offered by ${biz}, ${red}. Law of England and Wales.</li>`}
function validateSign(){const g=s=>$(s),v={name:g('#sgName').value.trim(),email:g('#sgEmail').value.trim(),company:g('#sgCompany').value.trim(),as:g('#sgAs').value,agree:g('#sgAgree').checked,start:g('#sgStart').checked,sig:g('#sgSig').value.trim()};
  const norm=s=>s.replace(/\s+/g,' ').toLowerCase();
  const er={name:v.name.length<2?'Enter your full name.':'',email:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)?'':'Enter a valid email address.',
    agree:v.agree?'':'Tick to agree to the Deal Introduction Agreement.',
    start:v.start?'':'Tick to ask us to start now and release the details.',sig:!v.sig?'Type your full name to sign.':norm(v.sig)!==norm(v.name)?'Signature must match your full name.':''};
  Object.keys(er).forEach(k=>{const msg=$('#sgErr-'+k),show=sgTouched.has(k)&&!!er[k];msg.textContent=show?er[k]:'';msg.hidden=!show;$(SGF[k]).setAttribute('aria-invalid',show?'true':'false')});
  const ok=Object.values(er).every(x=>!x);$('#sgSign').disabled=!ok;$('#sgHint').textContent=ok?'Ready to sign.':'Complete every field to sign.';return ok?v:null}
function ulStep(s){const r=LISTINGS[UL.k];$('#ulStep1').hidden=s!==1;$('#ulStep2').hidden=s!==2;
  $('#ulInd1').className=s===1?'on':'done';$('#ulInd2').className=s===2?'on':'';
  $('#sgTitle').textContent=s===1?'Deal Introduction Agreement':'Pay the deal fee';
  $('#sgSign').hidden=s!==1;$('#sgHint').hidden=s!==1;$('#payBtn').hidden=s!==2;$('#ulBack').hidden=s!==2;
  if(s===2){const f=gbp(dealFee());
    $('#ulOrder').innerHTML=`<div><dt>Deal ${UL.n}</dt><dd>${esc(r.type)} · ${esc(r.postcode||r.area)}</dd></div><div><dt>Deal fee</dt><dd>${f}</dd></div><div class="tot"><dt>Total today</dt><dd>${f}</dd></div>`;
    $('#ulSigned').innerHTML=`<span class="dot good"></span><span>Agreement signed by <b>${esc(UL.signed.name)}</b>${UL.signed.company?` for ${esc(UL.signed.company)}`:''} on ${fmtDate(UL.signed.date)}.</span>`;
    const pb=$('#payBtn');pb.disabled=false;pb.textContent=`Pay ${f}`;$('#ulProc').hidden=true}
  const body=$('.dr-body');if(body)body.scrollTop=0;const pane=$(s===1?'#ulStep1':'#ulStep2');pane.classList.remove('enter');void pane.offsetWidth;pane.classList.add('enter')}
function openUnlock(k,n){const r=LISTINGS[k];if(!r||isOpen(r))return;sgOpener=document.activeElement;
  UL.k=k;UL.n=n;UL.signed=null;UL.busy=false;
  $('#ulKicker').textContent=`Unlock Deal ${n} · ${r.type} · ${r.postcode||r.area}`;$('#sgTerms').innerHTML=termsHTML();
  const p=S.signer||{};$('#sgName').value=p.name||'';$('#sgEmail').value=p.email||'';$('#sgCompany').value=p.company||'';$('#sgAs').value=p.as==='Company'?'Company':'Individual';
  $('#sgAgree').checked=false;$('#sgStart').checked=false;$('#sgSig').value='';sgTouched.clear();validateSign();ulStep(1);
  try{sg.showModal()}catch(e){sg.setAttribute('open','')}
  const f=$('#sgTitle');if(f)f.focus()}
function closeSign(){try{sg.close()}catch(e){sg.removeAttribute('open')}}
sg.addEventListener('close',()=>{if(sgOpener&&sgOpener.isConnected)try{sgOpener.focus()}catch(e){}});
sg.addEventListener('click',e=>{if(e.target===sg&&!UL.busy)closeSign()});
sg.addEventListener('cancel',e=>{if(UL.busy)e.preventDefault()});
$('#sgClose').addEventListener('click',()=>{if(!UL.busy)closeSign()});$('#sgCancel').addEventListener('click',()=>{if(!UL.busy)closeSign()});
$('#ulBack').addEventListener('click',()=>{if(!UL.busy)ulStep(1)});
$('#sgForm').addEventListener('input',()=>validateSign());
$('#sgForm').addEventListener('change',e=>{const k=e.target.dataset.k;if(k&&e.target.type==='checkbox')sgTouched.add(k);validateSign()});
$('#sgForm').addEventListener('focusout',e=>{const k=e.target.dataset.k;if(k)sgTouched.add(k);validateSign()});
function doSign(){const v=validateSign();if(!v){Object.keys(SGF).forEach(k=>sgTouched.add(k));validateSign();return}
  UL.signed={name:v.name,email:v.email,company:v.company,as:v.as,date:new Date().toISOString()};ulStep(2);$('#payBtn').focus()}
$('#sgSign').addEventListener('click',doSign);
$('#sgForm').addEventListener('submit',e=>{e.preventDefault();doSign()});
$('#payBtn').addEventListener('click',()=>{if(UL.busy||!UL.signed)return;
  const pb=$('#payBtn');pb.disabled=true;pb.textContent='Secure checkout unavailable';$('#ulProc').hidden=false;
  $('#ulProc').textContent='Your agreement has been completed, but the £500 deal-unlock checkout is not connected yet. No payment has been taken and the protected details remain locked.';
  toast('No payment taken — secure checkout still needs connecting.')});


/* ---------- plans: owner settings ---------- */

/* ---------- home ---------- */
function dealFigs(d){const a=d.a,U=d.units||[];const rent=U.reduce((s,u)=>s+u.rent,0),dep=U.reduce((s,u)=>s+u.dep,0);
  const tot=OCC.map(o=>U.reduce((s,u)=>s+month(u,o,null,a).surplus,0)),bes=U.map(u=>be(u,a));return{up:rent+dep,t60:tot[0],t80:tot[1],be:bes.length?Math.max(...bes):NaN}}
function renderHome(){syncFee();
  let bi=0,bv=-Infinity;LISTINGS.forEach((r,i)=>{const v=month({rent:r.price,rate:RATE_EST(r.beds,r.area+' '+r.postcode)},.8,null,DEF_A).surplus;if(v>bv){bv=v;bi=i}});
  const hasFigures=modelHas(S.deal),S4=modelStrip(hasFigures?S.deal:Object.assign({},S.deal,{units:[]})),fig=(l,v,cls='')=>`<div class="fig"><div class="fig-l">${l}</div><div class="fig-v${cls}">${hasFigures?v:'—'}</div></div>`;
  $('#homePreview').innerHTML=`<div class="pv-label"><span class="dot"></span>Deal Finder · opportunity preview</div>
    ${dealCard(Object.assign({k:bi},LISTINGS[bi]),0,{preview:true,plain:true})}
    <div class="pv-nums"><div class="pv-label">Deal Analyser · ${esc(S.deal.name||'Untitled deal')}</div>
      <div class="strip mini">${S4.slice(0,4).map(([l,v,,neg])=>fig(l,v,neg?' neg':'')).join('')}</div></div>`;
  const hp=(n,pr,per,sub,feat)=>`<div class="hplan${feat?' feat':''}"><div class="plan-h"><h3>${n}</h3>${feat?'<span class="tag">Most popular</span>':''}</div><div class="price"><span class="mono">${pr}</span><span class="per">${per}</span></div><div class="sub">${sub}</div></div>`;
  $('#homePlans').innerHTML=hp('Free','£0','per month','Try Deal Pro with 3 Deal Finder searches a week and 2 deal analyses.')+hp('Premium','£39','per month','For everyday sourcing. Searches and analyses at every power level, billed monthly.',true)+hp('Max','£100','per month and up','5x or 20x more usage than Premium, for sourcers who work deals all day.')}


/* ---------- hero: slow liquid field, paused offscreen, static under reduced motion ---------- */
const hero={c:$('#heroCanvas'),x:null,raf:0,frames:0,running:false,inView:true,staticDrawn:false,last:0};
window.__dealProHero=hero;
function heroSize(){const c=hero.c;if(!c)return;const r=c.getBoundingClientRect();c.width=Math.max(48,Math.round(r.width/6));c.height=Math.max(48,Math.round(r.height/6))}
function heroDraw(t){const c=hero.c,x=hero.x;if(!c||!x)return;const w=c.width,h=c.height,s=t*0.00006;
  x.globalCompositeOperation='source-over';x.fillStyle='#0B0B0C';x.fillRect(0,0,w,h);
  x.globalCompositeOperation='lighter';
  [[.74,.34,.55,'200,16,46',.30],[.94,.82,.52,'110,6,20',.42],[.48,1.0,.42,'224,20,43',.13]].forEach(([bx,by,br,col,a],i)=>{
    const cx=w*(bx+.08*Math.sin(s*(1.3+i*.4)+i*2)),cy=h*(by+.1*Math.cos(s*(1.1+i*.3)+i)),r=Math.max(w,h)*br*(1+.08*Math.sin(s*2+i));
    const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(1,`rgba(${col},0)`);x.fillStyle=g;x.fillRect(0,0,w,h)});
  for(let j=0;j<3;j++){const base=h*(.58+j*.12),amp=h*(.05+j*.02),k=(2+j)*Math.PI/w,ph=s*(3+j)+j*1.7;x.beginPath();x.moveTo(0,h);
    for(let px=0;px<=w;px+=3)x.lineTo(px,base+Math.sin(px*k+ph)*amp+Math.sin(px*k*.53-ph*1.3)*amp*.6);
    x.lineTo(w,h);x.closePath();x.fillStyle=`rgba(140,8,26,${.08-j*.02})`;x.fill()}
  x.globalCompositeOperation='source-over';
  const lg=x.createLinearGradient(0,0,w,0);lg.addColorStop(0,'rgba(11,11,12,.9)');lg.addColorStop(.5,'rgba(11,11,12,.5)');lg.addColorStop(1,'rgba(11,11,12,.05)');x.fillStyle=lg;x.fillRect(0,0,w,h)}
function heroFrame(ts){hero.raf=requestAnimationFrame(heroFrame);if(ts-hero.last<40)return;hero.last=ts;hero.frames++;heroDraw(ts)}
function heroUpdate(){if(!hero.c)return;const home=$('[data-view="home"]'),want=hero.inView&&!document.hidden&&home&&!home.hidden&&!reduced();
  if(want&&!hero.running){hero.running=true;hero.raf=requestAnimationFrame(heroFrame)}
  else if(!want&&hero.running){hero.running=false;cancelAnimationFrame(hero.raf)}
  if(reduced()&&!hero.staticDrawn&&home&&!home.hidden){heroSize();heroDraw(40000);hero.staticDrawn=true}}
if(hero.c){try{hero.x=hero.c.getContext('2d')}catch(e){}
  heroSize();heroDraw(40000);hero.staticDrawn=reduced();
  try{new IntersectionObserver(es=>{hero.inView=es[es.length-1].isIntersecting;heroUpdate()}).observe(hero.c)}catch(e){hero.inView=true}
  document.addEventListener('visibilitychange',heroUpdate);
  addEventListener('resize',()=>{heroSize();heroDraw(hero.last||40000)});
  try{matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{hero.staticDrawn=false;heroUpdate()})}catch(e){}}


/* ---------- motion: sparks, cursor glow and reveal-on-scroll (off when reduced motion is on) ---------- */
(function(){const fx=document.getElementById('bgfx');if(!fx||reduced())return;document.documentElement.classList.add('fx');
  if(matchMedia('(pointer:fine)').matches){let raf=0,x=0,y=0;addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;fx.style.setProperty('--mx',x+'px');fx.style.setProperty('--my',y+'px')})},{passive:true})}
  const seen=new WeakSet(),io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -6% 0px'}):null;
  // Only elements on screen when a page opens are animated, so results that redraw later never flicker.
  window.revealIn=root=>{if(!io||!root)return;let n=0;root.querySelectorAll('.panel,.plan,.hero-copy,.hero-preview,.pl-card,.limit-note').forEach(el=>{if(seen.has(el)||el.closest('.rv'))return;seen.add(el);el.classList.add('rv');el.style.setProperty('--d',Math.min(n++,8)*70+'ms');io.observe(el)});
    setTimeout(()=>root.querySelectorAll('.rv:not(.in)').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight)el.classList.add('in')}),1500)};
  const cur=()=>document.querySelector('[data-view]:not([hidden])');revealIn(cur());
  new MutationObserver(ms=>{for(const m of ms)if(m.attributeName==='hidden'&&!m.target.hidden)revealIn(m.target)}).observe(document.querySelector('.content')||document.body,{subtree:true,attributes:true,attributeFilter:['hidden']});
})();

/* ---------- UK city panoramas (OpenArt) panning sideways and changing city, with deal pins riding on the buildings ---------- */
(function(){const A=document.getElementById('pano'),B=document.getElementById('pano2'),cv=document.getElementById('sky');if(!A||!B||!cv||!cv.getContext)return;const ctx=cv.getContext('2d');
  const still=reduced(),mobile=matchMedia('(max-width:760px),(pointer:coarse)').matches,DPR=Math.min(1.5,devicePixelRatio||1),sm=mobile?'-sm':'';
  // rooftops in each panorama, as fractions of the image (3168 x 1344)
  const CITIES=window.DP_CITIES=[
    {name:'London',img:'london',roofs:[[.12,.15],[.041,.372],[.23,.536],[.354,.394],[.456,.399],[.54,.357],[.647,.265],[.722,.365],[.622,.454],[.783,.491],[.884,.387],[.931,.365],[.966,.491],[.1,.46],[.5,.55]]},
    {name:'Manchester',img:'manchester',roofs:[[.582,.18],[.672,.35],[.731,.24],[.8,.29],[.85,.31],[.24,.42],[.464,.5],[.114,.43],[.814,.51],[.975,.42],[.663,.53],[.346,.49],[.9,.49]]},
    {name:'Birmingham',img:'birmingham',roofs:[[.073,.35],[.279,.35],[.384,.28],[.497,.35],[.628,.25],[.762,.29],[.816,.38],[.916,.24],[.346,.51],[.653,.48],[.189,.47],[.72,.39],[.857,.44],[.128,.45],[.98,.5]]},
    {name:'Newcastle',img:'newcastle',roofs:[[.038,.37],[.298,.38],[.478,.39],[.568,.43],[.675,.31],[.739,.46],[.795,.46],[.862,.41],[.938,.36],[.133,.47],[.516,.39],[.985,.37],[.606,.46],[.398,.48],[.824,.44]]}
  ];
  const RATIO=3168/1344,SWEEP=window.DP_SWEEP||(mobile?38:46),FADE=1.6;
  const TAGS=['NEW','+£320/mo','✓ Live','8.6% yield','BMV','£415k','HMO','R2SA','+£410/mo','Just listed','2 bed','BRRR','£115k','3 bed house'];
  const tag=document.createElement('div');tag.className='city-tag';tag.setAttribute('aria-hidden','true');const foot=document.querySelector('.hero-foot');if(foot)foot.after(tag);
  const setTag=c=>{tag.classList.add('swap');setTimeout(()=>{tag.innerHTML=`<i></i>Deal Finder · <b>${c.name}</b>`;tag.classList.remove('swap')},350)};
  let W=0,H=0,iw=0,ih=0,off=0,pins=[],last=0,next=1.5,ci=0,cur=A,nxt=B,cityStart=performance.now(),fading=false;
  const src=c=>`url(/assets/bg/${c.img}-pano${sm}.webp)`;cur.style.backgroundImage=src(CITIES[0]);setTag(CITIES[0]);
  // preload the next city's picture so the change is instant
  const preload=c=>{const im=new Image();im.src=`/assets/bg/${c.img}-pano${sm}.webp`};if(CITIES[1])preload(CITIES[1]);
  const size=()=>{W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;ih=A.offsetHeight||H*1.15;iw=ih*RATIO};
  const span=()=>Math.max(0,iw-W);
  const toScreen=([fx,fy])=>[fx*iw-off,fy*ih];
  const open=(x,y)=>{const el=document.elementFromPoint(x,y);return !el||!el.closest('.panel,.side,.hero-preview,.dcard,.plan,.qp-badge,.public-auth-nav,.city-tag,a,button,input,textarea,select,h1,h2,h3,p,li,table,label')};
  function spawn(){const sd=document.querySelector('.side'),sr=sd?sd.getBoundingClientRect():null,minX=(sr&&sr.height>H*.5?sr.right:0)+60;
    const free=CITIES[ci].roofs.filter(r=>{const [x,y]=toScreen(r);return x>minX&&x<W-120&&y>60&&y<H-20&&open(x,y-14)&&open(x,y-44)&&!pins.some(p=>Math.abs(toScreen(p.r)[0]-x)<70)});
    if(!free.length)return;pins.push({r:free[Math.floor(Math.random()*free.length)],t:0,tag:TAGS[Math.floor(Math.random()*TAGS.length)]})}
  function nextCity(now){if(CITIES.length<2)return false;ci=(ci+1)%CITIES.length;const c=CITIES[ci];nxt.style.backgroundImage=src(c);nxt.style.transform='translate3d(0,0,0)';
    nxt.style.opacity='1';cur.style.opacity='0';[cur,nxt]=[nxt,cur];pins=[];setTag(c);if(CITIES[(ci+1)%CITIES.length])preload(CITIES[(ci+1)%CITIES.length]);cityStart=now;return true}
  function place(now){const t=(now-cityStart)/1000;
    if(CITIES.length<2){const k=.5-.5*Math.cos(t/(SWEEP*2)*2*Math.PI);off=still?span()*.5:span()*k}
    else{const k=Math.min(1,t/SWEEP),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;off=still?span()*.5:span()*e;if(!still&&t>SWEEP+.4)nextCity(now)}
    cur.style.transform=`translate3d(${-off}px,0,0)`}
  function frame(now){const dt=Math.min(.1,(now-last)/1000||0);last=now;place(now);ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);
    for(const p of pins){p.t+=dt;const [x,py]=toScreen(p.r),k=p.t,drop=Math.min(1,k/.5),b=k<.5?(1-Math.pow(1-drop,3)):1+Math.sin((k-.5)*9)*Math.exp(-(k-.5)*5)*.12,
      y=py-60*(1-b)-4,fade=k<3.2?1:Math.max(0,1-(k-3.2)/.8);ctx.globalAlpha=fade;
      ctx.fillStyle='rgba(224,20,43,.3)';ctx.beginPath();ctx.ellipse(x,py,9*Math.min(1,k*2),3,0,0,7);ctx.fill();
      ctx.shadowColor='rgba(224,20,43,.9)';ctx.shadowBlur=14;ctx.fillStyle='#E0142B';ctx.beginPath();ctx.arc(x,y-13,9,Math.PI*.85,Math.PI*2.15);ctx.lineTo(x,y);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y-13,3.3,0,7);ctx.fill();
      if(k>.6){const ta=Math.min(1,(k-.6)/.3)*fade,ty=y-32-(k-.6)*8;ctx.globalAlpha=ta;ctx.font='600 12px Geist,system-ui,sans-serif';const tw=ctx.measureText(p.tag).width+16;
        ctx.fillStyle='rgba(16,16,20,.9)';ctx.beginPath();ctx.roundRect?ctx.roundRect(x-tw/2,ty-17,tw,22,11):ctx.rect(x-tw/2,ty-17,tw,22);ctx.fill();ctx.strokeStyle='rgba(224,20,43,.75)';ctx.stroke();
        ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(p.tag,x,ty-2);ctx.textAlign='left'}
      ctx.globalAlpha=1}
    pins=pins.filter(p=>p.t<4);next-=dt;if(next<=0){spawn();next=(mobile?3.4:2)+Math.random()*1.5}
    requestAnimationFrame(frame)}
  size();addEventListener('resize',()=>{size();place(performance.now())});place(performance.now());
  if(!still){requestAnimationFrame(frame);document.addEventListener('visibilitychange',()=>{if(!document.hidden)last=performance.now()})}
})();
/* ---------- hero motion: word-by-word headline, tilting card, counting figures ---------- */
(function(){const h=document.querySelector('.hero .display');if(!h||h.dataset.split)return;h.dataset.split='1';
  const intro=document.getElementById('siteIntro'),delay=intro?4.2:0.15;document.querySelector('.hero').style.setProperty('--hd',delay+'s');
  const words=h.textContent.trim().split(/\s+/);h.setAttribute('aria-label',h.textContent.trim());
  h.innerHTML=words.map((w,i)=>`<span class="w${i===words.length-1?' ul':''}" aria-hidden="true" style="--i:${i}">${w}</span>`).join(' ');
  const pv=document.querySelector('.hero-preview');if(!pv||reduced())return;
  const stagger=()=>pv.querySelectorAll('.dcard li,.dcard .dc-row').forEach((el,i)=>el.style.setProperty('--r',i));stagger();new MutationObserver(stagger).observe(pv,{childList:true,subtree:true});
  if(matchMedia('(pointer:fine)').matches){pv.addEventListener('pointermove',e=>{const r=pv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    pv.querySelectorAll(':scope>.dcard,:scope>.pv-nums').forEach(el=>el.style.transform=`rotateY(${x*10}deg) rotateX(${-y*8}deg)`)});
    pv.addEventListener('pointerleave',()=>pv.querySelectorAll(':scope>.dcard,:scope>.pv-nums').forEach(el=>el.style.transform=''))}
  // count the analyser figures up from zero the first time they show
  let counted=false;const count=()=>{if(counted)return;const vs=[...pv.querySelectorAll('.strip.mini .fig-v')];if(!vs.length)return;counted=true;
    vs.forEach(v=>{const txt=v.textContent,m=txt.match(/-?[£]?-?[\d,]+(\.\d+)?/);if(!m)return;const num=parseFloat(m[0].replace(/[£,]/g,''));if(!isFinite(num))return;
      const t0=performance.now(),dur=1200;const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3),cur=Math.round(num*e);
        v.textContent=txt.replace(m[0],(m[0].startsWith('-')||num<0?'-':'')+(m[0].includes('£')?'£':'')+Math.abs(cur).toLocaleString('en-GB'));if(k<1)requestAnimationFrame(step);else v.textContent=txt};
      setTimeout(()=>requestAnimationFrame(step),(delay+.9)*1000)})};
  count();new MutationObserver(count).observe(pv,{childList:true,subtree:true});
})();
/* ---------- first-visit explainer ---------- */
$('#fIntro').hidden=!!store.get('introDismissed',false);
$('#fIntroX').addEventListener('click',()=>{store.set('introDismissed',true);$('#fIntro').hidden=true});

/* ---------- simple AI analyser ---------- */
// The property's own area: council, what drives demand, the local figures used and the council's rules.
function localHTML(l,m){l=l||{};m=m||{};const area=l.area||m.location,council=l.council||m.council,bench=(Array.isArray(l.benchmarks)&&l.benchmarks.length?l.benchmarks:m.benchmarks)||[],
  rules=(Array.isArray(l.rules)&&l.rules.length?l.rules:m.local_rules)||[],drivers=Array.isArray(m.demand_drivers)?m.demand_drivers:[];
  if(!area&&!bench.length&&!rules.length)return '';
  return `<div class="ai-section ai-local"><h3>Local area${area?` · ${esc(String(area))}`:''}</h3>${council?`<p class="muted">${esc(String(council))}${m.nation?` · ${esc(String(m.nation))}`:''}</p>`:''}
    ${l.demand?`<p>${esc(String(l.demand))}</p>`:''}${drivers.length?`<p class="muted">Demand drivers: ${drivers.map(d=>esc(String(d))).join(' · ')}</p>`:''}
    ${bench.length?`<div class="ai-smetrics">${bench.slice(0,8).map(b=>`<div><span>${esc(String(b&&b.label||''))}</span><b>${esc(String(b&&b.value||''))}</b></div>`).join('')}</div>`:''}
    ${rules.length?`<ul>${rules.map(r=>`<li>${esc(String(r))}</li>`).join('')}</ul>`:''}</div>`}
// Comparable rents, nightly rates and prices the AI found on the web, with links to check them.
function marketHTML(m){if(!m||!Array.isArray(m.evidence)||!m.evidence.length)return '';
  return `<div class="ai-section ai-market"><h3>Market evidence${m.location?` · ${esc(m.location)}`:''}</h3>${m.summary?`<p>${esc(m.summary)}</p>`:''}<ul>${m.evidence.map(e=>`<li><b>${esc(e.what)}:</b> ${esc(e.figure)} <a href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener noreferrer">${esc(e.source||hostOf(e.url))} ↗</a></li>`).join('')}</ul></div>`}
const aiList=(title,items)=>Array.isArray(items)&&items.length?`<div class="ai-section"><h3>${esc(title)}</h3><ul>${items.map(x=>`<li>${esc(String(x))}</li>`).join('')}</ul></div>`:'';
function renderAIAnalysis(a){
  const out=$('#aiDealOutput');if(!a){out.className='ai-output empty';out.innerHTML='<div><h2>Your analysis will appear here</h2><p>One clear verdict, the important numbers, risks and your next actions.</p></div>';return}
  const verdict=String(a.verdict||'Analysis complete'),tone=/strong/i.test(verdict)?'strong':/weak/i.test(verdict)?'weak':'';
  out.className='ai-output';out.innerHTML=`<div class="ai-score"><div><div class="ai-verdict ${tone}">${esc(verdict)}</div><p>${esc(String(a.summary||''))}</p></div><strong>${Math.max(0,Math.min(100,+a.score||0))}<span class="muted" style="font-size:13px">/100</span></strong></div>
    <div class="ai-metrics"><div class="ai-metric"><span>Monthly profit</span><b>${esc(String(a.monthly_profit||'Not enough information'))}</b></div><div class="ai-metric"><span>Upfront cash</span><b>${esc(String(a.upfront_cash||'Not enough information'))}</b></div><div class="ai-metric"><span>Break-even</span><b>${esc(String(a.break_even||'Not enough information'))}</b></div></div>
    ${Array.isArray(a.links_read)&&a.links_read.length?`<div class="ai-links">${a.links_read.map(l=>l.ok?`<p class="ok">✓ Read the listing on <a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(hostOf(l.url))}</a></p>`:`<p class="bad">⚠ Couldn't open the listing on ${esc(hostOf(l.url))}. Copy the advert text from the page and paste it in, then analyse again.</p>`).join('')}</div>`:''}
    ${a._strategy&&a._strategy!=='auto'?`<p class="ai-as">Analysed as <b>${esc(stratName(a._strategy))}</b></p>`:''}
    ${Array.isArray(a.strategy_metrics)&&a.strategy_metrics.length?`<div class="ai-smetrics">${a.strategy_metrics.slice(0,8).map(m=>`<div><span>${esc(String(m&&m.label||''))}</span><b>${esc(String(m&&m.value||''))}</b></div>`).join('')}</div>`:''}
    ${a.better_strategy?`<div class="alert"><b>Another strategy may suit this better.</b> ${esc(String(a.better_strategy))}</div>`:''}
    ${Array.isArray(a.occupancy_scenarios)&&a.occupancy_scenarios.length?aiList('Occupancy scenarios',a.occupancy_scenarios.map(o=>`${o.occupancy}: ${o.monthly_profit}`)):''}${Array.isArray(a.stress_tests)&&a.stress_tests.length?aiList('Stress tests',a.stress_tests.map(t=>`${t.scenario}: ${t.monthly_profit}${t.still_works===false?' (fails)':t.still_works?' (still works)':''}`)):''}${Array.isArray(a.red_flags)&&a.red_flags.length?`<div class="ai-section ai-flags"><h3><span aria-hidden="true">⚠</span> Red flags</h3><ul>${a.red_flags.map(x=>`<li>${esc(String(x))}</li>`).join('')}</ul></div>`:''}${localHTML(a.local_context,a.market_evidence)}${marketHTML(a.market_evidence)}${aiList('Important risks',a.risks)}${aiList('Assumptions',a.assumptions)}${aiList('Missing information',a.missing_information)}${aiList('What to do next',a.next_actions)}${a._level==='quick'?scoutMore('analyse'):''}`}
renderAIAnalysis(S.deal.aiAnalysis);
/* power levels: ids must match LEVELS in netlify/lib/ai.mts */
const AI_LEVELS=[{id:'quick',name:'Scout',desc:'Quick first look',use:'Uses the least credits'},{id:'standard',name:'Analyst',desc:'Full, detailed analysis',use:'Uses more credits'},{id:'deep',name:'Expert',desc:'Stress-tested, thorough',use:'Uses the most credits'}];
const AIC={info:null,level:(()=>{try{return localStorage.getItem('dealpro:ai-level')||'quick'}catch(e){return 'quick'}})()};
/* time estimates in seconds, from how much work each level does */
const EST_S={analyse:{quick:40,standard:100,deep:240},dd:{quick:30,standard:90,deep:240},search:{quick:120,standard:300,deep:1200}};
// Sites are searched side by side, so more sites add a little time rather than multiplying it.
function estSecs(kind,lv,sites){const b=EST_S[kind][lv]||60;let n=1;try{n=Math.max(1,String(S.find.f.loc||'').split(/\s*(?:[,;/]|\band\b|\bor\b|&)\s*/i).filter(x=>x.trim().length>1).length)}catch(e){}
  return kind==='search'?Math.round(b*(1+Math.max(0,(sites||6)-4)*.08)*(1+Math.min(5,n-1)*.25)):b}
const durTxt=s=>s<60?`${Math.max(5,Math.round(s/5)*5)} sec`:`${Math.round(s/60)} min`;
function estTxt(kind,lv,sites){if(kind==='search'&&lv==='deep')return '15–30 min';const s=estSecs(kind,lv,sites);
  return s<60?durTxt(s):s<120?'1–2 min':`${Math.round(s/60*.8)}–${Math.round(s/60*1.3)} min`}
// Time left: starts from the estimate and, once real progress is known, follows the actual pace.
function leftTxt(est,elapsed,frac){let total=est;if(frac>.1&&elapsed>15)total=(est+elapsed/frac)/2;const left=total-elapsed;
  return left>10?`about ${durTxt(left)} left`:elapsed>est*1.5?'taking a little longer than usual':'almost done'}
const LEVEL_KIND={aiLevel:'analyse',fLevel:'search',ddLevel:'dd'};
const findSiteCount=()=>{try{return SITES.filter(s=>S.find.f.sites[s]).length||1}catch(e){return 6}};
function levelOpts(name){const i=AIC.info,free=!i||i.free||i.scoutOnly;// locked until the server confirms a plan with every level
  return AI_LEVELS.map(l=>{const locked=free&&l.id!=='quick';
    return `<label class="ai-level lv-${l.id}${locked?' locked':''}"><input type="radio" name="${name}" value="${l.id}"${AIC.level===l.id?' checked':''}${locked?' disabled':''}><b><i class="lv-dot" aria-hidden="true"></i>${esc(l.name)}</b><span>${esc(l.desc)}</span><span class="lv-use">${locked?'Premium and Max':esc(l.use)}</span><span class="lv-time" data-kind="${LEVEL_KIND[name]}" data-lv="${l.id}">Takes ~${estTxt(LEVEL_KIND[name],l.id,findSiteCount())}</span></label>`}).join('')}
function renderAILevels(){const i=AIC.info,free=!i||i.free||i.scoutOnly;if(free&&AIC.level!=='quick')AIC.level='quick';
  $('#aiLevelOpts').innerHTML=levelOpts('aiLevel');$('#fLevelOpts').innerHTML=levelOpts('fLevel');$('#ddLevelOpts').innerHTML=levelOpts('ddLevel');
  const paid=i?(i.plan==='Admin'?'Admin: unlimited credits.':`${i.creditsLeft} of ${i.weeklyCredits} credits left this week${i.resetsAt?`, resets ${fmtDate(i.resetsAt)}`:''}.${i.scoutOnly?' Upgrade to Premium for Analyst and Expert.':''}`):'';
  $('#aiCredits').textContent=!i?'':i.free?`Free plan: ${i.freeLeft} of 2 free analyses left. Upgrade for Analyst and Expert.`:paid;
  $('#fCredits').textContent=!i?'':i.free?`Free plan: ${i.freeSearchesLeft} of 3 searches left this week. Upgrade for Analyst and Expert.`:paid}
async function loadAICredits(){if(!document.body.dataset.userId)return;try{const r=await fetch('/api/analyze-deal',{credentials:'same-origin'});if(r.ok){AIC.info=await r.json();renderAILevels()}}catch(e){}}
['#aiLevelOpts','#fLevelOpts','#ddLevelOpts'].forEach(id=>$(id).addEventListener('change',e=>{if(e.target.type==='radio'){AIC.level=e.target.value;try{localStorage.setItem('dealpro:ai-level',AIC.level)}catch(err){}renderAILevels()}}));
renderAILevels();window.addEventListener('dealpro:signed-in',loadAICredits);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* strategy to analyse for: 'auto' lets the AI pick */
const STRAT_OPTS=[['auto','Auto','Works out which strategy the details describe or suit best.']].concat(STRATS);
// Photos the listing reader found go to the deal, for its deal pack (ones the user added by link are kept).
function takePhotos(a){const found=[...new Set(((a&&a.links_read)||[]).flatMap(l=>Array.isArray(l.photos)?l.photos:[]))].filter(u=>/^https:\/\//.test(u));if(!found.length)return;
  const prev=dealPhotos(),was=new Map(prev.map(x=>[x.url,x.on]));S.deal.photos=found.map(url=>({url,on:was.has(url)?was.get(url):true})).concat(prev.filter(x=>x.added&&!found.includes(x.url)))}
const aiStrat=()=>STRAT_OPTS.some(x=>x[0]===S.deal.aiStrategy)?S.deal.aiStrategy:'auto';
function renderStratOpts(){const cur=aiStrat();
  $('#aiStratOpts').innerHTML=STRAT_OPTS.map(([k,n,d])=>`<label class="ai-strat" title="${esc(d)}"><input type="radio" name="aiStrat" value="${k}"${k===cur?' checked':''}><span>${esc(n)}</span></label>`).join('');
  $('#aiStratDesc').textContent=(STRAT_OPTS.find(x=>x[0]===cur)||STRAT_OPTS[0])[2]}
$('#aiStratOpts').addEventListener('change',e=>{if(e.target.name!=='aiStrat')return;const v=e.target.value;S.deal.aiStrategy=v;if(v!=='auto'){S.deal.strat=v;try{$('#dStrat').value=v}catch(err){}if(typeof renderMeta==='function')renderMeta()}save();renderStratOpts()});
renderStratOpts();window.addEventListener('dealpro:signed-in',renderStratOpts);
$('#analyseWithAI').addEventListener('click',async()=>{const input=$('#aiDealInput').value.trim(),btn=$('#analyseWithAI'),status=$('#aiDealStatus');if(!input){status.textContent='Paste the deal information first.';$('#aiDealInput').focus();return}
  const lv=AI_LEVELS.find(l=>l.id===AIC.level)||AI_LEVELS[0];
  btn.disabled=true;btn.textContent='Analysing…';const hasLink=/https?:\/\//i.test(input),extraS=hasLink?40:0;status.textContent=`${lv.name} analysis started${hasLink?', reading the listing first':''}. This usually takes ${hasLink?durTxt(estSecs('analyse',lv.id)+extraS):estTxt('analyse',lv.id)}.`;
  try{const r=await fetch('/api/analyze-deal',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'analyse',deal:(S.deal.area&&!input.toLowerCase().includes(S.deal.area.trim().toLowerCase())?`Location: ${S.deal.area.trim()}\n\n`:'')+input,level:lv.id,...(aiStrat()!=='auto'?{strategy:aiStrat()}:{})})});const start=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(start.error||'Analysis failed.');if(start.credits){AIC.info=start.credits;renderAILevels()}
    const t0=Date.now();let data;
    for(;;){await sleep(2000);const p=await fetch('/api/analyze-deal?job='+encodeURIComponent(start.jobId),{credentials:'same-origin'});data=await p.json().catch(()=>({}));
      if(!p.ok)throw new Error(data.error||'Analysis failed.');if(data.credits){AIC.info=data.credits;renderAILevels()}
      if(data.status==='done')break;if(data.status==='error')throw new Error(data.error||'Analysis failed.');
      {const el=Math.round((Date.now()-t0)/1000);status.textContent=`${lv.name} ${hasLink&&el<25?'is reading the listing':'analysis in progress'}… ${el}s · ${leftTxt(estSecs('analyse',lv.id)+extraS,el,0)}`}if(Date.now()-t0>17*60e3)throw new Error('The analysis is taking too long. Please try again.')}
    S.deal.aiAnalysis=Object.assign({},data.analysis,{_level:lv.id,_strategy:aiStrat()});S.deal.sourceText=input;takePhotos(S.deal.aiAnalysis);save();renderAIAnalysis(S.deal.aiAnalysis);saveAIHistory(input,lv);status.textContent='Analysis complete. Verify the flagged information before proceeding.'}
  catch(e){status.textContent=e.message||'The analysis could not be completed. Please try again.'}finally{btn.disabled=false;btn.textContent='Analyse deal'}});
$('#advancedToggle').addEventListener('click',e=>{const on=document.body.classList.toggle('advanced-mode');e.currentTarget.setAttribute('aria-expanded',String(on));e.currentTarget.textContent=on?'Hide advanced controls':'Show advanced controls'});
window.addEventListener('dealpro:save-error',()=>toast('Your latest change could not be saved. Check your connection and try again.'));
$('#contactForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,status=$('#contactStatus'),button=form.querySelector('button[type="submit"]');button.disabled=true;status.textContent='Sending your enquiry…';try{const body=new URLSearchParams(new FormData(form));const r=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});if(!r.ok)throw new Error();form.reset();status.textContent='Thank you. Your enquiry has been sent.'}catch(err){status.textContent='Your enquiry could not be sent. Please email jonahquartey584@gmail.com.'}finally{button.disabled=false}});

/* ---------- history: every finished search and analysis is saved to the account so it can be reopened ---------- */
const HS={kind:'finder',items:[]};
const hsWhen=at=>{const d=new Date(at);return isNaN(d)?'':d.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};
async function histPost(kind,summary,data){try{const r=await fetch('/api/history?kind='+kind,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({summary,data})});if(!r.ok)throw 0}catch(e){console.warn('Could not save to history')}}
function saveFindHistory(lv,nSites){const f=S.find.f,buy=f.mode==='buy',live=(LIVE||[]).filter(confirmedLive).length;
  const beds=Array.isArray(f.beds)&&f.beds.length?` · ${f.beds.join(', ')} bed`:'',price=f.min||f.max?` · ${f.min?'£'+(+f.min).toLocaleString('en-GB'):'Any'}–${f.max?'£'+(+f.max).toLocaleString('en-GB'):'any'}${buy?'':' pcm'}`:'';
  const st=f.strategy&&f.strategy!=='auto'?` · ${STRAT_NAME[f.strategy]||f.strategy}`:'';
  histPost('finder',{title:`${f.loc||'Anywhere in the UK'} · ${buy?'Buy':'Rent'}${beds}${price}`,detail:`${lv.name} · ${live} live listing${live===1?'':'s'} · ${nSites} site${nSites===1?'':'s'}${st}${f.notes?` · “${f.notes.slice(0,90)}”`:''}`,count:live},
    {f,live:LIVE,liveAt:S.find.liveAt,liveSites:S.find.liveSites||{},rank:S.find.rank||null,removed:S.find.removed||0})}
function saveAIHistory(input,lv){const a=S.deal.aiAnalysis||{},first=(input.split('\n').map(x=>x.trim()).find(Boolean)||'Deal').slice(0,120);
  histPost('analyser',{title:first,detail:`${String(a.verdict||'Analysis')} · ${lv.name} · ${stratName(aiStrat())==='auto'?'Strategy chosen automatically':(STRAT_OPTS.find(x=>x[0]===aiStrat())||[,''])[1]}`,score:+a.score},
    {input,analysis:a,strategy:aiStrat(),area:S.deal.area||''})}
function drawHistory(){const L=$('#hsList'),finder=HS.kind==='finder';
  L.innerHTML=HS.items.map(x=>`<li class="hs-item"><div><h3>${esc(x.title)}</h3><p>${esc(hsWhen(x.at))}${x.score!=null&&!finder?` · <span class="hs-score">${x.score}/100</span>`:''}</p></div>
    <div class="hs-acts"><button class="btn sm primary" type="button" data-hs-open="${esc(x.id)}">Open</button><button class="btn ghost sm" type="button" data-hs-del="${esc(x.id)}" aria-label="Delete">Delete</button></div><p style="grid-column:1">${esc(x.detail)}</p></li>`).join('')}
async function openHistory(kind){HS.kind=kind;HS.items=[];const d=$('#histPanel'),st=$('#hsStatus'),finder=kind==='finder';
  $('#hsKicker').textContent=finder?'Deal Finder':'Deal Analyser';$('#hsTitle').textContent=finder?'Previous searches':'Previous analyses';
  $('#hsSub').textContent=finder?'Your last 30 searches are saved to your account. Open one to see what came up.':'Your last 50 analyses are saved to your account. Open one to see the full result again.';
  drawHistory();st.textContent='Loading…';try{d.showModal()}catch(e){d.setAttribute('open','')}
  try{const r=await fetch('/api/history?kind='+kind,{credentials:'same-origin'});const j=await r.json().catch(()=>({}));
    if(r.status===401){st.textContent=`Sign in to see your previous ${finder?'searches':'analyses'}.`;return}if(!r.ok)throw new Error(j.error);
    HS.items=j.items||[];st.textContent=HS.items.length?'':finder?'No searches saved yet. Every search you run from now on appears here.':'No analyses saved yet. Every analysis you run from now on appears here.';drawHistory()}
  catch(e){st.textContent=netMsg(e)||'Could not load your history. Check your connection and try again.'}}
function closeHistory(){const d=$('#histPanel');try{d.close()}catch(e){d.removeAttribute('open')}}
async function loadHistory(id){const st=$('#hsStatus'),finder=HS.kind==='finder',item=HS.items.find(x=>x.id===id)||{};
  if(finder&&FS.busy){st.textContent='Wait for the current search to finish, or cancel it, before opening a previous one.';return}
  st.textContent='Opening…';
  try{const r=await fetch(`/api/history?kind=${HS.kind}&id=${encodeURIComponent(id)}`,{credentials:'same-origin'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error);const e=j.entry||{};
    if(finder){S.find.f=Object.assign(FIND_DEF(),e.f||{});S.find.f.sites=Object.assign(FIND_DEF().sites,(e.f||{}).sites||{});
      LIVE=(Array.isArray(e.live)?e.live:[]).filter(r=>listingLink(r.url));S.find.live=LIVE;S.find.liveAt=e.liveAt||item.at;S.find.liveSites=e.liveSites||{};S.find.rank=e.rank||null;S.find.removed=e.removed||0;S.find.searched=true;
      FS.sel.clear();FS.rank=null;FS.showUnconfirmed=false;restoreRank();bindFind();save();closeHistory();go('find');renderFind();
      toast(`Showing your search from ${hsWhen(item.at)}. Refresh it to check which listings are still live.`);const res=$('#fResults');if(res)res.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'})}
    else{S.deal.aiAnalysis=e.analysis||null;S.deal.sourceText=e.input||'';takePhotos(S.deal.aiAnalysis);$('#aiDealInput').value=e.input||'';if(e.strategy){S.deal.aiStrategy=e.strategy;renderStratOpts()}
      save();closeHistory();go('analyser');renderAIAnalysis(S.deal.aiAnalysis);$('#aiDealStatus').textContent=`Showing your analysis from ${hsWhen(item.at)}. Analyse again for up-to-date figures.`;
      const out=$('#aiDealOutput');if(out)out.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'})}}
  catch(err){st.textContent=netMsg(err)||err.message||'Could not open that entry. Please try again.'}}
async function deleteHistory(id){const st=$('#hsStatus');
  try{const r=await fetch(`/api/history?kind=${HS.kind}&id=${encodeURIComponent(id)}`,{method:'DELETE',credentials:'same-origin'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error);
    HS.items=j.items||[];drawHistory();st.textContent=HS.items.length?'Deleted.':'Deleted. Nothing else is saved.'}
  catch(err){st.textContent=netMsg(err)||'Could not delete that entry. Please try again.'}}
$('#fHistory').addEventListener('click',()=>openHistory('finder'));$('#aiHistory').addEventListener('click',()=>openHistory('analyser'));$('#hsClose').addEventListener('click',closeHistory);
$('#histPanel').addEventListener('click',e=>{const o=e.target.closest('[data-hs-open]'),d=e.target.closest('[data-hs-del]');if(o)loadHistory(o.dataset.hsOpen);else if(d)deleteHistory(d.dataset.hsDel);else if(e.target.id==='histPanel')closeHistory()});

/* ---------- deal community ---------- */
const CM={posts:null,loading:false,error:''};
// Keep in sync with REGIONS in netlify/functions/community.mts.
const REGIONS=['London','South East','East of England','South West','Midlands','North West','North East','Yorkshire and Humber','Scotland','Wales','Northern Ireland','Other'];
const roomId=r=>r.toLowerCase().replace(/[^a-z]+/g,'-');
$$('.js-regions').forEach(sel=>sel.insertAdjacentHTML('beforeend',REGIONS.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('')));
const CF_DEF=()=>({q:'',region:'any',loc:'',priceType:'any',min:'',max:'',type:'any',strat:'any',beds:'any',contacted:'any',age:'any',starred:false,sort:CF&&CF.sort||'new'});
var CF=null;CF=CF_DEF();
async function cApi({url='',...opts}={}){const r=await fetch('/api/community'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong. Please try again.');return d}
// Callers that arrive while a load is running share it, so a shared deal link can wait for the posts.
function loadCommunity(){if(CM.loading)return CM.loading;CM.error='';
  CM.loading=(async()=>{try{const d=await cApi();CM.posts=d.posts||[];CM.posting=d.posting||null;renderPostNote()}catch(e){CM.error=e.message}finally{CM.loading=null}renderCommunityList();renderCNewBadge()})();
  return CM.loading}
// Posting deals needs the Deal Community membership (5 a day), Premium (a monthly allowance) or Max (unlimited); Free can browse, reply and chat.
function renderPostNote(){const p=CM.posting,n=$('#cPostNote');if(!n)return;n.textContent=!p?'':p.left==null?'':p.allowed?`${p.left} of ${p.limit} posts left ${p.period==='day'?'today':'this month'}`:p.limit?(p.period==='day'?'Daily posts used':'Monthly posts used'):'Paid plans'}
function postingBlocked(){const p=CM.posting;if(!p||p.allowed)return false;
  const n=$('#nCommunity')||(()=>{const d=document.createElement('div');d.className='limit-note';d.id='nCommunity';d.setAttribute('role','status');$('#cForm').before(d);return d})();
  n.innerHTML=`<div>${p.limit?p.period==='day'?`You've posted your ${p.limit} deals for today. You can post more tomorrow.`:`You've posted your ${p.limit} deals for this month. Upgrade to Max for unlimited posts.`:'Posting deals needs a paid plan: the Deal Community membership (5 a day, £9.99), Premium (10 a month) or Max (unlimited). You can still browse deals, reply and use the region chat for free.'}</div><div class="ln-a"><button class="btn sm primary" data-go="plans">Upgrade</button><button class="btn sm" data-ln-close>Dismiss</button></div>`;n.hidden=false;return true}
function renderCommunity(){cMarkSeen();const f=$('#cForm');const em=document.body.dataset.userEmail||'';
  if(f&&!f.elements.contactEmail.value)f.elements.contactEmail.value=em;const nm=($('.ws-name')||{}).textContent||'';if(f&&!f.elements.contactName.value&&nm&&nm!==em)f.elements.contactName.value=nm;
  if(CM.posts)renderCommunityList();loadCommunity();if(CH.on)openRoom(CH.room)}
/* finding deals: search, quick filters, sorting, starred deals, saved searches and what's new */
if(!Array.isArray(S.cStars))S.cStars=[];if(!Array.isArray(S.cSearches))S.cSearches=[];
const DAY=864e5;
const cHay=p=>[p.title,p.location,p.postcode,p.region,p.strategy,p.propertyType,p.contacted+' contacted',p.beds===0?'studio':p.beds!=null?p.beds+' bed':'',p.status,p.description].join(' ').toLowerCase();
function cMatch(p,f){const n=v=>v===''||v==null?null:+v,mn=n(f.min),mx=n(f.max),words=(f.q||'').toLowerCase().split(/\s+/).filter(Boolean),loc=(f.loc||'').trim().toLowerCase();
  const hay=words.length?cHay(p):'';
  return words.every(w=>hay.includes(w))&&(!loc||(p.location+' '+p.postcode+' '+p.title).toLowerCase().includes(loc))
    &&(f.region==='any'||p.region===f.region)&&(f.priceType==='any'||p.priceType===f.priceType)&&(mn==null||p.price>=mn)&&(mx==null||p.price<=mx)
    &&(f.type==='any'||p.propertyType===f.type)&&(f.strat==='any'||p.strategy===f.strat)
    &&(f.beds==='any'||(p.beds!=null&&p.beds>=+f.beds))&&(f.contacted==='any'||p.contacted===f.contacted)
    &&(f.age==='any'||Date.now()-Date.parse(p.createdAt)<=+f.age*DAY)&&(!f.starred||S.cStars.includes(p.id))}
const C_SORT={new:(a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt),low:(a,b)=>a.price-b.price,high:(a,b)=>b.price-a.price,talk:(a,b)=>(b.replyCount||0)-(a.replyCount||0)};
function cRows(){return (CM.posts||[]).filter(p=>cMatch(p,CF)).sort(C_SORT[CF.sort]||C_SORT.new)}
// Filters that narrow the list (sorting doesn't count).
const cActive=f=>{const d=CF_DEF();return Object.keys(d).filter(k=>k!=='sort'&&String(f[k]??'')!==String(d[k]))};
function cDescribe(f){const parts=[];if(f.q)parts.push(`“${f.q.trim()}”`);if(f.loc)parts.push(f.loc.trim());if(f.region!=='any')parts.push(f.region);if(f.strat!=='any')parts.push(f.strat);
  if(f.type!=='any')parts.push(f.type);if(f.beds!=='any')parts.push(f.beds==='0'?'Studio+':f.beds+'+ bed');if(f.min!==''||f.max!=='')parts.push(`${f.min!==''?gbp(+f.min):'£0'}–${f.max!==''?gbp(+f.max):'any'}`);
  if(f.priceType!=='any')parts.push(f.priceType==='pcm'?'Rent':'Purchase');if(f.contacted!=='any')parts.push(f.contacted+' contacted');if(f.age!=='any')parts.push(`Last ${f.age==='1'?'24h':f.age+' days'}`);if(f.starred)parts.push('Saved');
  return parts.join(' · ')||'All deals'}
const cIsNew=p=>CM.seenBefore&&Date.parse(p.createdAt)>Date.parse(CM.seenBefore)&&!p.mine;
function bindCF(){const f=CF;$('#cQ').value=f.q;$('#cfRegion').value=f.region;$('#cfLoc').value=f.loc;$('#cfPriceType').value=f.priceType;$('#cfMin').value=f.min;$('#cfMax').value=f.max;
  $('#cfType').value=f.type;$('#cfStrat').value=f.strat;$('#cfBeds').value=f.beds;$('#cfContacted').value=f.contacted;$('#cfAge').value=f.age}
function renderCQuick(){const posts=CM.posts||[],box=$('#cQuick');if(!box)return;
  const strats=[...new Set(posts.map(p=>p.strategy))].sort((a,b)=>posts.filter(p=>p.strategy===b).length-posts.filter(p=>p.strategy===a).length);
  const chip=(key,label,on,count)=>`<button type="button" class="pl-chip" data-cq="${esc(key)}" aria-pressed="${on}">${esc(label)}${count!=null?` <span>${count}</span>`:''}</button>`;
  box.innerHTML=chip('strat:any','All',CF.strat==='any'&&!CF.starred&&CF.age==='any'&&CF.contacted==='any',posts.length)
    +strats.map(k=>chip('strat:'+k,k,CF.strat===k,posts.filter(p=>p.strategy===k).length)).join('')
    +'<span class="cq-div" aria-hidden="true"></span>'
    +chip('age:7','New this week',CF.age==='7',posts.filter(p=>Date.now()-Date.parse(p.createdAt)<=7*DAY).length)
    +chip('contacted:Landlord','Landlord contacted',CF.contacted==='Landlord',posts.filter(p=>p.contacted==='Landlord').length)
    +chip('starred','★ Saved',CF.starred,posts.filter(p=>S.cStars.includes(p.id)).length);
  const ss=$('#cSavedSearches');
  ss.innerHTML=S.cSearches.length?`<span class="muted">Saved searches:</span>${S.cSearches.map(x=>{const fresh=posts.filter(p=>cMatch(p,Object.assign(CF_DEF(),x.f))&&Date.parse(p.createdAt)>Date.parse(x.seen)&&!p.mine).length;
    return `<span class="ss"><button type="button" class="ss-go" data-ss="${esc(x.id)}">${esc(x.name)}${fresh?` <b>${fresh} new</b>`:''}</button><button type="button" class="ss-x" data-ssdel="${esc(x.id)}" aria-label="Delete saved search ${esc(x.name)}">×</button></span>`}).join('')}`:''}
function renderCNewBadge(){const b=$('#cNewBadge');if(!b)return;const since=S.cSeenAt,n=since&&CM.posts?CM.posts.filter(p=>Date.parse(p.createdAt)>Date.parse(since)&&!p.mine).length:0;
  b.hidden=!n||curView==='community';b.textContent=n>9?'9+':String(n);b.title=`${n} new deal${n===1?'':'s'} since your last visit`}
// Opening the Deal Community marks everything as seen, but deals new since the last visit keep their badge until you leave.
function cMarkSeen(){if(CM.seenBefore===undefined)CM.seenBefore=S.cSeenAt||null;S.cSeenAt=new Date().toISOString();save();renderCNewBadge()}
function cCard(p){const price=p.priceType==='purchase'?`${gbp(p.price)} purchase`:`${gbp(p.price)}/month`;
  const subj=encodeURIComponent('Deal Pro: '+p.title);
  const starred=S.cStars.includes(p.id);
  return `<article class="dcard" data-cid="${esc(p.id)}"><div class="c-top"><h3>${cIsNew(p)?'<span class="c-new">New</span>':''}${esc(p.title)}</h3><button type="button" class="c-star${starred?' on':''}" data-cstar="${esc(p.id)}" aria-pressed="${starred}" aria-label="${starred?'Remove from saved deals':'Save this deal'}" title="${starred?'Saved':'Save deal'}">${starred?'★':'☆'}</button></div>
    <div class="ctags">${p.region?`<span class="ctag">${esc(p.region)}</span>`:''}<span class="ctag hot">${esc(p.strategy)}</span><span class="ctag">${esc(p.propertyType)}</span>${p.beds!=null?`<span class="ctag">${p.beds===0?'Studio':p.beds+' bed'}</span>`:''}<span class="ctag">${esc(p.contacted)} contacted</span></div>
    <ul class="adv"><li><span class="em-dot" aria-hidden="true"></span><span>${esc(p.location)}${p.postcode?' '+esc(p.postcode):''}</span></li><li><span class="em-dot" aria-hidden="true"></span><span><b>${price}</b></span></li>${p.status?`<li><span class="em-dot" aria-hidden="true"></span><span>${esc(p.status)}</span></li>`:''}</ul>
    ${p.description?`<p class="cdesc">${esc(p.description)}</p>`:''}
    <div class="dc-foot"><div class="dc-note"><span class="cmeta">Posted by ${esc(p.contactName||'a member')} on ${fmtDate(p.createdAt)}${p.mine?' · your deal':''}</span></div>
      <div class="dc-act"><a class="btn sm primary" href="mailto:${esc(p.contactEmail)}?subject=${subj}">Email</a><button class="btn sm" type="button" data-canalyse="${esc(p.id)}">Analyse</button>${p.contactPhone?`<a class="btn sm" href="tel:${esc(p.contactPhone.replace(/[^+\d]/g,''))}">${esc(p.contactPhone)}</a>`:''}${p.listingUrl?`<a class="btn sm" href="${esc(p.listingUrl)}" target="_blank" rel="noopener nofollow">Listing ↗</a>`:''}<button class="btn sm ghost" type="button" data-clink="${esc(p.id)}">Copy link</button>${p.canDelete?`<button class="btn sm ghost" data-cdel="${esc(p.id)}">Delete</button>`:''}</div>
      <button class="btn sm ghost block" data-creplies="${esc(p.id)}" aria-expanded="${CR.open.has(p.id)}">${CR.open.has(p.id)?'Hide replies':replyLabel(p.replyCount)}</button></div>
    ${CR.open.has(p.id)?`<div class="creplies">${repliesHTML(p.id)}</div>`:''}
  </article>`}
/* ---------- replies on deals ---------- */
const CR={open:new Set(),data:{},error:{}};
const replyLabel=n=>n?`Replies (${n})`:'Reply';
const when=t=>new Date(t).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function noteHTML(n,del){const d=n.deal;
  const card=d?`<div class="msg-deal"><span class="md-k">Posted a deal</span><b>${esc(d.title)}</b><span class="md-s">${esc(d.location)}${d.postcode?' '+esc(d.postcode):''} · ${d.priceType==='purchase'?`${gbp(d.price)} purchase`:`${gbp(d.price)}/month`}</span>
    <div class="ctags"><span class="ctag hot">${esc(d.strategy)}</span><span class="ctag">${esc(d.propertyType)}</span>${d.beds!=null?`<span class="ctag">${d.beds===0?'Studio':d.beds+' bed'}</span>`:''}</div><button class="btn xs primary" type="button" data-viewdeal="${esc(d.id)}">View deal</button></div>`:'';
  return `<div class="msg${n.mine?' mine':''}"><div class="msg-h"><b>${esc(n.mine?'You':n.authorName)}</b><span>${esc(when(n.createdAt))}</span>${n.canDelete?`<button class="msg-del" type="button" ${del}="${esc(n.id)}">Delete</button>`:''}</div><div class="msg-t">${esc(n.text)}</div>${card}</div>`}
function repliesHTML(id){const list=CR.data[id];
  const body=CR.error[id]?`<p class="muted">${esc(CR.error[id])}</p>`:!list?'<p class="muted">Loading replies…</p>':list.length?list.map(n=>noteHTML(n,'data-rdel')).join(''):'<p class="muted">No replies yet. Ask a question or share what you know about this deal.</p>';
  return `${body}<form class="creply-form" data-rform="${esc(id)}"><label class="sr" for="cr-${esc(id)}">Your reply</label><textarea class="inp" id="cr-${esc(id)}" maxlength="1000" placeholder="Write a reply…"></textarea><button class="btn sm primary" type="submit">Reply</button></form>`}
function redrawReplies(id){const card=$(`#cResults .dcard[data-cid="${CSS.escape(id)}"]`);const box=card&&card.querySelector('.creplies');if(!box)return;
  const ta=box.querySelector('textarea'),draft=ta?ta.value:'',focused=document.activeElement===ta;box.innerHTML=repliesHTML(id);
  const nt=box.querySelector('textarea');nt.value=draft;if(focused)nt.focus()}
async function loadReplies(id){delete CR.error[id];try{CR.data[id]=(await cApi({url:'?replies='+encodeURIComponent(id)})).replies||[];
  const p=(CM.posts||[]).find(x=>x.id===id);if(p)p.replyCount=CR.data[id].length}catch(e){CR.error[id]=e.message}redrawReplies(id)}
function renderCommunityList(){const box=$('#cResults');if(!box)return;
  if(CM.error&&!CM.posts){box.innerHTML=`<div class="fempty"><h2>Couldn't load deals</h2><p>${esc(CM.error)}</p><button class="btn sm" id="cRetry">Try again</button></div>`;return}
  if(!CM.posts){box.innerHTML='<div class="fempty"><h2>Loading deals…</h2></div>';return}
  const rows=cRows(),all=CM.posts.length;
  if(!all){box.innerHTML='<div class="fempty"><h2>No deals posted yet</h2><p>Be the first: post a deal where you have already contacted the landlord or agent.</p></div>';return}
  const act=cActive(CF),saved=S.cSearches.some(x=>JSON.stringify(Object.assign(CF_DEF(),x.f,{sort:''}))===JSON.stringify(Object.assign({},CF,{sort:''})));
  renderCQuick();
  box.innerHTML=`<div class="ftool"><div><div class="fsum"><b class="mono">${rows.length}</b> of <b class="mono">${all}</b> deal${all===1?'':'s'}${act.length?` · <span class="muted">${esc(cDescribe(CF))}</span>`:''}</div></div>
    <div class="ph-actions">${act.length?`<button class="btn sm ghost" type="button" data-cclear>Clear filters</button>${saved?'<span class="muted" style="font-size:12.5px">Search saved</span>':'<button class="btn sm" type="button" data-csave>Save this search</button>'}`:''}
      <label class="csort"><span class="sr">Sort deals</span><select class="inp" id="cSort"><option value="new"${CF.sort==='new'?' selected':''}>Newest first</option><option value="low"${CF.sort==='low'?' selected':''}>Price: low to high</option><option value="high"${CF.sort==='high'?' selected':''}>Price: high to low</option><option value="talk"${CF.sort==='talk'?' selected':''}>Most discussed</option></select></label></div></div>`+
    (rows.length?`<div class="cgrid">${rows.map(cCard).join('')}</div>`:`<div class="fempty"><h2>${CF.starred&&!S.cStars.length?'No saved deals yet':'No deals match these filters'}</h2><p>${CF.starred&&!S.cStars.length?'Tap ☆ on a deal to save it here.':'Try a wider price range, another location or a different strategy.'}${act.length&&!saved?' Or save this search, and you’ll see how many new deals match each time you visit.':''}</p>${act.length?'<button class="btn sm" type="button" data-cclear>Clear filters</button>':''}</div>`)}
function readCF(){CF=Object.assign({},CF,{q:$('#cQ').value,region:$('#cfRegion').value,loc:$('#cfLoc').value,priceType:$('#cfPriceType').value,min:$('#cfMin').value,max:$('#cfMax').value,type:$('#cfType').value,strat:$('#cfStrat').value,beds:$('#cfBeds').value,contacted:$('#cfContacted').value,age:$('#cfAge').value});renderCommunityList()}
$('#cQ').addEventListener('input',readCF);
$('#cFilters').addEventListener('input',readCF);$('#cFilters').addEventListener('change',readCF);
$('#cReset').addEventListener('click',()=>{CF=CF_DEF();bindCF();renderCommunityList()});
$('#cQuick').addEventListener('click',e=>{const b=e.target.closest('[data-cq]');if(!b)return;const [k,v]=b.dataset.cq.split(':');const on=b.getAttribute('aria-pressed')==='true';
  if(k==='strat')CF.strat=v==='any'?'any':(on?'any':v);if(v==='any'&&k==='strat'){CF.starred=false;CF.age='any';CF.contacted='any'}
  if(k==='age')CF.age=on?'any':v;if(k==='contacted')CF.contacted=on?'any':v;if(k==='starred')CF.starred=!on;bindCF();renderCommunityList()});
$('#cSavedSearches').addEventListener('click',e=>{const g=e.target.closest('[data-ss]'),x=e.target.closest('[data-ssdel]');
  if(x){S.cSearches=S.cSearches.filter(s=>s.id!==x.dataset.ssdel);save();renderCommunityList();return}
  if(g){const ss=S.cSearches.find(s=>s.id===g.dataset.ss);if(!ss)return;CF=Object.assign(CF_DEF(),ss.f);ss.seen=new Date().toISOString();save();bindCF();renderCommunityList()}});
$('#cResults').addEventListener('change',e=>{if(e.target.id==='cSort'){CF.sort=e.target.value;renderCommunityList()}});
$('#cResults').addEventListener('click',async e=>{
  if(e.target.closest('[data-cclear]')){CF=CF_DEF();bindCF();renderCommunityList();return}
  if(e.target.closest('[data-csave]')){if(S.cSearches.length>=10){toast('You can save up to 10 searches. Delete one first.');return}
    const f={};cActive(CF).forEach(k=>{f[k]=CF[k]});S.cSearches.push({id:'s'+Date.now(),name:cDescribe(CF).slice(0,60),f,seen:new Date().toISOString()});save();renderCommunityList();toast('Search saved. New matching deals will show a count next to it.');return}
  const st=e.target.closest('[data-cstar]');if(st){const id=st.dataset.cstar,i=S.cStars.indexOf(id);if(i>=0)S.cStars.splice(i,1);else S.cStars.push(id);save();renderCommunityList();return}
  const cl=e.target.closest('[data-clink]');if(cl){const url=`${location.origin}/?deal=${encodeURIComponent(cl.dataset.clink)}`;
    try{await navigator.clipboard.writeText(url);toast('Link copied. Signed-in members can open the deal from it.')}catch(err){prompt('Copy this link:',url)}}});
// A shared deal link (/?deal=…) opens that deal once the member is signed in.
window.addEventListener('dealpro:signed-in',()=>{const id=new URLSearchParams(location.search).get('deal');loadCommunity();
  if(id&&/^[\w-]{6,80}$/.test(id)){history.replaceState(null,'',location.pathname);go('community');viewDeal(id)}});
function cFormShow(on){const f=$('#cForm'),t=$('#cPostToggle');f.hidden=!on;t.setAttribute('aria-expanded',String(on));t.textContent=on?'Close form':'Post a deal';
  const m=$('#cMsg');m.textContent='';m.classList.remove('bad');
  // Opened from the region chat: start with that region, and share the deal in its room.
  if(on&&CH.on){const r=REGIONS.find(x=>roomId(x)===CH.room);if(r)f.elements.region.value=r;$('#cSubmit').textContent='Post deal to chat'}else $('#cSubmit').textContent='Post deal';
  if(on){f.elements.title.focus({preventScroll:true});f.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'})}}
$('#cPostToggle').addEventListener('click',()=>{if($('#cForm').hidden&&postingBlocked())return;cFormShow($('#cForm').hidden)});
$('#cCancel').addEventListener('click',()=>cFormShow(false));
$('#cForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,btn=$('#cSubmit'),m=$('#cMsg');
  const body=Object.fromEntries(new FormData(f).entries());if(CH.on)body.announce=true;btn.disabled=true;m.classList.remove('bad');m.textContent='Posting…';
  try{const d=await cApi({method:'POST',body:JSON.stringify(body)});CM.posts=[d.post,...(CM.posts||[])];if(d.posting){CM.posting=d.posting;renderPostNote()}
    ['title','location','postcode','price','beds','status','description','listingUrl'].forEach(k=>{f.elements[k].value=''});f.elements.strategy.value='';f.elements.propertyType.value='';f.elements.region.value='';$('#cPaste').value='';$('#cPasteMsg').textContent='';
    cFormShow(false);renderCommunityList();
    if(d.message&&d.room){CH.msgs[d.room]=[...(CH.msgs[d.room]||[]),d.message];if(CH.on){if(d.room===CH.room){CH.jump=true;renderChat()}else openRoom(d.room)}
      toast(`Your deal is posted and shared in the ${REGIONS.find(x=>roomId(x)===d.room)||''} chat.`)}else toast('Your deal is posted.')}
  catch(err){m.classList.add('bad');m.textContent=err.message}finally{btn.disabled=false}});
$('#cResults').addEventListener('click',async e=>{if(e.target.closest('#cRetry')){loadCommunity();return}
  const rt=e.target.closest('[data-creplies]');if(rt){const id=rt.dataset.creplies;if(CR.open.has(id))CR.open.delete(id);else{CR.open.add(id);loadReplies(id)}renderCommunityList();
    if(CR.open.has(id)){const ta=$(`#cr-${CSS.escape(id)}`);if(ta)ta.focus({preventScroll:true})}return}
  const rd=e.target.closest('[data-rdel]');if(rd){const id=rd.closest('.dcard').dataset.cid;if(!confirm('Delete this reply?'))return;rd.disabled=true;
    try{await cApi({method:'DELETE',body:JSON.stringify({kind:'reply',postId:id,id:rd.dataset.rdel})});CR.data[id]=(CR.data[id]||[]).filter(n=>n.id!==rd.dataset.rdel);
      const p=(CM.posts||[]).find(x=>x.id===id);if(p)p.replyCount=CR.data[id].length;redrawReplies(id);renderCommunityList()}catch(err){rd.disabled=false;toast(err.message)}return}
  const d=e.target.closest('[data-cdel]');if(!d)return;if(!confirm('Delete this deal from the Deal Community?'))return;d.disabled=true;
  try{await cApi({method:'DELETE',body:JSON.stringify({id:d.dataset.cdel})});CM.posts=CM.posts.filter(p=>p.id!==d.dataset.cdel);renderCommunityList();toast('Deal deleted.')}
  catch(err){d.disabled=false;toast(err.message)}});

$('#cResults').addEventListener('submit',async e=>{const f=e.target.closest('[data-rform]');if(!f)return;e.preventDefault();const id=f.dataset.rform,ta=f.querySelector('textarea'),btn=f.querySelector('button'),text=ta.value.trim();
  if(!text){ta.focus();return}btn.disabled=true;
  try{const d=await cApi({method:'POST',body:JSON.stringify({kind:'reply',postId:id,text})});CR.data[id]=[...(CR.data[id]||[]),d.reply];ta.value='';
    const p=(CM.posts||[]).find(x=>x.id===id);if(p)p.replyCount=CR.data[id].length;redrawReplies(id)}
  catch(err){toast(err.message)}finally{btn.disabled=false}});
$('#cResults').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)&&e.target.closest('[data-rform] textarea')){e.preventDefault();e.target.form.requestSubmit()}});

/* ---------- paste a deal into the post form ---------- */
const PC_REGION=[['London',/^(E|EC|N|NW|SE|SW|W|WC|BR|CR|DA|EN|HA|IG|KT|RM|SM|TW|UB)$/],['North East',/^(NE|SR|DH|DL|TS)$/],
  ['Scotland',/^(AB|DD|DG|EH|FK|G|HS|IV|KA|KW|KY|ML|PA|PH|TD|ZE)$/],['Wales',/^(CF|LD|LL|NP|SA)$/],['Northern Ireland',/^(BT)$/],['East of England',/^(CB|CM|CO|IP|NR|PE|SG|SS|LU|AL)$/],
  ['North West',/^(M|L|WA|WN|BL|BB|CH|CW|FY|LA|OL|PR|SK|CA)$/],['Yorkshire and Humber',/^(LS|BD|HD|HG|HU|HX|S|WF|YO|DN)$/],
  ['Midlands',/^(B|CV|DE|DY|LE|NG|NN|ST|WS|WV|WR|HR|TF|LN)$/],['South West',/^(BA|BH|BS|DT|EX|GL|PL|SN|SP|TA|TQ|TR)$/],
  ['South East',/^(BN|CT|GU|ME|MK|OX|PO|RG|RH|SL|SO|TN|HP|WD)$/]];
const CITY_REGION=[['Northern Ireland',/\b(belfast|derry|londonderry|lisburn|newry|bangor,? co down)\b/],['London',/\blondon\b/],
  ['Scotland',/\b(edinburgh|glasgow|aberdeen|dundee|inverness|stirling|perth|paisley|livingston)\b/],['Wales',/\b(cardiff|swansea|newport|wrexham|bangor|aberystwyth|barry)\b/],
  ['East of England',/\b(cambridge|norwich|ipswich|peterborough|colchester|chelmsford|luton|southend|st albans|stevenage|bedford)\b/],['North West',/\b(manchester|liverpool|salford|stockport|bolton|preston|blackpool|chester|warrington|wigan|oldham)\b/],
  ['North East',/\b(newcastle|sunderland|durham|middlesbrough|gateshead)\b/],['Yorkshire and Humber',/\b(leeds|sheffield|bradford|york|hull|huddersfield|wakefield|doncaster|harrogate)\b/],
  ['Midlands',/\b(birmingham|coventry|nottingham|leicester|derby|wolverhampton|stoke|northampton|walsall|worcester|lincoln)\b/],
  ['South West',/\b(bristol|bath|exeter|plymouth|bournemouth|swindon|gloucester|cheltenham|torquay)\b/],
  ['South East',/\b(brighton|oxford|reading|southampton|portsmouth|milton keynes|canterbury|guildford|crawley|watford|slough)\b/]];
function parseDeal(raw){const t=String(raw||''),lo=t.toLowerCase(),out={};
  const clean=l=>l.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,'').replace(/^[\s\-*•·#>]+/,'').replace(/\s+/g,' ').trim();
  const lines=t.split(/\n/).map(clean).filter(Boolean);
  // money: skip deposits, nightly rates and fees; rent if it says per month, purchase if it says price/asking or is large
  const money=[...t.matchAll(/£\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m)?\b/gi)].map(m=>{let v=parseFloat(m[1].replace(/,/g,''));if(/k/i.test(m[2]||''))v*=1e3;if(/m/i.test(m[2]||''))v*=1e6;
    const before=lo.slice(Math.max(0,m.index-28),m.index).split(/[,.;\n]/).pop(),after=lo.slice(m.index+m[0].length,m.index+m[0].length+22);return{v,before,after}})
    .filter(x=>x.v>0&&!/deposit|bond|nightly|per night|a night|fee|cleaning|bills? only|council tax|holding/.test(x.before)&&!/^\s*(per night|a night|\/night|pn\b|nightly|deposit|fee)/.test(x.after));
  const isPcm=x=>/^\s*(pcm|per month|a month|\/month|\/mo\b|p\/?m\b|monthly|per calendar month)/.test(x.after)||/rent|pcm|per month/.test(x.before);
  const isBuy=x=>/price|asking|purchase|guide|offers|for sale|sale|valuation|value|oieo|oiro/.test(x.before)||/^\s*(oieo|oiro|guide|asking)/.test(x.after);
  const pick=money.find(isPcm)||money.find(isBuy)||money[0];
  if(pick){out.price=Math.round(pick.v);out.priceType=isPcm(pick)?'pcm':isBuy(pick)||pick.v>=20000?'purchase':'pcm'}
  const bed=lo.match(/(\d+)\s*(?:-\s*)?(?:bed(?:room)?s?|br)\b/);if(/\bstudio\b/.test(lo))out.beds=0;else if(bed)out.beds=+bed[1];
  out.propertyType=/\bhmo\b/.test(lo)?'HMO':/\bstudio\b/.test(lo)?'Studio':/\b(commercial|office|retail|shop|warehouse|industrial|unit)\b/.test(lo)&&!/\b(flat|house|apartment)\b/.test(lo)?'Commercial'
    :/\b(house|terrace[d]?|semi|detached|bungalow|cottage|townhouse)\b/.test(lo)?'House':/\b(flat|apartment|maisonette|penthouse)\b/.test(lo)?'Flat':'';
  out.strategy=/\b(r2sa|sa|serviced accommodation|short[- ]?lets?|airbnb)\b/.test(lo)?'R2SA':/\b(r2r|rent[- ]to[- ]rent)\b/.test(lo)?'R2R':/\bbrrr\b/.test(lo)?'BRRR'
    :/\blease option\b/.test(lo)?'Lease option':/\b(flip|refurb and sell)\b/.test(lo)?'Flip':/\bhmo\b/.test(lo)?'HMO':/\b(btl|buy[- ]to[- ]let)\b/.test(lo)?'BTL':'';
  const pc=t.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)(?:\s*\d[A-Z]{2})?\b/);if(pc)out.postcode=pc[1];
  // location: a line marked with a pin or Location/Area/Address, else the town before the postcode
  const locLine=(t.split(/\n/).find(l=>/📍/.test(l))||'')||(t.match(/^\s*(?:location|area|address|town)\s*[:\-]\s*(.+)$/im)||[])[1]||'';
  let loc=clean(String(locLine)).replace(/\((?:zone|z)\s*\d[^)]*\)/ig,'').replace(/^(location|area|address|town)\s*[:\-]\s*/i,'');
  if(out.postcode)loc=loc.replace(new RegExp('\\b'+out.postcode+'\\b.*$','i'),'');loc=loc.replace(/[,\s]+$/,'').trim();
  if(!loc&&out.postcode){const m=t.match(new RegExp("([A-Z][a-zA-Z']+(?:\\s+[A-Z][a-zA-Z']+){0,2})[,\\s]+"+out.postcode+"\\b"));if(m&&!/^(HMO|BTL|R2SA|R2R|BRRR|SA)$/.test(m[1]))loc=m[1]}
  if(!loc){const c=[...CITY_REGION.flatMap(([,re])=>[re])].map(re=>(lo.match(re)||[])[0]).find(Boolean);if(c)loc=c.replace(/\b\w/g,x=>x.toUpperCase())}
  if(loc)out.location=loc.slice(0,80);
  const area=out.postcode&&out.postcode.match(/^[A-Z]+/)[0];out.region=(area&&(PC_REGION.find(([,re])=>re.test(area))||[])[0])||(CITY_REGION.find(([,re])=>re.test(lo))||[])[0]||'';
  const url=t.match(/https?:\/\/\S+/);if(url)out.listingUrl=url[0].replace(/[)\].,]+$/,'');
  if(/\bagent\b|letting agency|estate agent/.test(lo))out.contacted='Agent';else if(/\blandlord\b|owner/.test(lo))out.contacted='Landlord';
  // title: the first line that reads like a headline, else built from the details
  const head=lines.find(l=>l.length>=6&&!/^https?:/i.test(l)&&!/^(rent|deposit|nightly|price|location|area|address)\b/i.test(l)&&!/^deal\s*\d/i.test(l)&&l!==clean(String(locLine)));
  const built=[out.beds===0?'Studio':out.beds?out.beds+' bed '+(out.propertyType==='HMO'?'HMO':(out.propertyType||'property').toLowerCase()):out.propertyType,out.location?'in '+out.location:''].filter(Boolean).join(' ');
  out.title=(head&&(head.length<=60||!built)?head:built||head||'').slice(0,120);
  out.description=t.trim().slice(0,2000);return out}
function fillFromPaste(auto){const f=$('#cForm'),msg=$('#cPasteMsg'),text=$('#cPaste').value;if(!text.trim()){if(!auto){msg.textContent='Paste your deal first.';$('#cPaste').focus()}return}
  const d=parseDeal(text),set=[];
  const put=(name,val)=>{if(val===''||val==null)return;const el=f.elements[name];if(!el)return;
    if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===String(val)))return;el.value=String(val);set.push(el)};
  put('title',d.title);put('location',d.location);put('postcode',d.postcode);put('region',d.region);put('strategy',d.strategy);put('propertyType',d.propertyType);
  put('price',d.price);put('priceType',d.priceType);put('beds',d.beds);put('contacted',d.contacted);put('listingUrl',d.listingUrl);
  if(!f.elements.description.value.trim())put('description',d.description);
  set.forEach(el=>{el.classList.remove('filled');void el.offsetWidth;el.classList.add('filled');setTimeout(()=>el.classList.remove('filled'),2200)});
  const missing=['title','location','region','strategy','propertyType','price'].filter(n=>!f.elements[n].value).map(n=>({title:'title',location:'town or area',region:'region',strategy:'strategy',propertyType:'property type',price:'price'})[n]);
  msg.classList.toggle('bad',!!missing.length);
  msg.textContent=set.length?`Filled in ${set.length} field${set.length>1?'s':''}. ${missing.length?`Still needed: ${missing.join(', ')}.`:'Check them, then post.'}`:"Couldn't pick out the details. Fill in the form below."}
$('#cFill').addEventListener('click',()=>fillFromPaste(false));
$('#cPaste').addEventListener('paste',()=>setTimeout(()=>fillFromPaste(true),0));
$('#cAnalyse').addEventListener('click',()=>{const f=$('#cForm'),text=$('#cPaste').value.trim()||postText(Object.fromEntries(new FormData(f).entries()));
  if(!text.replace(/\s|:/g,'').length){$('#cPasteMsg').textContent='Paste your deal or fill in the form first.';return}analyseText(text,f.elements.title.value||parseDeal(text).title)});
// A community deal as text the AI can analyse.
function postText(p){const price=+p.price?(p.priceType==='purchase'?`Purchase price ${gbp(+p.price)}`:`Rent ${gbp(+p.price)} a month`):'';
  return [p.title,[p.location,p.postcode].filter(Boolean).join(' ')&&`Location: ${[p.location,p.postcode].filter(Boolean).join(' ')}`,p.region&&`Region: ${p.region}`,
    p.strategy&&`Strategy: ${p.strategy}`,p.propertyType&&`Property type: ${p.propertyType}`,p.beds!==''&&p.beds!=null&&`Bedrooms: ${+p.beds===0?'Studio':p.beds}`,price,
    p.contacted&&`${p.contacted} already contacted`,p.status&&`Status: ${p.status}`,p.description&&p.description.trim()!==String(p.title).trim()&&p.description,p.listingUrl&&`Listing: ${p.listingUrl}`].filter(Boolean).join('\n')}
$('#cResults').addEventListener('click',e=>{const a=e.target.closest('[data-canalyse]');if(!a)return;const p=(CM.posts||[]).find(x=>x.id===a.dataset.canalyse);if(p)analyseText(postText(p),p.title)});

/* ---------- region chat ---------- */
const CH={on:false,room:roomId(REGIONS[0]),msgs:{},timer:null,loading:false};
const FOLDER='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M1.75 4.25c0-.55.45-1 1-1h3.1l1.4 1.5h6c.55 0 1 .45 1 1v6.5c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1z"/></svg>';
$('#chRooms').innerHTML=REGIONS.map(r=>`<button class="chat-room" type="button" data-room="${roomId(r)}">${FOLDER}<span>${esc(r)}</span></button>`).join('');
function cTab(chat){CH.on=chat;$('#cTabDeals').setAttribute('aria-pressed',String(!chat));$('#cTabChat').setAttribute('aria-pressed',String(chat));
  $('#cDealsPane').hidden=chat;$('#cChatPane').hidden=!chat;cFormShow(false);
  if(chat)openRoom(CH.room);else stopChat()}
function renderChat(){const room=CH.room,list=CH.msgs[room],log=$('#chLog');const atEnd=log.scrollHeight-log.scrollTop-log.clientHeight<40;
  $('#chTitle').textContent=REGIONS.find(r=>roomId(r)===room)||'';
  $$('#chRooms [data-room]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.room===room)));
  log.innerHTML=!list?'<div class="fempty"><h2>Loading messages…</h2></div>':list.length?list.map(n=>noteHTML(n,'data-mdel')).join('')
    :`<div class="fempty"><h2>No messages yet</h2><p>Start the conversation with members in ${esc($('#chTitle').textContent)}.</p></div>`;
  if(atEnd||!list||CH.jump){log.scrollTop=log.scrollHeight;CH.jump=false}}
async function loadRoom(room){if(CH.loading)return;CH.loading=true;
  try{const m=(await cApi({url:'?room='+encodeURIComponent(room)})).messages||[];CH.msgs[room]=m;$('#chErr').textContent=''}catch(e){$('#chErr').textContent=e.message;if(!CH.msgs[room])CH.msgs[room]=[]}
  finally{CH.loading=false}if(room===CH.room)renderChat()}
function stopChat(){clearInterval(CH.timer);CH.timer=null}
function openRoom(room){CH.room=room;CH.jump=true;$('#chErr').textContent='';renderChat();loadRoom(room);stopChat();
  // Check for new messages while the chat is open and the tab is visible.
  CH.timer=setInterval(()=>{if(!CH.on||curView!=='community'){stopChat();return}if(!document.hidden)loadRoom(CH.room)},15000)}
$('#cTabDeals').addEventListener('click',()=>cTab(false));
$('#cTabChat').addEventListener('click',()=>cTab(true));
// Community tutorial: plays when opened, pauses when hidden.
$('#cTut').addEventListener('toggle',e=>{const v=e.currentTarget.querySelector('video');if(e.currentTarget.open){try{v.play().catch(()=>{})}catch(err){}}else v.pause()});
$('#chPost').addEventListener('click',()=>{if(postingBlocked())return;cFormShow(true)});
// "View deal" on a deal shared in the chat: show it in the Deals list with its replies open.
async function viewDeal(id){cTab(false);$('#cReset').click();
  if(CM.loading)await CM.loading;if(!(CM.posts||[]).some(p=>p.id===id))await loadCommunity();
  if(!(CM.posts||[]).some(p=>p.id===id)){toast('That deal has been removed.');return}
  if(!CR.open.has(id)){CR.open.add(id);loadReplies(id)}renderCommunityList();
  const card=$(`#cResults .dcard[data-cid="${CSS.escape(id)}"]`);if(card){card.scrollIntoView({block:'center',behavior:reduced()?'auto':'smooth'});card.classList.remove('just-open');void card.offsetWidth;card.classList.add('just-open')}}
$('#chRooms').addEventListener('click',e=>{const b=e.target.closest('[data-room]');if(b&&b.dataset.room!==CH.room)openRoom(b.dataset.room)});
$('#chForm').addEventListener('submit',async e=>{e.preventDefault();const ta=$('#chText'),btn=$('#chSend'),text=ta.value.trim(),room=CH.room;if(!text){ta.focus();return}
  btn.disabled=true;$('#chErr').textContent='';
  try{const d=await cApi({method:'POST',body:JSON.stringify({kind:'message',room,text})});CH.msgs[room]=[...(CH.msgs[room]||[]),d.message];ta.value='';CH.jump=true;if(room===CH.room)renderChat()}
  catch(err){$('#chErr').textContent=err.message}finally{btn.disabled=false;ta.focus()}});
$('#chText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#chForm').requestSubmit()}});
$('#chLog').addEventListener('click',async e=>{const v=e.target.closest('[data-viewdeal]');if(v){viewDeal(v.dataset.viewdeal);return}
  const b=e.target.closest('[data-mdel]');if(!b||!confirm('Delete this message?'))return;const room=CH.room;b.disabled=true;
  try{await cApi({method:'DELETE',body:JSON.stringify({kind:'message',room,id:b.dataset.mdel})});CH.msgs[room]=(CH.msgs[room]||[]).filter(n=>n.id!==b.dataset.mdel);renderChat()}
  catch(err){b.disabled=false;toast(err.message)}});

/* ---------- tutorial links: centre the video on screen and start it ---------- */
document.addEventListener('click',e=>{const a=e.target.closest('a[href="#tutorial"]');if(!a)return;const sec=$('#tutorial'),media=sec&&sec.querySelector('.tutorial-media');if(!media)return;
  e.preventDefault();media.scrollIntoView({block:'center',behavior:reduced()?'auto':'smooth'});
  sec.classList.remove('is-flash');void sec.offsetWidth;sec.classList.add('is-flash');
  const v=media.querySelector('video');if(v){try{v.play().catch(()=>{})}catch(err){}}});

/* ---------- Qp Digital badge: tuck down to the logo when it would cover a button or link ---------- */
{const qp=$('.qp-badge');let full=0,queued=false;
  const check=()=>{queued=false;if(!qp)return;const r=qp.getBoundingClientRect();if(!qp.classList.contains('is-tucked'))full=r.width;
    const L=r.right-(full||r.width),hit=[.1,.3,.5,.7,.9].some(fx=>[.2,.5,.8].some(fy=>document.elementsFromPoint(L+(r.right-L)*fx,r.top+r.height*fy)
      .some(el=>!qp.contains(el)&&el.matches('a,button,input,select,textarea,label,video,[role="button"]'))));
    qp.classList.toggle('is-tucked',hit)};
  const queue=()=>{if(!queued){queued=true;requestAnimationFrame(check)}};
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});setTimeout(queue,1800)}

/* ---------- refunds ---------- */
const RF_STATUS={pending:'Waiting for review',refunded:'Refunded',approved_manual:'Approved, refund on its way',declined:'Declined'};
/* ---------- referrals: one link; when the friend upgrades, both claim a reward ---------- */
const REF_KEY='dealpro:ref';
// Opening a referral link remembers it until the visitor has an account.
(function(){try{const q=new URLSearchParams(location.search),code=(q.get('ref')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
  if(code){localStorage.setItem(REF_KEY,JSON.stringify({code,at:Date.now()}));q.delete('ref');q.delete('offer');
    history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash);setTimeout(()=>toast("You've been invited to Deal Pro. When you upgrade, you and your friend both get 3 months half price."),1200)}}catch(e){}})();
// After signing in, link the new account to whoever referred it (once).
window.addEventListener('dealpro:signed-in',async()=>{let r=null;try{r=JSON.parse(localStorage.getItem(REF_KEY)||'null')}catch(e){}
  if(!r||Date.now()-r.at>60*864e5){try{localStorage.removeItem(REF_KEY)}catch(e){}return}
  try{const res=await fetch('/api/referrals',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:r.code})});const d=await res.json().catch(()=>({}));
    if(res.ok){try{localStorage.removeItem(REF_KEY)}catch(e){}if(d.ok&&!d.already)toast(`${d.referrerName||'A friend'} referred you. When you upgrade, you both get 3 months half price.`)}}catch(e){}});
let REF=null;
const refClaim=(id,offers)=>Object.entries(offers).map(([o,x])=>`<button class="btn sm primary" type="button" data-ref-claim="${esc(id)}" data-offer="${o}">Claim ${esc(x.name.toLowerCase())}</button>`).join(' ');
const refStatus=(x,offers)=>x.status==='choose'?refClaim(x.id,offers):x.status==='applied'&&x.offerName?`${esc(x.offerName)}: applied`:esc(x.offerName&&x.status!=='waiting'?`${x.offerName}: ${x.text.toLowerCase()}`:x.text);
async function loadReferrals(){const box=$('#referBox');if(!box)return;if(!document.body.dataset.userId){box.innerHTML='<p class="note" style="margin:0">Sign in to get your referral link.</p>';return}
  try{const res=await fetch('/api/referrals',{credentials:'same-origin'});const d=await res.json();if(!res.ok)throw new Error(d.error||'');REF=d;
    const link=`${location.origin}/?ref=${encodeURIComponent(d.code)}`,fmt=t=>t?new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';
    const rewardNames=Object.values(d.offers).map(x=>x.name.toLowerCase()).join(' or ');
    const me=d.referredBy;
    box.innerHTML=`${me?(me.status==='choose'?`<div class="ref-banner"><b>${esc(me.by)}'s referral is complete.</b> Claim your reward: ${refClaim(me.id,d.offers)}</div>`:me.paid?`<p class="ref-banner">Your referral reward: ${refStatus(me,d.offers)}</p>`:`<p class="ref-banner">${esc(me.by)} referred you. When you upgrade, you'll both get ${esc(rewardNames)}.</p>`):''}${d.pendingDiscount?`<p class="ref-banner">You've earned <b>${esc(d.pendingDiscount.toLowerCase())}</b>. It's applied when you upgrade.</p>`:''}
      <p class="note" style="margin:0">Share your link. When a friend signs up and buys an upgraded membership, you both get <b>${esc(rewardNames)}</b>.</p>
      <div class="ref-prices"><span>Premium <s>£39</s> <b>£19.50</b>/mo</span><span>Max 5x <s>£100</s> <b>£50</b>/mo</span><span>Max 20x <s>£200</s> <b>£100</b>/mo</span></div>
      <div class="ref-one"><div class="ref-link"><input class="inp" readonly id="refLink" value="${esc(link)}" aria-label="Your referral link"><button class="btn sm" type="button" data-ref-copy>Copy</button></div>
        <a class="btn sm primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`I use Deal Pro to find and analyse property deals. Sign up with my link and when you upgrade we both get ${rewardNames} (Premium is £19.50 a month instead of £39): ${link}`)}">Send on WhatsApp</a></div>
      ${d.referrals.length?`<div class="tw"><table class="ref-list"><thead><tr><th>Friend</th><th>Signed up</th><th>Your reward</th></tr></thead><tbody>${d.referrals.map(r=>`<tr><td>${esc(r.name)}</td><td>${fmt(r.signedUpAt)}</td><td>${refStatus(r,d.offers)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="note" style="margin:0">No referrals yet. Your code is <b>'+esc(d.code)+'</b>.</p>'}`}
  catch(e){box.innerHTML='<p class="note" style="margin:0">Your referral link couldn\'t load. Refresh the page to try again.</p>'}}
document.addEventListener('click',async e=>{const c=e.target.closest('[data-ref-copy]');if(c){const i=$('#refLink');if(!i)return;
    const sel=()=>{i.focus();i.select();toast('Link selected. Press Ctrl/Cmd+C to copy.')};try{navigator.clipboard.writeText(i.value).then(()=>toast('Link copied.')).catch(sel)}catch(err){sel()}return}
  const b=e.target.closest('[data-ref-claim]');if(!b)return;b.disabled=true;
  try{const res=await fetch('/api/referrals',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({choose:b.dataset.refClaim,offer:b.dataset.offer})});const d=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(d.error||'The reward couldn\'t be claimed. Please try again.');toast(d.status==='applied'?`${d.offerName} claimed and applied.`:`${d.offerName} claimed. It will be applied to your billing shortly.`);loadReferrals()}
  catch(err){toast(err.message);b.disabled=false}});
window.addEventListener('dealpro:signed-in',()=>{if(curView==='plans')loadReferrals()});
async function loadRefunds(){if(!document.body.dataset.userId){$('#refunds').hidden=true;return}$('#refunds').hidden=false;
  try{const r=await fetch('/api/refunds',{credentials:'same-origin'});const d=await r.json();if(!r.ok)throw 0;
    const L=d.requests||[],open=L.some(x=>x.status==='pending');
    $('#rfList').innerHTML=L.length?`<ul class="rf-list">${L.map(x=>`<li><b>${esc(RF_STATUS[x.status]||x.status)}</b> <span class="muted">· requested ${fmtDate(x.createdAt)}${x.amount?` · ${esc(x.amount)} refunded`:''}</span>${x.note?`<div class="muted">${esc(x.note)}</div>`:''}</li>`).join('')}</ul>`:'';
    $('#rfOpen').hidden=open||!$('#rfForm').hidden}catch(e){$('#rfList').innerHTML=''}}
window.addEventListener('dealpro:signed-in',()=>{if(curView==='plans')loadRefunds()});
$('#rfOpen').addEventListener('click',()=>{$('#rfForm').hidden=false;$('#rfOpen').hidden=true;$('#rfReason').focus()});
$('#rfCancel').addEventListener('click',()=>{$('#rfForm').hidden=true;$('#rfOpen').hidden=false;$('#rfMsg').textContent=''});
$('#rfForm').addEventListener('submit',async e=>{e.preventDefault();const m=$('#rfMsg'),b=$('#rfSend');b.disabled=true;m.classList.remove('bad');m.textContent='Sending…';
  try{const r=await fetch('/api/refunds',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:$('#rfReason').value})});const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Your request could not be sent.');$('#rfReason').value='';$('#rfForm').hidden=true;m.textContent='';toast("Refund request sent. We'll review it within 2 working days.");loadRefunds()}
  catch(err){m.classList.add('bad');m.textContent=err.message}finally{b.disabled=false}});

/* ---------- video chapters (YouTube-style) ---------- */
const mmss=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
$$('.tutorial-media .chap').forEach(box=>{const video=box.parentElement.querySelector('video');let CH=[];try{CH=JSON.parse(box.dataset.chapters)}catch(e){}
  if(!video||!CH.length)return;const list=box.closest('.tutorial')?.querySelector('.chap-list');
  const dur=()=>isFinite(video.duration)&&video.duration>0?video.duration:CH[CH.length-1].t+30;
  const end=i=>i+1<CH.length?CH[i+1].t:dur();
  box.innerHTML=`<div class="chap-now"><span>Chapter: <b class="chap-title">${esc(CH[0].title)}</b></span><span class="chap-time mono">0:00</span></div><div class="chap-bar" role="group" aria-label="Chapters">${CH.map((c,i)=>`<button type="button" class="chap-seg" data-i="${i}" aria-label="${mmss(c.t)} ${esc(c.title)}"><span class="chap-fill"></span></button>`).join('')}</div><div class="chap-tip" hidden></div>`;
  if(list)list.innerHTML=CH.map((c,i)=>`<li><button type="button" data-i="${i}"><span class="t">${mmss(c.t)}</span><span>${esc(c.title)}</span></button></li>`).join('');
  const segs=[...box.querySelectorAll('.chap-seg')],tip=box.querySelector('.chap-tip');
  const size=()=>segs.forEach((s,i)=>{s.style.flexGrow=String(Math.max(1,end(i)-CH[i].t))});
  const seek=i=>{video.currentTime=CH[i].t+0.01;video.play().catch(()=>{})};
  const sync=()=>{const t=video.currentTime;let cur=0;CH.forEach((c,i)=>{if(t>=c.t)cur=i});
    segs.forEach((s,i)=>{const f=Math.max(0,Math.min(1,(t-CH[i].t)/Math.max(0.1,end(i)-CH[i].t)));s.firstChild.style.width=(f*100)+'%'});
    box.querySelector('.chap-title').textContent=CH[cur].title;box.querySelector('.chap-time').textContent=`${mmss(t)} / ${mmss(dur())}`;
    if(list)list.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('on',i===cur))};
  box.addEventListener('click',e=>{const s=e.target.closest('.chap-seg');if(!s)return;const i=+s.dataset.i,r=s.getBoundingClientRect();
    video.currentTime=CH[i].t+(end(i)-CH[i].t)*Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));video.play().catch(()=>{})});
  box.addEventListener('mousemove',e=>{const s=e.target.closest('.chap-seg');if(!s){tip.hidden=true;return}const i=+s.dataset.i,r=s.getBoundingClientRect(),br=box.getBoundingClientRect();
    const t=CH[i].t+(end(i)-CH[i].t)*Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    tip.innerHTML=`<b>${mmss(t)}</b>${esc(CH[i].title)}`;tip.hidden=false;tip.style.left=Math.max(70,Math.min(br.width-70,e.clientX-br.left))+'px'});
  box.addEventListener('mouseleave',()=>{tip.hidden=true});
  if(list)list.addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(b){seek(+b.dataset.i);box.closest('.tutorial').scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'})}});
  // Only show chapters when the video actually runs that long (an older, shorter video hides them).
  const fits=()=>{const ok=isFinite(video.duration)&&video.duration>=CH[CH.length-1].t;box.hidden=!ok;if(list)list.hidden=!ok;return ok};
  box.hidden=true;if(list)list.hidden=true;
  video.addEventListener('loadedmetadata',()=>{if(fits()){size();sync()}});video.addEventListener('timeupdate',()=>{if(!box.hidden)sync()});if(video.readyState>=1&&fits()){size();sync()}});

/* ---------- keep the plan in sync with Stripe ---------- */
// After checkout or the customer portal, Stripe tells the server via the webhook a few seconds
// later. Check the account until the plan changes, then reload so the whole site reflects it.
async function remotePlan(){try{const r=await fetch('/api/account-state',{credentials:'same-origin'});if(!r.ok)return null;const d=await r.json();return d.state||null}catch(e){return null}}
function applyRemote(st,note){try{localStorage.setItem('dealpro:state',JSON.stringify(st));if(note)sessionStorage.setItem('dealpro:plan-changed',st.plan)}catch(e){}location.reload()}
async function watchBilling(){let b=null;try{b=JSON.parse(sessionStorage.getItem('dealpro:billing')||'null')}catch(e){}
  const back=/[?&]billing=1/.test(location.search);if(!b&&!back)return;
  if(back)history.replaceState(null,'',location.pathname);
  const from=b?b.from:S.plan,until=Date.now()+90e3;if(b)toast('Checking your subscription…');
  while(Date.now()<until){const st=await remotePlan();
    if(st&&st.plan&&st.plan!==from){try{sessionStorage.removeItem('dealpro:billing')}catch(e){}applyRemote(st,true);return}
    await new Promise(r=>setTimeout(r,3000))}
  try{sessionStorage.removeItem('dealpro:billing')}catch(e){}
  if(b)toast("Your payment is still being confirmed. Your plan will update shortly; refresh in a minute.")}
window.addEventListener('dealpro:signed-in',()=>{let changed=null;try{changed=sessionStorage.getItem('dealpro:plan-changed');sessionStorage.removeItem('dealpro:plan-changed')}catch(e){}
  if(changed)toast(`You're now on the ${(PLAN_DEFS[changed]||{name:changed}).name} plan.`);watchBilling()});
// Coming back to the tab: pick up a plan change made elsewhere (for example by the admin).
document.addEventListener('visibilitychange',async()=>{if(document.hidden||!document.body.dataset.userId)return;const st=await remotePlan();if(st&&st.plan&&st.plan!==S.plan)applyRemote(st,true)});
$('#managePlan').addEventListener('click',()=>{if(S.stripe&&S.stripe.customer&&S.plan!=='Free')openPortal();else go('plans')});

/* ---------- boot ---------- */
const siteIntro=$('#siteIntro');if(siteIntro)setTimeout(()=>{siteIntro.remove();document.documentElement.classList.remove('si-wait')},6000);
renderTop();bindDeal();bindFind();syncFee();
let tab='home';try{tab=sessionStorage.getItem('dealpro:tab')||'home'}catch(e){}
go(tab);
})();
