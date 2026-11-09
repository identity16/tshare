import {mountViewer,timestamp} from './viewer.js';
const $=selector=>document.querySelector(selector),item=JSON.parse($('#share-data').textContent);
const current=new URL(location.href),query=current.searchParams;
let toastTimer;
$('#viewer-title').textContent=item.title;document.title=item.title+' — tshare';$('#viewer-description').textContent=item.description||item.name;$('#share-version').textContent='v'+item.number;
const entry=item.entry==='index.html'?'':item.entry.split('/').map(encodeURIComponent).join('/');
const content=`/share/.tshare/revision/${encodeURIComponent(item.name)}/${encodeURIComponent(item.reviewRevision)}/${entry}`;
$('#original').href=content;$('#download').href=content+'?download';
async function copy(text,message='Link copied.'){
  try{await navigator.clipboard.writeText(text);clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2500);}
  catch{$('#viewer-status').textContent='Clipboard unavailable. Copy the URL from the address bar.';}
}
$('#share-copy').onclick=()=>copy(location.href);
const menus=['view','more'];
function close(restore=false){for(const name of menus){if(restore&&!$(`#${name}-menu`).hidden)$(`#${name}-button`).focus();$(`#${name}-menu`).hidden=true;$(`#${name}-button`).setAttribute('aria-expanded','false');}}
function position(name){const menu=$(`#${name}-menu`),button=$(`#${name}-button`).getBoundingClientRect();menu.style.left=Math.max(8,Math.min(button.left,innerWidth-menu.offsetWidth-10))+'px';menu.style.top=(button.bottom+7)+'px';}
for(const name of menus)$(`#${name}-button`).onclick=()=>{const menu=$(`#${name}-menu`),opening=menu.hidden;close();if(opening){menu.hidden=false;position(name);$(`#${name}-button`).setAttribute('aria-expanded','true');menu.querySelector('button:not(:disabled),a[href],select')?.focus();}};
document.addEventListener('click',event=>{if(!event.target.closest('.reader-menu')&&!menus.some(name=>event.target.closest(`#${name}-button`)))close();if(event.target.closest('#more-menu a'))close();});
document.addEventListener('keydown',event=>{
  const menu=menus.map(name=>$(`#${name}-menu`)).find(node=>!node.hidden);if(!menu)return;
  if(event.key==='Escape'){event.preventDefault();close(true);return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||['SELECT','INPUT','TEXTAREA'].includes(event.target.tagName))return;
  const nodes=[...menu.querySelectorAll('button:not(:disabled),a[href],select')],index=nodes.indexOf(document.activeElement);if(!nodes.length)return;
  event.preventDefault();nodes[event.key==='Home'?0:event.key==='End'?nodes.length-1:(index+(event.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length].focus();
});
const tools=$('#viewer-tools');new MutationObserver(()=>{const hidden=tools.hidden||!tools.childElementCount;$('#view-button').hidden=hidden;if(hidden&&!$('#view-menu').hidden)close();}).observe(tools,{attributes:true,attributeFilter:['hidden'],childList:true});
window.addEventListener('resize',()=>{for(const name of menus)if(!$(`#${name}-menu`).hidden)position(name);});
const dispose=mountViewer(item,{body:$('#viewer-body'),tools,isCurrent:()=>true,status:message=>{$('#viewer-status').textContent=message;},copy,url:content,time:query.get('t'),momentLink:time=>{
  const url=new URL(location.href);url.searchParams.set('view','1');url.searchParams.set('revision',item.reviewRevision);url.searchParams.set('t',String(Math.round(timestamp(time)*1000)/1000));return url.href;
}});
window.addEventListener('pagehide',event=>{if(event.persisted)document.querySelector('video')?.pause();else dispose();});
