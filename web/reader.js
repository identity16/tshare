// Owns the reader's local disclosures only. No API, identity or stored state.
const $=selector=>document.querySelector(selector);
const menus=['revision','view','more'];
const mobile=()=>matchMedia('(max-width:600px)').matches;
let reviewOpen=false;
function focusables(root){return [...root.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(node=>!node.disabled&&!node.closest('[hidden]')&&node.getClientRects().length);}
function closeMenus(restore=false){
  let trigger;
  for(const name of menus){const menu=$(`#${name}-menu`);if(!menu.hidden)trigger=$(`#${name}-button`);menu.hidden=true;$(`#${name}-button`).setAttribute('aria-expanded','false');}
  if(restore)trigger?.focus();
}
function positionMenu(name){
  const menu=$(`#${name}-menu`),trigger=$(`#${name}-button`).getBoundingClientRect(),dialog=$('#viewer').getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(trigger.left-dialog.left,dialog.width-menu.offsetWidth-10))+'px';
  menu.style.top=(trigger.bottom-dialog.top+7)+'px';
}
function toggleMenu(name){
  const menu=$(`#${name}-menu`),opening=menu.hidden;closeMenus();
  if(!opening)return;
  menu.hidden=false;positionMenu(name);$(`#${name}-button`).setAttribute('aria-expanded','true');focusables(menu)[0]?.focus();
}
function syncReview(){
  $('#viewer').classList.toggle('review-open',reviewOpen);$('#review-panel').hidden=!reviewOpen;
  $('#review-toggle').setAttribute('aria-expanded',String(reviewOpen));
  const sheet=reviewOpen&&mobile();$('#viewer-content').inert=sheet;$('#viewer-bar').inert=sheet;
  $('#review-panel').setAttribute('role',sheet?'dialog':'region');
  if(sheet)$('#review-panel').setAttribute('aria-modal','true');else $('#review-panel').removeAttribute('aria-modal');
}
function setReview(open,restore=false){
  reviewOpen=open;closeMenus();syncReview();
  if(open&&mobile())$('#review-close').focus();else if(restore)$('#review-toggle').focus();
}
export function prepareReader(changingArtifact){closeMenus();if(changingArtifact)resetReader();}
export function resetReader(){setReview(false);closeMenus();}
export function setReviewAvailable(value){$('#review-toggle').disabled=!value;}
export function setReviewCount(value){$('#review-count').textContent=String(value);}
export function closeReaderLayer(){
  if(menus.some(name=>!$(`#${name}-menu`).hidden)){closeMenus(true);return true;}
  if(reviewOpen){setReview(false,true);return true;}
  return false;
}
export function initReader(){
  for(const name of menus)$(`#${name}-button`).onclick=()=>toggleMenu(name);
  $('#review-toggle').onclick=()=>setReview(!reviewOpen);
  $('#review-close').onclick=()=>setReview(false,true);
  $('#viewer').addEventListener('click',event=>{
    if(!event.target.closest('.reader-menu')&&!menus.some(name=>event.target.closest(`#${name}-button`)))closeMenus();
    if(event.target.closest('#revision-menu a,#more-menu a,#copy-secondary,#remove'))closeMenus();
  });
  $('#viewer').addEventListener('keydown',event=>{
    // Handle inner layers before the browser's native dialog close watcher.
    if(event.key==='Escape'&&closeReaderLayer()){event.preventDefault();return;}
    const activeMenu=menus.map(name=>$(`#${name}-menu`)).find(menu=>!menu.hidden);
    if(activeMenu&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      const nodes=focusables(activeMenu);if(!nodes.length)return;
      // Native selects, ranges and text fields retain their own arrow behavior.
      if(['SELECT','INPUT','TEXTAREA'].includes(event.target.tagName))return;
      const index=nodes.indexOf(document.activeElement);let next;
      if(event.key==='Home')next=0;else if(event.key==='End')next=nodes.length-1;else next=(index+(event.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length;
      event.preventDefault();nodes[next].focus();
    }
    if(event.key==='Tab'&&reviewOpen&&mobile()){
      const nodes=focusables($('#review-panel')),first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  matchMedia('(max-width:600px)').addEventListener('change',()=>{
    const wasInert=$('#viewer-bar').inert;syncReview();
    if(reviewOpen&&mobile())$('#review-close').focus();else if(wasInert)$('#review-toggle').focus();
  });
  const tools=$('#viewer-tools');
  const updateTools=()=>{const hidden=tools.hidden||!tools.childElementCount;$('#view-button').hidden=hidden;if(hidden&&!$('#view-menu').hidden)closeMenus();};
  new MutationObserver(updateTools).observe(tools,{attributes:true,attributeFilter:['hidden'],childList:true});updateTools();
  window.addEventListener('resize',()=>{for(const name of menus)if(!$(`#${name}-menu`).hidden)positionMenu(name);});
  resetReader();
}
