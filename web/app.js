const $ = selector => document.querySelector(selector);
const labels = { all:'All',html:'HTML',markdown:'Markdown',image:'Images',pdf:'PDF',folder:'Folders',file:'Files' };
const glyphs = { markdown:'#', pdf:'PDF', folder:'[ / ]', file:'{ }' };
const params = new URLSearchParams(location.search);
let filter = params.get('type') || 'all', items = [], selected = null, loadSequence = 0, toastTimer;
if (!(filter in labels)) filter = 'all';
$('#search').value = params.get('q') || '';
$('#sort').value = params.get('sort') === 'name' ? 'name' : 'recent';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const contentURL = item => `/share/${encodeURIComponent(item.name)}/${item.entry === 'index.html' ? '' : item.entry.split('/').map(encodeURIComponent).join('/')}`;
const fileSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
function saveFilters() { const query = new URLSearchParams(); if (filter !== 'all') query.set('type',filter); if ($('#search').value) query.set('q',$('#search').value); if ($('#sort').value !== 'recent') query.set('sort',$('#sort').value); history.replaceState(null,'',`${location.pathname}${query.size ? '?'+query : ''}${location.hash}`); }
function render() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const visible = items.filter(i=>(filter==='all'||i.kind===filter)&&`${i.title} ${i.description} ${i.name}`.toLocaleLowerCase().includes(query)).sort((a,b)=>$('#sort').value==='name'?a.title.localeCompare(b.title):b.created_at.localeCompare(a.created_at));
  $('#filters').innerHTML = Object.entries(labels).map(([kind,label])=>`<button data-kind="${kind}" aria-pressed="${filter===kind}">${label}</button>`).join('');
  $('#count').textContent = `${visible.length} ${visible.length===1?'artifact':'artifacts'}`;
  $('#grid').innerHTML = visible.map(item=>`<article class="card"><button data-name="${escape(item.name)}" aria-label="Open ${escape(item.title)}"><div class="preview"><span class="type-label">${labels[item.kind]||'File'}</span>${item.kind==='image'?`<img loading="lazy" src="${escape(contentURL(item))}" alt="">`:item.kind==='html'?`<iframe loading="lazy" src="${escape(contentURL(item))}" sandbox title="Preview of ${escape(item.title)}" tabindex="-1" aria-hidden="true"></iframe>`:`<span class="file-glyph" aria-hidden="true">${glyphs[item.kind]||'{ }'}</span>`}</div><div class="card-text"><h2>${escape(item.title)}</h2><p>${escape(item.description||item.name)}</p><div class="metadata"><time datetime="${escape(item.created_at)}">${new Date(item.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time><span>${fileSize(item.bytes)}</span></div></div></button></article>`).join('');
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
function markdown(source) {
  // Deliberately small, safe renderer: raw HTML and external links are plain text.
  return source.split(/(```[\s\S]*?```)/g).map(part=>part.startsWith('```')?`<pre>${escape(part.replace(/^```[^\n]*\n?/, '').replace(/```$/, ''))}</pre>`:part.split(/\n\s*\n/).map(block=>{ const heading=/^(#{1,3}) (.*)$/.exec(block);if(heading)return `<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`;if(block.startsWith('> '))return `<blockquote>${escape(block.slice(2)).replaceAll('\n','<br>')}</blockquote>`;return `<p>${escape(block).replaceAll('\n','<br>')}</p>`;}).join('')).join('');
}
async function open(item) {
  selected=item; const sequence=++loadSequence; const body=$('#viewer-body');body.replaceChildren();$('#viewer-title').textContent=item.title;$('#viewer-description').textContent=item.description||item.name;$('#viewer-status').textContent='';$('#original').href=contentURL(item);$('#download').href=contentURL(item)+'?download';if(!$('#viewer').open)$('#viewer').showModal();
  if(item.kind==='markdown') {
    const article=document.createElement('article');article.className='reading';article.textContent='Loading document…';body.append(article);
    try{if(item.bytes>2097152)throw Error('This document is too large to preview. Use Download.');const response=await fetch(contentURL(item));if(!response.ok)throw Error('Could not load this document. Try Open original.');const text=await response.text();if(sequence!==loadSequence)return;article.innerHTML=markdown(text);}catch(error){article.textContent=error.message;}
  } else if(item.kind==='image') { const image=document.createElement('img');image.src=contentURL(item);image.alt=item.title;body.append(image); }
  else if(['html','pdf','folder'].includes(item.kind)) { const iframe=document.createElement('iframe');iframe.title=item.title;iframe.src=contentURL(item);if(item.kind==='html')iframe.sandbox='allow-scripts';body.append(iframe);if(item.kind==='pdf')$('#viewer-status').textContent='PDF not showing? Use Open original or Download.'; }
  else { const wrap=document.createElement('div');wrap.className='download-fallback';const message=document.createElement('p');message.textContent='Download this file to open it in your preferred app.';const link=document.createElement('a');link.href=contentURL(item)+'?download';link.download='';link.textContent='Download file';wrap.append(message,link);body.append(wrap); }
}
async function route(){const name=new URLSearchParams(location.hash.slice(1)).get('item');if(name){const item=items.find(i=>i.name===name);if(item){await open(item);}else{$('#status').hidden=false;$('#status').textContent='This artifact is no longer available.';}}else{loadSequence++;selected=null;if($('#viewer').open)$('#viewer').close();}}
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
$('#search').addEventListener('input',()=>{saveFilters();render();});$('#sort').addEventListener('change',()=>{saveFilters();render();});$('#filters').addEventListener('click',event=>{const button=event.target.closest('[data-kind]');if(button){filter=button.dataset.kind;saveFilters();render();}});$('#grid').addEventListener('click',event=>{const button=event.target.closest('[data-name]');if(button)location.hash=`item=${encodeURIComponent(button.dataset.name)}`;});$('#back').onclick=()=>{location.hash='';};$('#viewer').addEventListener('cancel',event=>{event.preventDefault();location.hash='';});$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);notify('Link copied.');}catch{$('#viewer-status').textContent='Copy the URL from your address bar.';}};$('#remove').onclick=async()=>{if(!selected||!confirm(`Delete “${selected.title}” from this library? This cannot be undone.`))return;$('#remove').disabled=true;try{const response=await fetch(`/api/artifacts/${encodeURIComponent(selected.name)}`,{method:'DELETE',headers:{'X-Tshare-Request':'manage'}});if(!response.ok){const data=await response.json();throw Error(data.error||'Could not delete the artifact.');}location.hash='';await load();}catch(error){$('#viewer-status').textContent=error.message;}finally{$('#remove').disabled=false;}};$('#reload').onclick=load;window.addEventListener('hashchange',route);document.addEventListener('keydown',event=>{if(event.key==='/'&&!$('#viewer').open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#search').focus();}});load();
