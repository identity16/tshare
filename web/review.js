import {feedbackAPI as api,reviewSnapshot} from './review-data.js';
import {setReviewAvailable,setReviewCount} from './reader.js';
const $=selector=>document.querySelector(selector);
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
let current=null,writable=false,generation=0,refreshSequence=0,threads=[],filter='open',artifactName=null;
const drafts=new Map(),editors=new Map();
const draftKey=()=>current?current.name+'/'+current.id:null;
const editorKey=thread=>draftKey()+'/'+thread.id;
function remember(map,key,value){if(!key)return;map.delete(key);map.set(key,value);if(map.size>50)map.delete(map.keys().next().value);}
function identity(){return $('#review-author').value.trim()||'Owner';}
function status(message){$('#review-status').textContent=message;}
function saveDraft(){if(current)remember(drafts,draftKey(),{message:$('#feedback-message').value,kind:$('#feedback-kind').value});}
function composer(expanded){$('#feedback-message').rows=expanded?3:1;$('#feedback-compose-actions').hidden=!expanded;}
function versionLink(name,id,label){
  const link=node('a',label);link.href=`#item=${encodeURIComponent(name)}&revision=${encodeURIComponent(id)}`;
  link.addEventListener('click',()=>{filter='all';});return link;
}
function action(label,callback,className){const button=node('button',label,className);button.type='button';button.onclick=callback;return button;}
async function mutate(url,data,button,{beforeRefresh,done}={}){
  const context=current,token=generation;button.disabled=true;status('Saving…');
  try{
    await api(url,{...data,author:identity()});
    if(token!==generation||context!==current)return;
    beforeRefresh?.();await refresh();if(token!==generation||context!==current)return;
    done?.();status('Saved.');
  }catch(error){if(token===generation&&context===current)status(error.message);}
  finally{if(button.isConnected)button.disabled=!writable;}
}
function comment(author,actor,message,date,reply=false){
  const wrap=node('div',undefined,reply?'review-comment reply-comment':'review-comment');
  const who=node('div',undefined,'review-comment-meta'),time=node('time',new Date(date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}));
  time.dateTime=date;time.title=new Date(date).toLocaleString();who.append(node('strong',author),node('span','· '+actor),time);
  wrap.append(who,node('p',message));return wrap;
}
function renderEditor(thread,container){
  const key=editorKey(thread),draft=editors.get(key);if(!draft)return;
  const context=current,form=node('form',undefined,'review-editor'),reply=draft.mode==='reply';
  form.append(node('p',reply?'Reply':'Record resolution','editor-heading'));
  const input=node('textarea');input.rows=3;input.maxLength=10000;input.value=draft.message;
  input.setAttribute('aria-label',reply?'Reply':'Resolution explanation');input.placeholder=reply?'Write a reply…':'Explain the resolution…';
  input.oninput=()=>{draft.message=input.value;};form.append(input);
  let checkbox;
  if(!reply){
    const label=node('label',undefined,'resolution-choice');checkbox=node('input');checkbox.type='checkbox';
    checkbox.disabled=context.number<thread.revision;checkbox.checked=!checkbox.disabled&&draft.link;
    checkbox.onchange=()=>{draft.link=checkbox.checked;};
    label.append(checkbox,document.createTextNode(` Link the displayed v${context.number} as the resolution`));form.append(label);
  }
  const buttons=node('div',undefined,'compose-actions');
  buttons.append(action('Cancel',()=>{editors.delete(key);container.replaceChildren();$(`#feedback-${CSS.escape(thread.id)} [data-action="reply"]`)?.focus();}));
  const submit=node('button',reply?'Send reply':'Record resolution','reader-primary');submit.type='submit';buttons.append(submit);form.append(buttons);
  form.onsubmit=event=>{
    event.preventDefault();const message=input.value.trim(),linked=!reply&&checkbox.checked;
    if(!message&&!linked){status(reply?'Write a reply first.':'Explain the resolution or explicitly select the displayed revision.');input.focus();return;}
    const data={message:message||undefined,...(linked?{revisionId:context.id}:{})};
    mutate(`/api/feedback/${encodeURIComponent(thread.id)}/${reply?'replies':'resolve'}`,data,submit,{
      beforeRefresh:()=>{editors.delete(key);if(!reply)filter='all';},
      done:()=>$(`#feedback-${CSS.escape(thread.id)} [data-action="reply"]`)?.focus(),
    });
  };
  container.append(form);
}
function renderThread(thread){
  const article=node('article',undefined,'feedback-thread');article.id='feedback-'+thread.id;
  const head=node('div',undefined,'thread-heading');head.append(node('span',thread.kind.replaceAll('_',' ')),versionLink(thread.name,thread.revision_id,`Reviewed v${thread.revision}`));article.append(head);
  article.append(comment(thread.author,thread.actor_type,thread.message,thread.created_at));
  for(const reply of thread.replies)article.append(comment(reply.author,reply.actor_type,reply.message,reply.created_at,true));
  if(thread.resolution_revision_id){const link=versionLink(thread.name,thread.resolution_revision_id,'Open linked resolution revision');link.className='resolution-link';article.append(link);}
  const actions=node('div',undefined,'thread-actions'),editor=node('div');
  if(writable){
    const openEditor=mode=>{remember(editors,editorKey(thread),{mode,message:'',link:false});editor.replaceChildren();renderEditor(thread,editor);editor.querySelector('textarea')?.focus();};
    const reply=action('Reply',()=>openEditor('reply'));reply.dataset.action='reply';actions.append(reply);
    if(thread.status==='open')actions.append(action('Record resolution',()=>openEditor('resolve')));
  }
  if(thread.status==='resolved')actions.append(node('span','✓ Resolved','thread-resolved'));
  article.append(actions,editor);if(writable)renderEditor(thread,editor);return article;
}
function renderThreads(){
  const visible=threads.filter(thread=>filter==='all'||thread.status==='open');
  $('#feedback-list').replaceChildren(...visible.map(renderThread));
  $('#feedback-empty').hidden=visible.length>0;
  $('#feedback-empty').textContent=filter==='open'?'No open feedback. Add a question or view all activity.':'No feedback yet. Ask a question or record a decision.';
  $('#feedback-open-count').textContent=String(threads.filter(thread=>thread.status==='open').length);
  $('#feedback-open').setAttribute('aria-pressed',String(filter==='open'));$('#feedback-all').setAttribute('aria-pressed',String(filter==='all'));
  setReviewCount(threads.length);
}
async function refresh(){
  const token=generation,sequence=++refreshSequence,item=current;if(!item)return;
  const result=await api(`/api/artifacts/${encodeURIComponent(item.name)}/feedback`);
  if(token!==generation||sequence!==refreshSequence||item!==current)return;
  threads=result.feedback;renderThreads();
}
function renderVersions(name,revisions,selected){
  const latest=selected.id===revisions[0].id,button=$('#revision-button');
  button.replaceChildren(node('span','v'+selected.number),node('small',latest?'Latest':'Previous'),node('span','⌄','reader-caret'));button.disabled=false;
  button.setAttribute('aria-label',`Version ${selected.number}, ${latest?'latest':'previous'}`);
  const menu=$('#revision-menu');menu.replaceChildren(node('p','Versions','reader-menu-label'));
  for(const revision of revisions){
    const link=versionLink(name,revision.id,''),label=node('span','v'+revision.number),date=new Date(revision.created_at).toLocaleString();
    label.append(node('small',`${revision.id===revisions[0].id?'Latest · ':''}${date}`));link.append(label,node('span',revision.id===selected.id?'✓':''));
    if(revision.id===selected.id)link.setAttribute('aria-current','true');menu.append(link);
  }
  menu.append(node('p','Opening an older version keeps it pinned.','reader-menu-note'));
}
export function clearReview(){
  saveDraft();generation++;current=null;writable=false;threads=[];
  $('#feedback-list').replaceChildren();$('#feedback-form').hidden=true;$('#revision-button').disabled=true;$('#remove').disabled=true;
  $('#review-identity-toggle').hidden=true;$('#review-identity-fields').hidden=true;$('#review-identity-toggle').setAttribute('aria-expanded','false');
  setReviewAvailable(false);setReviewCount(0);status('');
}
export async function openReview(item,isCurrent){
  const token=++generation,requested=new URLSearchParams(location.hash.slice(1)).get('revision');status('');
  const {capabilities:caps,revisions,revision}=await reviewSnapshot(item.name,requested);
  if(token!==generation||!isCurrent())return null;
  if(artifactName!==item.name){filter='open';artifactName=item.name;}
  current={...revision,name:item.name};writable=caps.writable;
  renderVersions(item.name,revisions,revision);setReviewAvailable(true);
  $('#review-note').textContent=writable?'Display names are unverified. A recorded resolution is not approval.':'Read only. Set TSHARE_PASSWORD on the host to enable feedback. Display names are unverified; a recorded resolution is not approval.';
  $('#review-identity-summary').firstChild.textContent=writable?'Shared owner · names unverified ':'Read only · shared owner ';
  $('#feedback-form').hidden=!writable;$('#remove').disabled=!writable;$('#review-identity-toggle').hidden=!writable;
  $('#review-author').disabled=!writable;$('#review-author-name').textContent=identity();
  const draft=drafts.get(draftKey());$('#feedback-message').value=draft?.message||'';$('#feedback-kind').value=draft?.kind||'question';composer(Boolean(draft?.message));
  $('#feedback-message').onfocus=()=>composer(true);$('#feedback-message').oninput=saveDraft;$('#feedback-kind').onchange=saveDraft;
  $('#feedback-form').onsubmit=event=>{
    event.preventDefault();const input=$('#feedback-message'),message=input.value;
    mutate(`/api/artifacts/${encodeURIComponent(current.name)}/feedback`,{kind:$('#feedback-kind').value,message,revisionId:current.id},$('#feedback-submit'),{done:()=>{
      if(input.value===message){input.value='';composer(false);drafts.delete(draftKey());}
    },beforeRefresh:()=>{filter='open';}});
  };
  $('#feedback-refresh').onclick=()=>{refresh().catch(error=>status(error.message));};
  $('#feedback-open').onclick=()=>{filter='open';renderThreads();};$('#feedback-all').onclick=()=>{filter='all';renderThreads();};
  $('#review-identity-toggle').onclick=()=>{const opening=$('#review-identity-fields').hidden;$('#review-identity-fields').hidden=!opening;$('#review-identity-toggle').setAttribute('aria-expanded',String(opening));if(opening)$('#review-author').focus();};
  $('#review-author').oninput=()=>{$('#review-author-name').textContent=identity();};
  $('#review-info').onclick=()=>{const opening=$('#review-note').hidden;$('#review-note').hidden=!opening;$('#review-info').setAttribute('aria-expanded',String(opening));};
  await refresh();if(token!==generation||!isCurrent())return null;
  return {...item,...revision,name:item.name,reviewRevision:revision.id};
}
