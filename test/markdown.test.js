import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMarkdown} from '../web/markdown.js';

test('reader outline shares unique heading IDs with the parsed blocks and excludes code headings',()=>{
 const source='# Summary\r\n\r\n## Assumptions\r\n\r\n```md\r\n# Not an outline entry\r\n```\r\n\r\n## Assumptions\r\n';
 const model=parseMarkdown(source);assert.deepEqual(model.outline.map(h=>h.id),['section-1','section-2','section-3']);assert.equal(model.outline[1].text,model.outline[2].text);assert.ok(model.blocks.some(b=>b.type==='code'&&b.text==='# Not an outline entry'));
});
test('HTML and unsafe links remain literal data; unfinished fences cannot escape into active content',()=>{
 const html='<img src=x onerror="alert(1)">',link='[run](javascript:alert(1))';
 const model=parseMarkdown(html+'\n\n'+link+'\n\n```html\n<script>alert(1)</script>');
 assert.equal(model.blocks[0].text,html);assert.equal(model.blocks[1].text,link);assert.equal(model.blocks[2].type,'code');assert.equal(model.blocks[2].text,'<script>alert(1)</script>');
 assert.throws(()=>parseMarkdown('x\n'.repeat(20001)),/too many lines/);
});
test('flat lists, quotes, simple tables and incomplete tables remain readable',()=>{
 const model=parseMarkdown('## C#\n\n- First\n- Second\n\n3. Third\n4. Fourth\n\n> Review this.\n> Keep context.\n\n| Name | Value |\n| --- | :---: |\n| <b>literal</b> | 42 |\n\nBad | table\n-- | --');
 assert.equal(model.outline[0].text,'C#');assert.deepEqual(model.blocks.find(b=>b.type==='list'&&!b.ordered).items,['First','Second']);assert.equal(model.blocks.find(b=>b.type==='list'&&b.ordered).start,3);assert.equal(model.blocks.find(b=>b.type==='quote').text,'Review this.\nKeep context.');assert.deepEqual(model.blocks.find(b=>b.type==='table').rows,[['<b>literal</b>','42']]);assert.equal(model.blocks.at(-1).type,'paragraph');
});
