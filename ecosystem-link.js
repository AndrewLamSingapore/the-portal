const ECOSYSTEM_APPS={
  portal:'https://the-portal-ten.vercel.app/',
  authorityEngine:'https://authority-engine-app.vercel.app/',
  gamePlatform:'https://game-platform-wine-nine.vercel.app/',
  github:'https://github.com/AndrewLamSingapore'
};
const host=location.hostname;
const current=host.startsWith('the-portal')?'portal':host.startsWith('game-platform')?'gamePlatform':host.startsWith('authority-engine')?'authorityEngine':'';
const campaign='lam_ecosystem_v1';
export function buildEcosystemUrl(destination,placement='top_nav'){
  const url=new URL(ECOSYSTEM_APPS[destination]);
  if(destination!=='github'){url.searchParams.set('utm_source',current||'ecosystem');url.searchParams.set('utm_medium','cross_app');url.searchParams.set('utm_campaign',campaign);url.searchParams.set('utm_content',placement)}
  return url.toString()
}
export function captureIncomingReferral(){
  const q=new URLSearchParams(location.search),source=q.get('utm_source');
  if(!source)return null;
  const referral={source,medium:q.get('utm_medium')||'',campaign:q.get('utm_campaign')||'',placement:q.get('utm_content')||'',received_at:new Date().toISOString()};
  sessionStorage.setItem('ecosystem_referral',JSON.stringify(referral));
  trackEcosystemVisit('ecosystem_referral_received',{...referral,destination:current});
  return referral
}
export function trackEcosystemVisit(event,properties={}){
  const payload={event,properties:{...properties,app:current},occurred_at:new Date().toISOString()};
  if(typeof window.gamePlatformTrack==='function')window.gamePlatformTrack(event,payload.properties);
  else if(typeof window.analytics?.track==='function')window.analytics.track(event,payload.properties);
  else if(current==='portal')fetch('/api/ecosystem-event',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});
}
function link(destination,label,placement){
  const a=document.createElement('a');a.href=buildEcosystemUrl(destination,placement);a.textContent=label;a.dataset.ecosystemDestination=destination;
  if(destination===current)a.setAttribute('aria-current','page');
  a.addEventListener('click',()=>trackEcosystemVisit('ecosystem_link_clicked',{destination,placement}));
  return a
}
const nav=document.createElement('nav');nav.className='ecosystem-nav';nav.setAttribute('aria-label','Lam ecosystem');
nav.append(link('portal','The Portal','top_nav'),link('authorityEngine','Authority Engine','top_nav'),link('gamePlatform','Game Platform','top_nav'),link('github','GitHub','top_nav'));
document.querySelector('header')?.after(nav);
if(current==='portal'){
  const cta=link('gamePlatform','PLAY LIVING WORLDS →','portal_hero');cta.className='primary ecosystem-cta-primary';document.querySelector('.hero-actions')?.append(cta);
}
if(current==='gamePlatform'){
  const back=link('portal','← Return to The Portal','game_return_link');back.className='ecosystem-link-subtle';document.querySelector('#play>.row>div')?.append(back);
}
captureIncomingReferral();
