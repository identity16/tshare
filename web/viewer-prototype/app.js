// THROWAWAY UI study. Synthetic fixtures only; replies are in-memory.
const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.search),variants=['A','B','C'];
const names={A:'A · Review beside the file',B:'B · Read, then discuss',C:'C · Focus on the content'};
const fixtures={
 html:{label:'HTML',title:'Launch review',description:'Try the same page at desktop, tablet and phone widths.',file:'sample-page.html',author:'Sample reviewer',comment:'The cards need to stack cleanly on a phone. Can you check the narrow layout?'},
 markdown:{label:'Markdown',title:'Research notes',description:'Read the report, jump between sections, and copy a code block.',file:'sample-report.md',author:'Sample reviewer',comment:'Could you make the assumptions easier to find before the recommendation?'},
 image:{label:'Image',title:'Interface directions',description:'Zoom in, drag to inspect, then fit the whole image again.',file:'sample-image.svg',author:'Sample reviewer',comment:'The navigation feels quiet. Can we inspect the left edge at full size?'},
 video:{label:'Video',title:'Interaction walkthrough',description:'Play, scrub and share the exact moment you want someone to review.',file:'sample-video.mp4',author:'Sample reviewer',comment:'Can we pause here and discuss the transition?',time:2.4}
};
let type=fixtures[params.get('type')]?params.get('type'):'video',variant=variants.includes(params.get('variant'))?params.get('variant'):'A';
let zoom=1,pan={x:0,y:0},width='100%',sourceMode=false,stamp=Number(params.get('t'))||0,version=Number(params.get('v'))===1?1:2;
const report=`# Research notes\n\n## Summary\nKeep the report and its review in one place.\n\n## Findings\n- Files need different tools.\n- Feedback should stay connected to the reviewed version.\n\n## Assumptions\nThis is synthetic content for a viewer prototype.\n\n## Reproduce\n\`\`\`sh\ntshare ./report.html report\n\`\`\`\n\n## Recommendation\nUse a shared review frame with tools specific to each format.\n`;
const code='tshare ./report.html report';
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
function state(){const video=$('video');$('#state').textContent=JSON.stringify({prototype:true,variant: names[variant],type,version,viewport:width,image:{zoom:Number(zoom.toFixed(2)),pan},time:video?Number(video.currentTime.toFixed(2)):stamp,persistence:'none'},null,2);}
function url(){const query=new URLSearchParams({variant,type});if(type==='video'&&stamp)query.set('t',stamp.toFixed(2));if(version!==2)query.set('v',String(version));history.replaceState(null,'','?'+query);state();}
async function copy(text){try{await navigator.clipboard.writeText(text);$('#status').textContent='Copied.';}catch{$('#status').textContent='Copy this link or text: '+text;}}
function button(label,action){const b=el('button',label);b.type='button';b.onclick=action;return b;}
function addTool(label,action){const b=button(label,action);$('#toolbar').append(b);return b;}
function showVariant(value){variant=value;document.body.dataset.variant=variant;$('#variant-name').textContent=names[variant];url();}
function imageTransform(){const image=$('.image-stage img');if(image)image.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;const label=$('.zoom-label');if(label)label.textContent=Math.round(zoom*100)+'%';state();}
function imageViewer(){
 const stage=el('div',undefined,'image-stage'),image=el('img');image.src='sample-image.svg';image.alt='Three sample interface directions';image.draggable=false;stage.append(image);$('#canvas').append(stage);
 addTool('−',()=>{zoom=Math.max(.25,zoom-.25);imageTransform();});$('#toolbar').append(el('span','100%','zoom-label'));addTool('+',()=>{zoom=Math.min(4,zoom+.25);imageTransform();});
 addTool('Fit',()=>{zoom=1;pan={x:0,y:0};imageTransform();});addTool('Actual size',()=>{zoom=image.naturalWidth/Math.max(image.width,1);pan={x:0,y:0};imageTransform();});$('#toolbar').append(el('span','Drag to inspect','hint'));
 let drag=null;image.onpointerdown=e=>{image.setPointerCapture(e.pointerId);drag={x:e.clientX-pan.x,y:e.clientY-pan.y};};image.onpointermove=e=>{if(!drag)return;pan={x:e.clientX-drag.x,y:e.clientY-drag.y};imageTransform();};image.onpointerup=image.onpointercancel=()=>{drag=null;};
}
function videoViewer(){
 const stage=el('div',undefined,'video-stage'),video=el('video');video.src='sample-video.mp4';video.controls=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label','Synthetic eight-second sample video');stage.append(video);$('#canvas').append(stage);
 video.addEventListener('loadedmetadata',()=>{video.currentTime=Math.min(stamp,video.duration||0);state();});video.addEventListener('timeupdate',()=>{stamp=video.currentTime;const value=$('#time');if(value)value.textContent=stamp.toFixed(1)+'s';state();});
 addTool('−5s',()=>{video.currentTime=Math.max(0,video.currentTime-5);});addTool('+5s',()=>{video.currentTime=Math.min(video.duration||0,video.currentTime+5);});
 const speed=el('select');speed.setAttribute('aria-label','Playback speed');for(const rate of [.5,1,1.5,2]){const o=el('option',rate+'×');o.value=rate;o.selected=rate===1;speed.append(o);}speed.onchange=()=>{video.playbackRate=Number(speed.value);};$('#toolbar').append(speed);
 addTool('Copy this moment',()=>{stamp=video.currentTime;url();copy(location.href);});const time=el('span','0.0s','hint');time.id='time';$('#toolbar').append(time);
}
function samplePage(){const box=el('div',undefined,'web-demo');box.style.width=width;box.innerHTML=`<div class="web-nav"><span>FIELD NOTES</span><span>Draft v${version}</span></div><div class="web-content"><h2>A place for the work between meetings.</h2><p>Sample responsive page. Change the preview width above.</p><div class="web-cards"><div class="web-card"><span>Research</span><strong>Explore</strong></div><div class="web-card"><span>Review</span><strong>Discuss</strong></div><div class="web-card"><span>Decisions</span><strong>Move on</strong></div></div><p>Keep the context close while the details are still fresh.</p></div><footer>Sample artifact · Placeholder content</footer>`;return box;}
function htmlViewer(){
 const stage=el('div',undefined,'html-stage');stage.append(samplePage());$('#canvas').append(stage);
 for(const [label,value]of[['Phone · 375','375px'],['Tablet · 768','768px'],['Desktop','100%']]){const b=addTool(label,()=>{width=value;$('.web-demo').style.width=width;for(const item of $('#toolbar').querySelectorAll('button[data-size]'))item.setAttribute('aria-pressed',String(item.dataset.size===value));state();});b.dataset.size=value;b.setAttribute('aria-pressed',String(value===width));}
 addTool('Reload preview',()=>{stage.replaceChildren(samplePage());$('#status').textContent='Sample preview reloaded.';});
}
function markdownViewer(){
 const toggle=addTool(sourceMode?'Read report':'View source',()=>{sourceMode=!sourceMode;renderViewer();state();});toggle.setAttribute('aria-pressed',String(sourceMode));$('#toolbar').append(el('span','Readable type · section navigation','hint'));
 if(sourceMode){$('#canvas').append(el('pre',report,'raw-source'));return;}
 const toc=el('nav',undefined,'doc-toc');toc.setAttribute('aria-label','Report sections');for(const title of['Summary','Findings','Assumptions','Reproduce','Recommendation'])toc.append(button(title,()=>$('#section-'+title.toLowerCase()).scrollIntoView({block:'start',behavior:'smooth'})));$('#canvas').append(toc);
 const article=el('article',undefined,'document');article.innerHTML='<span class="tag">SAMPLE REPORT · DRAFT</span><h1>Research notes</h1><h2 id="section-summary">Summary</h2><p class="summary">Keep the report and its review in one place.</p><h2 id="section-findings">Findings</h2><ul><li>Files need different tools.</li><li>Feedback should stay connected to the reviewed version.</li></ul><h2 id="section-assumptions">Assumptions</h2><p>This is synthetic content for a viewer prototype. It describes no real customer or research results.</p><h2 id="section-reproduce">Reproduce</h2><pre><code>tshare ./report.html report</code></pre><h2 id="section-recommendation">Recommendation</h2><p>Use a shared review frame with tools specific to each format.</p>';
 article.querySelector('pre').prepend(button('Copy code',()=>copy(code)));$('#canvas').append(article);
}
function renderViewer(){const video=$('video');if(video)video.pause();$('#toolbar').replaceChildren();$('#canvas').replaceChildren();({image:imageViewer,video:videoViewer,html:htmlViewer,markdown:markdownViewer})[type]();}
function comment(author,message,time){const block=el('div',undefined,'comment');block.append(el('small',author+' · sample v'+version));if(time!==undefined){block.append(button(time.toFixed(1)+'s',()=>{const video=$('video');if(video){video.currentTime=time;video.pause();}}));block.lastChild.className='time-link';}block.append(el('p',message));return block;}
function render(){const sample=fixtures[type];$('#types').replaceChildren();for(const [key,item]of Object.entries(fixtures)){const b=button(item.label,()=>{type=key;zoom=1;pan={x:0,y:0};width='100%';sourceMode=false;stamp=0;$('#reply-text').value='';url();render();});b.setAttribute('aria-pressed',String(type===key));$('#types').append(b);}$('#type-label').textContent=sample.label+' · sample artifact';$('#title').textContent=sample.title;$('#description').textContent=sample.description;$('#download').href=sample.file;$('#version').value=String(version);$('#thread').replaceChildren(comment(sample.author,sample.comment,sample.time));$('#status').textContent='';renderViewer();state();}
$('#version').onchange=()=>{version=Number($('#version').value);url();render();};$('#copy-link').onclick=()=>{url();copy(location.href);};$('#reply button').onclick=event=>{event.preventDefault();const value=$('#reply-text').value.trim();if(!value)return;$('#thread').append(comment('You',value,type==='video'?($('video')?.currentTime||0):undefined));$('#reply-text').value='';$('#status').textContent='Sample reply added in this page only.';};
$('#previous').onclick=()=>showVariant(variants[(variants.indexOf(variant)+2)%3]);$('#next').onclick=()=>showVariant(variants[(variants.indexOf(variant)+1)%3]);document.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,video,[contenteditable]'))return;if(event.key==='ArrowLeft')$('#previous').click();if(event.key==='ArrowRight')$('#next').click();});showVariant(variant);render();
