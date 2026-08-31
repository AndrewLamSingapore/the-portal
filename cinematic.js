(()=>{const root=document.getElementById('portalCinematic'),skip=document.getElementById('cinematicSkip'),replay=document.getElementById('cinematicReplay');if(!root||!skip)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let timers=[],animations=[],priorFocus=null;
const seen=()=>{try{return sessionStorage.getItem('portal-cinematic-seen')==='1'}catch{return false}};const markSeen=()=>{try{sessionStorage.setItem('portal-cinematic-seen','1')}catch{}};
const clear=()=>{timers.forEach(clearTimeout);timers=[];animations.forEach(item=>{try{item.cancel()}catch{}});animations=[]};
const animate=(el,frames,options)=>{if(!el)return;animations.push(el.animate(frames,options))};
function premium(duration){
  const aperture=root.querySelector('.cinematic-aperture'),noise=root.querySelector('.cinematic-noise'),lines=[...root.querySelectorAll('.cinematic-line')],title=root.querySelector('.cinematic-title');
  if(reduced){animate(root,[{opacity:.4},{opacity:1}],{duration:1200,fill:'both'});animate(title,[{opacity:0},{opacity:1}],{duration:900,delay:500,fill:'both'});return}
  animate(root,[{filter:'brightness(.08)'},{filter:'brightness(1.2)',offset:.08},{filter:'brightness(.9)',offset:.7},{filter:'brightness(.72)'}],{duration,fill:'both'});
  animate(aperture,[{transform:'scale(.03) rotate(-55deg)',opacity:0},{transform:'scale(.34) rotate(-18deg)',opacity:.55,offset:.23},{transform:'scale(1.08) rotate(18deg)',opacity:1,offset:.76},{transform:'scale(.94) rotate(4deg)',opacity:.42}],{duration,fill:'both',easing:'cubic-bezier(.14,.78,.2,1)'});
  animate(noise,[{transform:'translate(0,0)'},{transform:'translate(-3%,2%)'},{transform:'translate(2%,-3%)'},{transform:'translate(-1%,1%)'}],{duration:460,iterations:Infinity});
  const starts=[700,2400,4100,5800];lines.forEach((line,index)=>animate(line,[{opacity:0,transform:'translateY(24px) scale(.97)',filter:'blur(7px)'},{opacity:1,transform:'none',filter:'blur(0)',offset:.25},{opacity:1,transform:'none',filter:'blur(0)',offset:.72},{opacity:0,transform:'translateY(-12px)',filter:'blur(3px)'}],{duration:1700,delay:starts[index],fill:'both',easing:'ease-out'}));
  animate(title,[{opacity:0,transform:'scale(.72)',letterSpacing:'.28em',filter:'blur(12px)'},{opacity:1,transform:'scale(1.05)',letterSpacing:'.1em',filter:'blur(0)',offset:.55},{opacity:1,transform:'scale(1)',letterSpacing:'.1em',filter:'blur(0)'}],{duration:2400,delay:7350,fill:'both',easing:'cubic-bezier(.16,.8,.22,1)'});
}
function close(){timers.forEach(clearTimeout);timers=[];root.classList.remove('is-running');root.classList.remove('is-active');root.setAttribute('aria-hidden','true');document.body.classList.remove('cinematic-locked');markSeen();setTimeout(()=>{root.hidden=true;priorFocus?.focus?.()},850)}
function open(){clear();priorFocus=document.activeElement;root.hidden=false;root.setAttribute('aria-hidden','false');root.dataset.beat=reduced?'5':'0';document.body.classList.add('cinematic-locked');requestAnimationFrame(()=>{root.classList.add('is-active');root.classList.add('is-running');skip.focus();premium(reduced?1800:10200)});if(reduced){timers.push(setTimeout(close,2200));return}[[900,1],[2600,2],[4300,3],[6000,4],[7800,5]].forEach(([ms,beat])=>timers.push(setTimeout(()=>root.dataset.beat=String(beat),ms)));timers.push(setTimeout(close,11000))}
skip.addEventListener('click',close);replay?.addEventListener('click',open);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.classList.contains('is-active'))close()});if(!seen())open();
})();
