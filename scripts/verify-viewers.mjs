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
const store=new Store(path.join(root,'library'));let server,browser;
const source=path.join(root,'source');fs.mkdirSync(source);
try {
  fs.copyFileSync(fileURLToPath(new URL('../test/fixtures/clip.mp4',import.meta.url)),path.join(source,'clip.mp4'));store.share(path.join(source,'clip.mp4'),{name:'clip'});
  fs.writeFileSync(path.join(source,'image.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#eaf0fc"/><rect x="80" y="80" width="300" height="180" fill="#175bdb"/><text x="80" y="340" font-size="64">Sample review image</text></svg>');store.share(path.join(source,'image.svg'),{name:'image'});
  for(const name of ['clip','image'])store.feedback.create(name,{revisionId:store.get(name).object,kind:'question',message:'Could you review this version?',author:'Sample reviewer'});
  server=createServer(store,{ui:true,password:'browser-test-only'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.TSHARE_BROWSER_EXECUTABLE?{executablePath:process.env.TSHARE_BROWSER_EXECUTABLE}:{})});
  const context=await browser.newContext({httpCredentials:{username:'tshare',password:'browser-test-only'},viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/?type=video#item=clip');await page.waitForFunction(()=>document.querySelector('video')?.duration>0);assert.equal(await page.locator('.card').count(),1);
  const beside=await page.evaluate(()=>{const content=document.querySelector('.viewer-content').getBoundingClientRect(),review=document.querySelector('#review-panel').getBoundingClientRect();return content.right<=review.left;});assert.ok(beside);
  await page.locator('video').evaluate(async video=>{video.muted=true;await video.play();});await page.waitForFunction(()=>document.querySelector('video').currentTime>.1);await page.locator('video').evaluate(video=>{video.pause();video.currentTime=2;});
  await page.getByRole('button',{name:'Copy this moment',exact:true}).click();const link=await page.evaluate(()=>navigator.clipboard.readText()),hash=new URLSearchParams(new URL(link).hash.slice(1));assert.equal(hash.get('revision'),store.get('clip').object);assert.equal(hash.get('t'),'2');
  fs.writeFileSync(path.join(source,'clip.mp4'),fs.readFileSync(fileURLToPath(new URL('../test/fixtures/clip.mp4',import.meta.url))));store.share(path.join(source,'clip.mp4'),{name:'clip'});
  await page.goto(link);await page.waitForFunction(()=>document.querySelector('video')?.currentTime>=1.9);assert.equal(await page.locator('#revision-select').inputValue(),hash.get('revision'));
  await page.evaluate(()=>{window.previousVideo=document.querySelector('video');location.hash='item=image';});await page.waitForFunction(()=>document.querySelector('.image-stage img')?.naturalWidth>0);await page.waitForFunction(()=>document.querySelector('.zoom-label')?.textContent!=='Loading…');assert.ok(await page.evaluate(()=>window.previousVideo.paused&&!window.previousVideo.hasAttribute('src')));
  await page.getByRole('button',{name:'Actual size',exact:true}).click();assert.equal(await page.locator('.zoom-label').textContent(),'100%');
  const stage=page.locator('.image-stage'),box=await stage.boundingBox(),before=await page.locator('.image-stage img').getAttribute('style');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+90,box.y+box.height/2+40);await page.mouse.up();assert.notEqual(await page.locator('.image-stage img').getAttribute('style'),before);
  await page.getByRole('button',{name:'Fit',exact:true}).click();assert.ok(parseInt(await page.locator('.zoom-label').textContent())<100);
  await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>{const dialog=document.querySelector('#viewer');return dialog.scrollWidth>dialog.clientWidth+1;}),false);
  assert.ok(await page.evaluate(()=>document.querySelector('#review-panel').getBoundingClientRect().top>=document.querySelector('.viewer-content').getBoundingClientRect().bottom));
  const output=process.env.TSHARE_SCREENSHOT_DIR || os.tmpdir();await page.screenshot({path:path.join(output,'tshare-viewer-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(output,'tshare-viewer-desktop.png')});
  await page.getByRole('button',{name:'Back to library',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#viewer').open);assert.equal(await page.locator('#viewer-body').textContent(),'');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({videoPlayback:true,revisionPinnedTimeLink:true,mediaCleanup:true,imageZoomAndPan:true,desktopReviewBeside:true,mobileReviewBelow:true,pageErrors:errors}));
} finally {
  await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));store.close();fs.rmSync(root,{recursive:true,force:true});
}
