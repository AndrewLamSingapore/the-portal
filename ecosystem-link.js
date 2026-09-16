const ECOSYSTEM_APPS={
  portal:'https://the-portal-ten.vercel.app/',
  authorityEngine:'https://authority-engine-app.vercel.app/',
  jarvis:'https://authority-engine-app.vercel.app/jarvis',
  gamePlatform:'https://game-platform-wine-nine.vercel.app/',
  velyqua:'https://velyqua.vercel.app/',
  skyTablet:'https://sky-tablet.vercel.app/',
  github:'https://github.com/AndrewLamSingapore'
};
const current='portal'; // Stable identity on production and preview deployment domains.
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
nav.append(link('portal','The Portal','top_nav'),link('authorityEngine','Authority Engine','top_nav'),link('jarvis','JARVIS PRIME','top_nav'),link('gamePlatform','Living Worlds','top_nav'),link('velyqua','VELYQUA','top_nav'),link('skyTablet','Sky Tablet','top_nav'),link('github','GitHub','top_nav'));
document.querySelector('header')?.after(nav);
if(current==='portal'){
  const cta=link('gamePlatform','PLAY LIVING WORLDS →','portal_hero');cta.className='primary ecosystem-cta-primary';document.querySelector('.hero-actions')?.append(cta);
}
if(current==='gamePlatform'){
  const back=link('portal','← Return to The Portal','game_return_link');back.className='ecosystem-link-subtle';document.querySelector('#play>.row>div')?.append(back);
}
const source = current === 'gamePlatform' ? 'game-platform' : current === 'portal' ? 'portal' : 'authority-engine';
const contactUrl = `https://authority-engine-app.vercel.app/contact?source=${source}&intent=collaboration`;
const contact = document.createElement('a'); contact.href = contactUrl; contact.textContent = 'Talk with Andrew ↗'; contact.className = 'ecosystem-talk'; nav.append(contact);
const bridge = document.createElement('section'); bridge.className = 'relationship-bridge'; bridge.setAttribute('aria-label','Continue the conversation');
const intro = document.createElement('div');
const overline = document.createElement('p'); overline.className = 'relationship-kicker'; overline.textContent = 'BUILT BY ANDREW LAM';
const title = document.createElement('h2'); title.textContent = current === 'portal' ? 'What connection did you see?' : 'Your next idea could become a world.';
const copy = document.createElement('p'); copy.textContent = current === 'portal' ? 'I’m Andrew Lam. I built The Portal to explore connections between ideas. Bring a question, a useful source or a project you want to investigate together.' : 'I’m Andrew Lam. I’m exploring worlds where choices matter. Tell me about a story, learning experience or interactive project you would like to build.';
intro.append(overline,title,copy);
const actions = document.createElement('div'); actions.className = 'relationship-actions';
const talk = document.createElement('a'); talk.href = contactUrl; talk.textContent = current === 'portal' ? 'Explore an idea with Andrew ↗' : 'Discuss a creative project ↗'; talk.className = 'relationship-primary';
const linkedIn = document.createElement('a'); linkedIn.href = 'https://www.linkedin.com/in/lam-teck-sing-andrew-79886719'; linkedIn.textContent = 'Connect on LinkedIn';
actions.append(talk,linkedIn,link('jarvis','Explore JARVIS PRIME ↗','creator_bridge')); bridge.append(intro,actions);
(document.querySelector('main') || document.querySelector('footer'))?.after(bridge);
// A short creator invitation is visible before the deep experience, not only in the footer.
const creator = document.createElement('aside');creator.className='creator-invitation';creator.setAttribute('aria-label','Meet the creator');
const creatorText=document.createElement('p');creatorText.textContent=current==='portal'?'An exploration by Andrew Lam. Follow an idea. Find a connection. Bring your perspective.':'An interactive world by Andrew Lam. Play a scene, then imagine what we could create together.';
const creatorLink=document.createElement('a');creatorLink.href=contactUrl;creatorLink.textContent='Talk with Andrew ↗';creator.append(creatorText,creatorLink);
const entry=current==='portal'?document.querySelector('.hero'):document.querySelector('.dashboard-hero');entry?.append(creator);
captureIncomingReferral();
