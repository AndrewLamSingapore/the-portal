const ECOSYSTEM_APPS={
  portal:'https://the-portal-ten.vercel.app/',
  authorityEngine:'https://authority-engine-app.vercel.app/',
  gamePlatform:'https://game-platform-wine-nine.vercel.app/',
  velyqua:'https://velyqua.vercel.app/',
  skyTablet:'https://sky-tablet.vercel.app/',
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
  try { sessionStorage.setItem('ecosystem_referral',JSON.stringify(referral)); } catch { /* Navigation remains available when storage is disabled. */ }
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
nav.append(link('portal','The Portal','top_nav'),link('authorityEngine','Authority Engine','top_nav'),link('gamePlatform','Living Worlds','top_nav'),link('velyqua','VELYQUA','top_nav'),link('skyTablet','Sky Tablet','top_nav'),link('github','GitHub','top_nav'));
document.querySelector('header')?.after(nav);
if(current==='portal'){
  const cta=link('gamePlatform','PLAY LIVING WORLDS →','portal_hero');cta.className='primary ecosystem-cta-primary';document.querySelector('.hero-actions')?.append(cta);
}
if(current==='gamePlatform'){
  const back=link('portal','← Return to The Portal','game_return_link');back.className='ecosystem-link-subtle';document.querySelector('#play>.row>div')?.append(back);
}
const source = current === 'gamePlatform' ? 'game-platform' : current === 'portal' ? 'portal' : 'authority-engine';
const contactUrl = `https://authority-engine-app.vercel.app/contact?source=${source}`;
const contact = document.createElement('a'); contact.href = contactUrl; contact.textContent = 'Talk with Andrew ↗'; contact.className = 'ecosystem-talk'; nav.append(contact);
const bridge = document.createElement('section'); bridge.className = 'relationship-bridge'; bridge.setAttribute('aria-label','Continue the conversation');
const intro = document.createElement('div');
const overline = document.createElement('p'); overline.className = 'relationship-kicker'; overline.textContent = 'BUILT BY ANDREW LAM';
const title = document.createElement('h2'); title.textContent = current === 'portal' ? 'Found a connection worth exploring?' : 'Imagine what we could build together.';
const copy = document.createElement('p'); copy.textContent = current === 'portal' ? 'Share a question, a source or an idea. The next useful discovery might start with a conversation.' : 'Bring a world-building idea, a creative collaboration or a thoughtful piece of feedback.';
intro.append(overline,title,copy);
const actions = document.createElement('div'); actions.className = 'relationship-actions';
const talk = document.createElement('a'); talk.href = contactUrl; talk.textContent = 'Start a conversation ↗'; talk.className = 'relationship-primary';
const linkedIn = document.createElement('a'); linkedIn.href = 'https://www.linkedin.com/in/lam-teck-sing-andrew-79886719'; linkedIn.textContent = 'Connect on LinkedIn';
actions.append(talk,linkedIn); bridge.append(intro,actions);
(document.querySelector('main') || document.querySelector('footer'))?.after(bridge);
captureIncomingReferral();
