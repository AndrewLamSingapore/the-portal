(()=>{
const root=document.getElementById('portalCinematic'),skip=document.getElementById('cinematicSkip'),replay=document.getElementById('cinematicReplay');if(!root||!skip)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let timers=[],animations=[],priorFocus=null;
const seen=()=>{try{return sessionStorage.getItem('portal-cinematic-seen')==='1'}catch{return false}};
const markSeen=()=>{try{sessionStorage.setItem('portal-cinematic-seen','1')}catch{}};
const clear=()=>{timers.forEach(clearTimeout);timers=[];animations.forEach(a=>{try{a.cancel()}catch{}});animations=[]};
const animate=(el,frames,options)=>{if(el)animations.push(el.animate(frames,options))};
const later=(fn,delay)=>timers.push(setTimeout(fn,delay));
function run(){
 const art=root.querySelector('.cinematic-art'),veil=root.querySelector('.cinematic-veil'),rings=[...root.querySelectorAll('.cinematic-ring')],nodes=[...root.querySelectorAll('.cinematic-node')],beats=[...root.querySelectorAll('.cinematic-beat')],title=root.querySelector('.cinematic-wordmark'),meta=root.querySelector('.cinematic-meta');
 if(reduced){root.dataset.scene='final';[title,meta].forEach(el=>el&&(el.style.opacity='1'));return}
 animate(art,[{transform:'scale(1.14) translate3d(0,2%,0)',filter:'brightness(.26) saturate(.72)'},{transform:'scale(1.07) translate3d(0,0,0)',filter:'brightness(.58) saturate(.9)',offset:.42},{transform:'scale(1.015) translate3d(0,-1%,0)',filter:'brightness(.84) saturate(1.03)'}],{duration:10800,fill:'both',easing:'cubic-bezier(.16,.78,.18,1)'});
 animate(veil,[{opacity:1},{opacity:.48,offset:.24},{opacity:.14,offset:.72},{opacity:.32}],{duration:10800,fill:'both'});
 rings.forEach((ring,i)=>animate(ring,[{opacity:0,transform:`translate(-50%,-50%) scale(.7) rotate(${i%2?-18:18}deg)`},{opacity:.72,offset:.28,transform:'translate(-50%,-50%) scale(1.02) rotate(0deg)'},{opacity:.28,transform:`translate(-50%,-50%) scale(1.08) rotate(${i%2?8:-8}deg)`}],{duration:9000,delay:400+i*180,fill:'both',easing:'cubic-bezier(.2,.72,.2,1)'}));
 nodes.forEach((node,i)=>animate(node,[{opacity:0,transform:'scale(0)'},{opacity:.95,transform:'scale(1.25)',offset:.55},{opacity:.38,transform:'scale(1)'}],{duration:2600,delay:900+i*240,fill:'both',easing:'ease-out'}));
 beats.forEach((beat,i)=>animate(beat,[{opacity:0,transform:'translateY(18px)',filter:'blur(8px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)',offset:.24},{opacity:1,offset:.7},{opacity:0,transform:'translateY(-12px)',filter:'blur(5px)'}],{duration:2300,delay:700+i*1900,fill:'both',easing:'cubic-bezier(.2,.75,.2,1)'}));
 animate(title,[{opacity:0,letterSpacing:'.52em',transform:'translateY(16px)',filter:'blur(10px)'},{opacity:1,letterSpacing:'.24em',transform:'translateY(0)',filter:'blur(0)',offset:.5},{opacity:1,letterSpacing:'.2em'}],{duration:2500,delay:7600,fill:'both',easing:'cubic-bezier(.16,.8,.22,1)'});
 animate(meta,[{opacity:0,transform:'translateY(8px)'},{opacity:.82,transform:'translateY(0)'}],{duration:1200,delay:8650,fill:'both'});
 later(()=>root.dataset.scene='open',180);later(()=>root.dataset.scene='threshold',5900);later(()=>root.dataset.scene='final',7600);
}
function close(){clear();root.classList.remove('is-running','is-active');root.setAttribute('aria-hidden','true');document.body.classList.remove('cinematic-locked');markSeen();later(()=>{root.hidden=true;priorFocus?.focus?.()},700)}
function open(){clear();priorFocus=document.activeElement;root.hidden=false;root.dataset.scene='opening';root.setAttribute('aria-hidden','false');document.body.classList.add('cinematic-locked');requestAnimationFrame(()=>{root.classList.add('is-active','is-running');skip.focus();run()});later(close,reduced?3600:10800)}
skip.addEventListener('click',close);replay?.addEventListener('click',open);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.classList.contains('is-active'))close()});if(!seen())open();
})();
