// Optional browser smoke test. Uses an existing Playwright install; no runtime dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/store.js';
import {createServer} from '../src/server.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TSHARE_PLAYWRIGHT_MODULE || 'playwright');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-viewer-browser-'));
const store=new Store(path.join(root,'library'));let server,readonlyServer,browser;
const source=path.join(root,'source');fs.mkdirSync(source);
const output=process.env.TSHARE_SCREENSHOT_DIR || os.tmpdir();fs.mkdirSync(output,{recursive:true});
try {
  fs.copyFileSync(fileURLToPath(new URL('../test/fixtures/clip.mp4',import.meta.url)),path.join(source,'clip.mp4'));store.share(path.join(source,'clip.mp4'),{name:'clip'});
  fs.writeFileSync(path.join(source,'image.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#eaf0fc"/><rect x="80" y="80" width="300" height="180" fill="#175bdb"/><text x="80" y="340" font-size="64">Sample review image</text></svg>');store.share(path.join(source,'image.svg'),{name:'image'});
  fs.writeFileSync(path.join(source,'report.html'),'<html><meta name="viewport" content="width=device-width"><h1>Responsive report</h1><style>body{font:18px system-ui}</style></html>');store.share(path.join(source,'report.html'),{name:'html'});
  const markdown='# Research notes\n\n## Summary\nRead and review together.\n\n## Assumptions\nSample content.\n\n```js\nconst answer = "<script>alert(1)</script>";\n```\n\n## Assumptions\nAnother section.\n\n| Name | Value |\n| --- | --- |\n| sample | 42 |\n\n<img src=x onerror="window.injected=true">\n\n[bad](javascript:alert(1))\n';
  fs.writeFileSync(path.join(source,'notes.md'),markdown);store.share(path.join(source,'notes.md'),{name:'notes'});
  fs.writeFileSync(path.join(source,'bad.mp4'),'not a playable video');store.share(path.join(source,'bad.mp4'),{name:'bad-video'});
  fs.writeFileSync(path.join(source,'other.bin'),'synthetic unknown file');store.share(path.join(source,'other.bin'),{name:'other'});
  const folder=path.join(source,'folder');fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'notes.txt'),'Synthetic folder content');store.share(folder,{name:'folder'});
  // A one-page synthetic PDF; native rendering is browser-dependent, so assert the served frame and fallback.
  fs.writeFileSync(path.join(source,'page.pdf'),'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');store.share(path.join(source,'page.pdf'),{name:'pdf'});
  for(const name of ['clip','image'])store.feedback.create(name,{revisionId:store.get(name).object,kind:'question',message:'Could you review this version?',author:'Sample reviewer'});
  server=createServer(store,{ui:true,password:'browser-test-only'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.TSHARE_BROWSER_EXECUTABLE?{executablePath:process.env.TSHARE_BROWSER_EXECUTABLE}:{})});
  const context=await browser.newContext({httpCredentials:{username:'tshare',password:'browser-test-only'},viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/?type=video#item=clip');await page.waitForFunction(()=>document.querySelector('video')?.duration>0);assert.equal(await page.locator('.card').count(),2);
  assert.ok(await page.locator('#review-panel').isHidden());await page.locator('#review-toggle').click();
  const beside=await page.evaluate(()=>{const content=document.querySelector('.viewer-content').getBoundingClientRect(),review=document.querySelector('#review-panel').getBoundingClientRect();return content.right<=review.left;});assert.ok(beside);
  await page.locator('video').evaluate(async video=>{video.muted=true;await video.play();});await page.waitForFunction(()=>document.querySelector('video').currentTime>.1);await page.locator('video').evaluate(video=>{video.pause();video.currentTime=2;});
  await page.locator('#view-button').click();await page.getByRole('button',{name:'Copy this moment',exact:true}).click();const link=await page.evaluate(()=>navigator.clipboard.readText()),hash=new URLSearchParams(new URL(link).hash.slice(1));assert.equal(hash.get('revision'),store.get('clip').object);assert.equal(hash.get('t'),'2');
  fs.writeFileSync(path.join(source,'clip.mp4'),fs.readFileSync(fileURLToPath(new URL('../test/fixtures/clip.mp4',import.meta.url))));store.share(path.join(source,'clip.mp4'),{name:'clip'});
  await page.goto(link);await page.waitForFunction(()=>document.querySelector('video')?.currentTime>=1.9);await page.locator('#revision-button').click();assert.equal(await page.locator('#revision-menu a[aria-current=true]').getAttribute('href'),'#item=clip&revision='+hash.get('revision'));await page.keyboard.press('Escape');
  await page.evaluate(()=>{window.previousVideo=document.querySelector('video');location.hash='item=image';});await page.waitForFunction(()=>document.querySelector('.image-stage img')?.naturalWidth>0);await page.waitForFunction(()=>document.querySelector('.zoom-label')?.textContent!=='Loading…');assert.ok(await page.evaluate(()=>window.previousVideo.paused&&!window.previousVideo.hasAttribute('src')));
  await page.locator('#view-button').click();await page.getByRole('button',{name:'Actual size',exact:true}).click();assert.equal(await page.locator('.zoom-label').textContent(),'100%');
  await page.keyboard.press('Escape');const stage=page.locator('.image-stage'),box=await stage.boundingBox(),before=await page.locator('.image-stage img').getAttribute('style');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2+40);await page.mouse.up();assert.notEqual(await page.locator('.image-stage img').getAttribute('style'),before);
  await page.locator('#view-button').click();await page.getByRole('button',{name:'Fit',exact:true}).click();assert.ok(parseInt(await page.locator('.zoom-label').textContent())<100);
  await page.keyboard.press('Escape');await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>{const dialog=document.querySelector('#viewer');return dialog.scrollWidth>dialog.clientWidth+1;}),false);
  await page.locator('#review-toggle').click();assert.ok(await page.locator('#review-panel').isVisible());assert.equal(await page.locator('#review-panel').getAttribute('aria-modal'),'true');assert.ok(await page.locator('#viewer-bar').evaluate(el=>el.inert));await page.keyboard.press('Escape');assert.ok(await page.locator('#review-panel').isHidden());assert.equal(await page.locator('#review-toggle').evaluate(el=>el===document.activeElement),true);
  await page.screenshot({path:path.join(output,'tshare-viewer-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(output,'tshare-viewer-desktop.png')});
  await page.goto(origin+'/#item=html');await page.locator('#view-button').waitFor({state:'visible'});await page.locator('#view-button').click();await page.getByRole('button',{name:'Phone · 375',exact:true}).waitFor();
  assert.equal(await page.locator('.html-viewport iframe').getAttribute('sandbox'),'allow-scripts');
  await page.getByRole('button',{name:'Phone · 375',exact:true}).click();assert.equal(await page.locator('.html-viewport iframe').evaluate(iframe=>Math.round(iframe.getBoundingClientRect().width)),375);
  await page.getByRole('button',{name:'Tablet · 768',exact:true}).click();assert.equal(await page.locator('.html-viewport iframe').evaluate(iframe=>Math.round(iframe.getBoundingClientRect().width)),768);
  await page.getByRole('button',{name:'Reload preview',exact:true}).click();await page.keyboard.press('Escape');
  await page.goto(origin+'/#item=notes');await page.locator('.reading table').waitFor();assert.equal(await page.locator('.reading img,.reading script,.reading a[href^="javascript:"]').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
  const ids=await page.locator('.reading h1,.reading h2').evaluateAll(headings=>headings.map(h=>h.id));assert.equal(new Set(ids).size,4);
  await page.getByRole('button',{name:'Assumptions',exact:true}).first().click();await page.getByRole('button',{name:'Copy code',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'const answer = "<script>alert(1)</script>";');
  await page.locator('#view-button').click();await page.getByRole('button',{name:'View source',exact:true}).click();assert.equal(await page.locator('.source-view').textContent(),markdown);assert.ok(await page.locator('.markdown-reader').isHidden());await page.getByRole('button',{name:'Read report',exact:true}).click();assert.ok(await page.locator('.source-view').isHidden());await page.keyboard.press('Escape');
  await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>{const d=document.querySelector('#viewer');return d.scrollWidth>d.clientWidth+1;}),false);await page.screenshot({path:path.join(output,'tshare-viewer-markdown-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(output,'tshare-viewer-markdown-desktop.png')});
  await page.goto(origin+'/#item=bad-video');await page.locator('.download-fallback').waitFor();assert.match(await page.locator('.download-fallback').textContent(),/cannot be played/);
  let intercepted;const pending=new Promise(resolve=>intercepted=resolve);await page.route('**/revision/notes/*/notes.md',async route=>{intercepted();await new Promise(resolve=>setTimeout(resolve,300));await route.continue().catch(()=>{});});
  await page.evaluate(()=>{location.hash='item=notes';});await pending;await page.evaluate(()=>{location.hash='item=image';});await page.waitForFunction(()=>document.querySelector('.image-stage img')?.naturalWidth>0);await new Promise(resolve=>setTimeout(resolve,350));assert.equal(await page.locator('.reading').count(),0);
  await page.goto(origin+'/#item=html');await page.locator('#review-toggle:not([disabled])').waitFor();assert.ok(await page.locator('#review-panel').isHidden());await page.locator('#review-toggle').click();
  await page.locator('#review-identity-toggle').click();await page.locator('#review-author').fill('Sample reviewer');
  await page.locator('#feedback-message').fill('Clarify the assumptions.');await page.locator('#feedback-kind').selectOption('change_request');await page.locator('#feedback-submit').click();await page.locator('.feedback-thread').waitFor();await page.locator('#viewer-title').click();await page.screenshot({path:path.join(output,'tshare-review-desktop.png')});
  assert.equal(store.feedback.list('html')[0].message,'Clarify the assumptions.');assert.equal(await page.locator('.review-editor').count(),0);
  await page.getByRole('button',{name:'Reply',exact:true}).click();await page.getByRole('textbox',{name:'Reply',exact:true}).fill('I will clarify them.');await page.getByRole('button',{name:'Send reply',exact:true}).click();await page.getByText('I will clarify them.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Record resolution',exact:true}).click();assert.equal(await page.locator('.resolution-choice input').isChecked(),false);await page.getByRole('button',{name:'Record resolution',exact:true}).last().click();assert.match(await page.locator('#review-status').textContent(),/explicitly select/);assert.equal(store.feedback.list('html')[0].status,'open');await page.getByRole('button',{name:'Cancel',exact:true}).click();
  const reviewed=store.get('html').object;await page.locator('#feedback-message').fill('Draft for the old revision');fs.writeFileSync(path.join(source,'report.html'),'<h1>Clarified assumptions</h1>');const latest=store.share(path.join(source,'report.html'),{name:'html'});
  await page.evaluate(id=>{location.hash='item=html&revision='+id;},latest.object);await page.waitForFunction(()=>document.querySelector('#revision-button').textContent.includes('v2'));assert.equal(await page.locator('#feedback-message').inputValue(),'');assert.ok(await page.locator('#review-panel').isVisible());
  await page.getByRole('button',{name:'Record resolution',exact:true}).click();assert.equal(await page.locator('.resolution-choice input').isChecked(),false);await page.locator('.resolution-choice input').check();await page.getByRole('button',{name:'Record resolution',exact:true}).last().click();await page.getByText('✓ Resolved',{exact:true}).waitFor();assert.equal(store.feedback.list('html')[0].resolution_revision_id,latest.object);
  await page.locator('#feedback-open').click();assert.equal(await page.locator('.feedback-thread').count(),0);await page.locator('#feedback-all').click();await page.locator('.feedback-thread').waitFor();
  await page.locator('#revision-button').click();await page.locator('#revision-menu a').filter({hasText:'v1'}).click();await page.waitForFunction(()=>document.querySelector('#revision-button').textContent.includes('v1'));assert.equal(await page.locator('#feedback-message').inputValue(),'Draft for the old revision');assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('revision'),reviewed);
  await page.setViewportSize({width:375,height:812});await page.waitForFunction(()=>document.querySelector('#review-panel').getAttribute('aria-modal')==='true');await page.screenshot({path:path.join(output,'tshare-review-mobile.png')});await page.locator('#review-close').focus();await page.keyboard.press('Shift+Tab');assert.ok(await page.evaluate(()=>document.querySelector('#review-panel').contains(document.activeElement)));await page.keyboard.press('Escape');assert.ok(await page.locator('#review-panel').isHidden());assert.equal(await page.locator('#viewer-bar').evaluate(el=>el.inert),false);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#viewer').open);
  for(const name of ['folder','pdf','other']){
    await page.goto(origin+'/#item='+name);await page.locator('#review-toggle:not([disabled])').waitFor();assert.ok(await page.locator('#view-button').isHidden());
    if(name==='other')await page.locator('.download-fallback').waitFor();else assert.equal(await page.locator('#viewer-body>iframe').count(),1);
    if(name==='pdf')assert.match(await page.locator('#viewer-status').textContent(),/Open original or Download/);
    await page.locator('#more-button').click();assert.match(await page.locator('#download').getAttribute('href'),/\?download$/);assert.match(await page.locator('#original').getAttribute('href'),/^\/revision\//);await page.keyboard.press('Escape');
    for(const width of [320,375,430]){await page.setViewportSize({width,height:812});assert.equal(await page.locator('#viewer').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);}
  }
  await page.locator('#more-button').click();page.once('dialog',dialog=>dialog.dismiss());await page.locator('#remove').click();assert.ok(store.get('other'));
  await page.locator('#more-button').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#remove').click();await page.waitForFunction(()=>!document.querySelector('#viewer').open);assert.equal(store.get('other'),undefined);
  readonlyServer=createServer(store,{ui:true});await new Promise(resolve=>readonlyServer.listen(0,'127.0.0.1',resolve));await page.goto(`http://127.0.0.1:${readonlyServer.address().port}/#item=notes`);await page.locator('.reading table').waitFor();assert.ok(await page.locator('#feedback-form').isHidden());assert.ok(await page.locator('#remove').isDisabled());
  await page.getByRole('button',{name:'Back to library',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#viewer').open);assert.equal(await page.locator('#viewer-body').textContent(),'');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({videoPlayback:true,revisionPinnedTimeLink:true,mediaCleanup:true,imageZoomAndPan:true,htmlWidthsAndSandbox:true,markdownOutlineAndSource:true,codeCopy:true,inertMarkdown:true,unsupportedVideoFallback:true,staleReadCancelled:true,contextualReplyAndResolution:true,revisionScopedDrafts:true,mobileFocusAndEscape:true,confirmedDeletion:true,readOnly:true,defaultReadMode:true,desktopReviewBeside:true,mobileReviewSheet:true,pageErrors:errors}));
} finally {
  await browser?.close();if(readonlyServer)await new Promise(resolve=>readonlyServer.close(resolve));if(server)await new Promise(resolve=>server.close(resolve));store.close();fs.rmSync(root,{recursive:true,force:true});
}
