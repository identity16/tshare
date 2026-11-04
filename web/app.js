import { openReview, clearReview } from './review.js';
import {contentURL, mountViewer, viewerType} from './viewer.js';
const $ = selector => document.querySelector(selector);
const labels = { all:'All',html:'HTML',markdown:'Markdown',image:'Images',video:'Videos',pdf:'PDF',folder:'Folders',file:'Files' };
const glyphs = { markdown:'#', pdf:'PDF', folder:'[ / ]', file:'{ }', video:'▷' };
const params = new URLSearchParams(location.search);
let filter = params.get('type') || 'all', items = [], selected = null, loadSequence = 0, toastTimer, disposeViewer=()=>{};
if (!(filter in labels)) filter = 'all';
$('#search').value = params.get('q') || '';
$('#sort').value = params.get('sort') === 'name' ? 'name' : 'recent';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fileSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
function saveFilters() { const query = new URLSearchParams(); if (filter !== 'all') query.set('type',filter); if ($('#search').value) query.set('q',$('#search').value); if ($('#sort').value !== 'recent') query.set('sort',$('#sort').value); history.replaceState(null,'',`${location.pathname}${query.size ? '?'+query : ''}${location.hash}`); }
function render() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const visible = items.filter(i=>(filter==='all'||viewerType(i)===filter)&&`${i.title} ${i.description} ${i.name}`.toLocaleLowerCase().includes(query)).sort((a,b)=>$('#sort').value==='name'?a.title.localeCompare(b.title):b.created_at.localeCompare(a.created_at));
  $('#filters').innerHTML = Object.entries(labels).map(([kind,label])=>`<button data-kind="${kind}" aria-pressed="${filter===kind}">${label}</button>`).join('');
  $('#count').textContent = `${visible.length} ${visible.length===1?'artifact':'artifacts'}`;
  $('#grid').innerHTML = visible.map(item=>`<article class="card"><button data-name="${escape(item.name)}" aria-label="Open ${escape(item.title)}"><div class="preview"><span class="type-label">${labels[viewerType(item)]||'File'}</span>${item.kind==='image'?`<img loading="lazy" src="${escape(contentURL(item))}" alt="">`:item.kind==='html'?`<iframe loading="lazy" src="${escape(contentURL(item))}" sandbox title="Preview of ${escape(item.title)}" tabindex="-1" aria-hidden="true"></iframe>`:`<span class="file-glyph" aria-hidden="true">${glyphs[viewerType(item)]||'{ }'}</span>`}</div><div class="card-text"><h2>${escape(item.title)}</h2><p>${escape(item.description||item.name)}</p><div class="metadata"><time datetime="${escape(item.created_at)}">${new Date(item.created_at).toLocaleDateString('en',{month:'short',day:'numeric'})}</time><span>${fileSize(item.bytes)}</span></div></div></button></article>`).join('');
  $('#empty').hidden = visible.length > 0;
  $('#empty-title').textContent = items.length ? 'No matching artifacts.' : 'Your library starts here.';
  $('#empty-message').textContent = items.length ? 'Try another search or content type.' : 'Share a file from the host to see it here.';
}
async function load() {
  $('#reload').disabled=true; $('#status').hidden=false; $('#status').textContent='Loading your library…';
  try { const response=await fetch('/api/artifacts');if(!response.ok)throw Error('Could not load the library. Check your connection or authentication, then refresh.');const data=await response.json();items=data.artifacts;render();$('#status').hidden=true;await route(); }
  catch(error){$('#status').textContent=error.message;$('#empty').hidden=true;}
  finally{$('#reload').disabled=false;}
}
async function open(item) {
  disposeViewer();selected=item; const sequence=++loadSequence; clearReview(); const body=$('#viewer-body');body.replaceChildren();
  $('#viewer-title').textContent=item.title;$('#viewer-description').textContent=item.description||item.name;$('#viewer-status').textContent='Loading revision…';
  if(!$('#viewer').open)$('#viewer').showModal();
  try { const view=await openReview(item,()=>sequence===loadSequence);if(!view)return;item=view;selected=view; } catch(error){if(sequence===loadSequence)$('#viewer-status').textContent=error.message;return;}
  $('#viewer-title').textContent=item.title;$('#viewer-description').textContent=item.description||item.name;$('#viewer-status').textContent='';$('#original').href=contentURL(item);$('#download').href=contentURL(item)+'?download';if(!$('#viewer').open)$('#viewer').showModal();
  disposeViewer=mountViewer(item,{body,tools:$('#viewer-tools'),copy:copyText,isCurrent:()=>sequence===loadSequence,status:message=>{$('#viewer-status').textContent=message;}});
}
async function route(){const name=new URLSearchParams(location.hash.slice(1)).get('item');if(name){const item=items.find(i=>i.name===name);if(item){await open(item);}else{$('#status').hidden=false;$('#status').textContent='This artifact is no longer available.';}}else{loadSequence++;disposeViewer();selected=null;clearReview();if($('#viewer').open)$('#viewer').close();}}
async function copyText(text,message='Link copied.'){try{await navigator.clipboard.writeText(text);notify(message);}catch{$('#viewer-status').textContent='Clipboard unavailable. Copy the text or URL directly.';}}
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
$('#search').addEventListener('input',()=>{saveFilters();render();});$('#sort').addEventListener('change',()=>{saveFilters();render();});$('#filters').addEventListener('click',event=>{const button=event.target.closest('[data-kind]');if(button){filter=button.dataset.kind;saveFilters();render();}});$('#grid').addEventListener('click',event=>{const button=event.target.closest('[data-name]');if(button)location.hash=`item=${encodeURIComponent(button.dataset.name)}`;});$('#back').onclick=()=>{location.hash='';};$('#viewer').addEventListener('cancel',event=>{event.preventDefault();location.hash='';});$('#copy').onclick=()=>copyText(location.href);$('#remove').onclick=async()=>{if(!selected||!confirm(`Delete “${selected.title}” from this library? All versions and feedback will be deleted. This cannot be undone.`))return;$('#remove').disabled=true;try{const response=await fetch(`/api/artifacts/${encodeURIComponent(selected.name)}`,{method:'DELETE',headers:{'X-Tshare-Request':'manage'}});if(!response.ok){const data=await response.json();throw Error(data.error||'Could not delete the artifact.');}location.hash='';await load();}catch(error){$('#viewer-status').textContent=error.message;}finally{$('#remove').disabled=false;}};$('#reload').onclick=load;window.addEventListener('hashchange',route);document.addEventListener('keydown',event=>{if(event.key==='/'&&!$('#viewer').open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#search').focus();}});load();
