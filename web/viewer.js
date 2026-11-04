export const contentURL = item => `${item.reviewRevision ? '/revision/'+encodeURIComponent(item.name)+'/'+encodeURIComponent(item.reviewRevision) : '/share/'+encodeURIComponent(item.name)}/${item.entry === 'index.html' ? '' : item.entry.split('/').map(encodeURIComponent).join('/')}`;

export function viewerType(item) {
  return item.kind === 'file' && /\.(mp4|m4v|webm|ogv|mov)$/i.test(item.entry) ? 'video' : item.kind;
}
export function timestamp(value) {
  if (value == null || value === '') return 0;
  const seconds=Number(value);return Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
}
export function momentURL(href,item,time) {
  const url=new URL(href),hash=new URLSearchParams({item:item.name,revision:item.reviewRevision,t:String(Math.round(timestamp(time)*1000)/1000)});
  url.hash=hash.toString();return url.href;
}
function node(tag,text,className) {const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;}
function tool(tools,label,action) {const button=node('button',label);button.type='button';button.addEventListener('click',action);tools.append(button);return button;}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function markdown(source) {
  return source.split(/(```[\s\S]*?```)/g).map(part=>part.startsWith('```')?`<pre>${escape(part.replace(/^```[^\n]*\n?/, '').replace(/```$/, ''))}</pre>`:part.split(/\n\s*\n/).map(block=>{const heading=/^(#{1,3}) (.*)$/.exec(block);if(heading)return `<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`;if(block.startsWith('> '))return `<blockquote>${escape(block.slice(2)).replaceAll('\n','<br>')}</blockquote>`;return `<p>${escape(block).replaceAll('\n','<br>')}</p>`;}).join('')).join('');
}

// One mounted viewer owns its DOM, media and pending reads.
export function mountViewer(item, {body, tools, isCurrent, status, copy}) {
  const abort=new AbortController(), signal=abort.signal;
  const alive=()=>!signal.aborted && isCurrent();
  const listeners={signal};let clean=()=>{};
  body.replaceChildren();tools.replaceChildren();tools.hidden=true;
  const kind=viewerType(item),url=contentURL(item);
  function showTools(){tools.hidden=false;}
  function fallback(message) {
    body.replaceChildren();const wrap=node('div',undefined,'download-fallback'),link=node('a','Download file');link.href=url+'?download';link.download='';wrap.append(node('p',message),link);body.append(wrap);
  }
  if(kind==='video') {
    showTools();const stage=node('div',undefined,'video-stage'),video=node('video');video.src=url;video.controls=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label',item.title);stage.append(video);body.append(stage);
    const seek=delta=>{if(Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+delta));};
    tool(tools,'−5s',()=>seek(-5));tool(tools,'+5s',()=>seek(5));
    const speed=node('select');speed.setAttribute('aria-label','Playback speed');for(const rate of [.5,1,1.5,2]){const option=node('option',rate+'×');option.value=String(rate);option.selected=rate===1;speed.append(option);}speed.addEventListener('change',()=>{video.playbackRate=Number(speed.value);},listeners);tools.append(speed);
    const moment=tool(tools,'Copy this moment',()=>{const href=momentURL(location.href,item,video.currentTime);history.replaceState(null,'',href);copy(href);});moment.disabled=true;
    const position=node('span','Loading video…','viewer-tool-note');tools.append(position);
    video.addEventListener('loadedmetadata',()=>{video.currentTime=Math.min(timestamp(new URLSearchParams(location.hash.slice(1)).get('t')),Number.isFinite(video.duration)?video.duration:0);moment.disabled=false;},listeners);
    video.addEventListener('timeupdate',()=>{position.textContent=video.currentTime.toFixed(1)+'s';},listeners);
    video.addEventListener('error',()=>{tools.hidden=true;video.pause();fallback('This video cannot be played by your browser. Download it to open it in another app.');},listeners);
    clean=()=>{video.pause();video.removeAttribute('src');video.load();};
  } else if(kind==='image') {
    showTools();const stage=node('div',undefined,'image-stage'),image=node('img');image.src=url;image.alt=item.title;image.draggable=false;stage.tabIndex=0;stage.setAttribute('aria-label','Image preview. Zoom in to drag, or use arrow keys to pan.');stage.append(image);body.append(stage);
    let scale=1,mode='fit',pan={x:0,y:0},drag=null;
    const label=node('span','Loading…','zoom-label'),dimensions=node('span','','viewer-tool-note');label.setAttribute('aria-live','polite');
    const fitScale=()=>Math.min((stage.clientWidth-32)/image.naturalWidth,(stage.clientHeight-32)/image.naturalHeight,1);
    function draw(){
      if(!image.naturalWidth)return;
      if(mode==='fit')scale=Math.max(.001,fitScale());
      const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
      const maxX=Math.max(0,(width-stage.clientWidth)/2),maxY=Math.max(0,(height-stage.clientHeight)/2);
      pan.x=Math.max(-maxX,Math.min(maxX,pan.x));pan.y=Math.max(-maxY,Math.min(maxY,pan.y));
      image.style.width=width+'px';image.style.height=height+'px';image.style.transform=`translate(-50%,-50%) translate(${pan.x}px,${pan.y}px)`;
      label.textContent=Math.round(scale*100)+'%';stage.style.touchAction=maxX||maxY?'none':'pan-y';stage.classList.toggle('can-pan',Boolean(maxX||maxY));
    }
    const zoom=factor=>{mode='custom';scale=Math.max(.01,Math.min(8,scale*factor));draw();};
    const minus=tool(tools,'−',()=>zoom(1/1.25));minus.setAttribute('aria-label','Zoom out');tools.append(label);const plus=tool(tools,'+',()=>zoom(1.25));plus.setAttribute('aria-label','Zoom in');
    tool(tools,'Fit',()=>{mode='fit';pan={x:0,y:0};draw();});tool(tools,'Actual size',()=>{mode='custom';scale=1;pan={x:0,y:0};draw();});tools.append(dimensions);
    image.addEventListener('load',()=>{dimensions.textContent=`${image.naturalWidth} × ${image.naturalHeight}`;draw();},listeners);
    image.addEventListener('error',()=>{tools.hidden=true;fallback('This image could not be loaded. Try Open original or Download.');},listeners);
    stage.addEventListener('pointerdown',event=>{if(!stage.classList.contains('can-pan') || event.button!==0)return;drag={id:event.pointerId,x:event.clientX-pan.x,y:event.clientY-pan.y};stage.setPointerCapture(event.pointerId);event.preventDefault();},listeners);
    stage.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;pan={x:event.clientX-drag.x,y:event.clientY-drag.y};draw();},listeners);
    const stop=event=>{if(drag?.id===event.pointerId)drag=null;};for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,stop,listeners);
    stage.addEventListener('keydown',event=>{const offset={ArrowLeft:[30,0],ArrowRight:[-30,0],ArrowUp:[0,30],ArrowDown:[0,-30]}[event.key];if(offset && stage.classList.contains('can-pan')){event.preventDefault();pan.x+=offset[0];pan.y+=offset[1];draw();}},listeners);
    const observer=new ResizeObserver(draw);observer.observe(stage);clean=()=>observer.disconnect();
  } else if(kind==='markdown') {
    const article=node('article','Loading document…','reading');body.append(article);
    (async()=>{if(item.bytes>2097152)throw Error('This document is too large to preview. Use Download.');const response=await fetch(url,{signal});if(!response.ok)throw Error('Could not load this document. Try Open original.');const text=await response.text();if(alive())article.innerHTML=markdown(text);})().catch(error=>{if(alive())article.textContent=error.message;});
  } else if(['html','pdf','folder'].includes(kind)) {
    const iframe=node('iframe');iframe.title=item.title;iframe.src=url;if(kind==='html')iframe.sandbox='allow-scripts';body.append(iframe);if(kind==='pdf')status('PDF not showing? Use Open original or Download.');
  } else fallback('Download this file to open it in your preferred app.');
  return ()=>{abort.abort();clean();body.replaceChildren();tools.replaceChildren();tools.hidden=true;};
}
