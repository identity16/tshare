const $ = selector => document.querySelector(selector);
let current = null, writable = false, generation = 0, refreshSequence = 0;
async function api(url, data) {
  const response = await fetch(url,data === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json','X-Tshare-Request':'manage'},body:JSON.stringify(data)});
  const result = await response.json(); if (!response.ok) throw Error(result.error || 'Request failed.'); return result;
}
const node = (tag, text, className) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
function identity() {return $('#review-author').value.trim() || 'Owner';}
function status(message) {$('#review-status').textContent=message;}
function versionLink(name,id,label) {
  const link=node('a',label);link.href=`#item=${encodeURIComponent(name)}&revision=${encodeURIComponent(id)}`;return link;
}
async function mutate(url,data,button,done) {
  const context=current, token=generation;button.disabled=true;status('Saving…');
  try {await api(url,{...data,author:identity()});if(token!==generation)return;await refresh();if(token!==generation)return;done?.();status('Saved.');}
  catch(error){if(context===current)status(error.message);}
  finally{if(button.isConnected)button.disabled=!writable;}
}
function renderThread(thread) {
  const article=node('article',undefined,'feedback-thread');
  const head=node('div',undefined,'thread-heading');head.append(node('strong',thread.kind.replaceAll('_',' ')),node('span',thread.status,'thread-status'),versionLink(thread.name,thread.revision_id,`Reviewed v${thread.revision}`));article.append(head);
  const comment=(author,actor,message,date)=>{const block=node('div',undefined,'review-comment');block.append(node('small',`${author} · ${actor} · ${new Date(date).toLocaleString()}`),node('p',message));return block;};
  article.append(comment(thread.author,thread.actor_type,thread.message,thread.created_at));
  for(const reply of thread.replies)article.append(comment(reply.author,reply.actor_type,reply.message,reply.created_at));
  if(thread.resolution_revision_id)article.append(versionLink(thread.name,thread.resolution_revision_id,'Open linked resolution revision'));
  if(writable){
    const form=node('form');const label=node('label','Reply');const input=node('textarea');input.rows=2;input.maxLength=10000;input.required=true;label.append(input);const submit=node('button','Send reply');submit.type='submit';form.append(label,submit);
    form.onsubmit=event=>{event.preventDefault();mutate(`/api/feedback/${encodeURIComponent(thread.id)}/replies`,{message:input.value},submit);};article.append(form);
    if(thread.status==='open'){
      const resolutionForm=node('form');const resolutionLabel=node('label','Resolution explanation');const explanation=node('textarea');explanation.rows=2;explanation.maxLength=10000;resolutionLabel.append(explanation);
      const checkLabel=node('label',undefined,'resolution-choice'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=false;checkbox.disabled=current.number<thread.revision;checkLabel.append(checkbox,document.createTextNode(` Link the displayed v${current.number} as the resolution`));
      const resolve=node('button','Record resolution');resolve.type='submit';resolutionForm.append(resolutionLabel,checkLabel,resolve);resolutionForm.onsubmit=event=>{event.preventDefault();if(!explanation.value.trim()&&!checkbox.checked){status('Explain the resolution or explicitly select the displayed revision.');return;}mutate(`/api/feedback/${encodeURIComponent(thread.id)}/resolve`,{message:explanation.value || undefined,revisionId:checkbox.checked?current.id:undefined},resolve);};article.append(resolutionForm);
    }
  }
  return article;
}
async function refresh() {
  const token=generation, sequence=++refreshSequence, item=current;if(!item)return;
  const result=await api(`/api/artifacts/${encodeURIComponent(item.name)}/feedback`);
  if(token!==generation || sequence!==refreshSequence)return;
  const list=$('#feedback-list');list.replaceChildren(...result.feedback.map(renderThread));$('#feedback-empty').hidden=result.feedback.length>0;
}
export function clearReview() {generation++;current=null;$('#review-panel').hidden=true;}
export async function openReview(item,isCurrent) {
  const token=++generation;current=null;$('#review-panel').hidden=true;status('');
  const [caps,result]=await Promise.all([api('/api/capabilities'),api(`/api/artifacts/${encodeURIComponent(item.name)}/revisions`)]);
  if(token!==generation || !isCurrent())return null;
  const requested=new URLSearchParams(location.hash.slice(1)).get('revision'), revision=requested?result.revisions.find(r=>r.id===requested):result.revisions[0];
  if(!revision)throw Error('This revision is no longer available.');
  current={...revision,name:item.name};writable=caps.writable;
  const select=$('#revision-select');select.replaceChildren();
  for(const r of result.revisions){const option=node('option',`v${r.number}${r.id===result.revisions[0].id?' · latest':''} · ${new Date(r.created_at).toLocaleString()}`);option.value=r.id;option.selected=r.id===revision.id;select.append(option);}
  select.onchange=()=>{location.hash=`item=${encodeURIComponent(item.name)}&revision=${encodeURIComponent(select.value)}`;};
  $('#review-note').textContent=writable?'Display names are unverified. A recorded resolution is not approval.':'Read only. Set TSHARE_PASSWORD on the host to enable feedback.';
  $('#feedback-form').hidden=!writable;$('#remove').disabled=!writable;$('#review-panel').hidden=false;
  $('#feedback-message').value='';$('#feedback-form').onsubmit=event=>{event.preventDefault();const input=$('#feedback-message');mutate(`/api/artifacts/${encodeURIComponent(current.name)}/feedback`,{kind:$('#feedback-kind').value,message:input.value,revisionId:current.id},$('#feedback-submit'),()=>{input.value='';});};
  $('#feedback-refresh').onclick=()=>{refresh().catch(error=>status(error.message));};
  await refresh();if(token!==generation || !isCurrent())return null;
  return {...item,...revision,name:item.name,reviewRevision:revision.id};
}
