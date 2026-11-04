// A small, inert Markdown reader. Raw HTML, images and links stay plain text.
// The block model keeps both content rendering and the outline on the same parse.
export function parseMarkdown(source) {
  const lines=source.replaceAll('\r\n','\n').replaceAll('\r','\n').split('\n');
  if(lines.length>20000)throw Error('This document has too many lines to preview. Use Download.');
  const blocks=[],outline=[];let paragraph=[];
  const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[];}};
  const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(value=>value.trim().replaceAll('\\|','|'));
  for(let i=0;i<lines.length;i++) {
    const line=lines[i];
    if(!line.trim()){flush();continue;}
    const fence=/^ {0,3}(`{3,}|~{3,})([^\s]*)\s*$/.exec(line);
    if(fence){
      flush();const content=[];let closed=false;
      while(++i<lines.length){const closing=/^ {0,3}(`{3,}|~{3,})\s*$/.exec(lines[i]);if(closing&&closing[1][0]===fence[1][0]&&closing[1].length>=fence[1].length){closed=true;break;}content.push(lines[i]);}
      blocks.push({type:'code',language:fence[2].slice(0,40),text:content.join('\n')});if(!closed)break;continue;
    }
    const heading=/^ {0,3}(#{1,6})\s+(.+)$/.exec(line);
    if(heading){flush();const block={type:'heading',level:heading[1].length,text:heading[2].replace(/\s+#+\s*$/,'').trim(),id:'section-'+(outline.length+1)};blocks.push(block);outline.push(block);continue;}
    if(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)){flush();blocks.push({type:'rule'});continue;}
    if(/^ {0,3}> ?/.test(line)){
      flush();const quoted=[];while(i<lines.length&&/^ {0,3}> ?/.test(lines[i]))quoted.push(lines[i++].replace(/^ {0,3}> ?/,''));i--;blocks.push({type:'quote',text:quoted.join('\n')});continue;
    }
    const list=/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/.exec(line);
    if(list){
      flush();const ordered=/^\d/.test(list[1]),items=[];const start=ordered?Math.min(Number.parseInt(list[1],10),1000000):1;
      while(i<lines.length){const entry=/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/.exec(lines[i]);if(!entry||/^\d/.test(entry[1])!==ordered)break;items.push(entry[2]);i++;}i--;blocks.push({type:'list',ordered,start,items});continue;
    }
    if(i+1<lines.length && line.includes('|')){
      const headers=cells(line),separator=cells(lines[i+1]);
      if(headers.length>=2&&headers.length<=64&&headers.length===separator.length&&separator.every(cell=>/^:?-{3,}:?$/.test(cell))){
        flush();const rows=[];i+=2;for(;i<lines.length&&lines[i].trim()&&lines[i].includes('|');i++)rows.push(cells(lines[i]).slice(0,headers.length));i--;blocks.push({type:'table',headers,rows});continue;
      }
    }
    paragraph.push(line);
  }
  flush();return {blocks,outline};
}
function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function inline(parent,text) {
  const tokens=/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;let start=0;
  for(const match of text.matchAll(tokens)){
    parent.append(document.createTextNode(text.slice(start,match.index)));
    parent.append(element(match[0].startsWith('`')?'code':'strong',match[0].startsWith('`')?match[0].slice(1,-1):match[0].slice(2,-2)));start=match.index+match[0].length;
  }
  parent.append(document.createTextNode(text.slice(start)));
}
export function renderMarkdown(model,{copy}) {
  const article=element('article');article.className='reading';
  for(const block of model.blocks){
    let node;
    if(block.type==='heading'){node=element('h'+block.level);node.id=block.id;inline(node,block.text);}
    else if(block.type==='code'){
      node=element('div');node.className='code-block';const bar=element('div');bar.className='code-bar';bar.append(element('span',block.language||'Code'));const button=element('button','Copy code');button.type='button';button.onclick=()=>copy(block.text,'Code copied.');bar.append(button);const pre=element('pre');pre.append(element('code',block.text));node.append(bar,pre);
    } else if(block.type==='list'){
      node=element(block.ordered?'ol':'ul');if(block.ordered)node.start=block.start;for(const item of block.items){const li=element('li');inline(li,item);node.append(li);}
    } else if(block.type==='table'){
      node=element('div');node.className='table-scroll';const table=element('table'),head=element('thead'),header=element('tr'),body=element('tbody');for(const title of block.headers){const th=element('th');th.scope='col';inline(th,title);header.append(th);}head.append(header);
      for(const row of block.rows){const tr=element('tr');for(let i=0;i<block.headers.length;i++){const td=element('td');inline(td,row[i]||'');tr.append(td);}body.append(tr);}table.append(head,body);node.append(table);
    } else if(block.type==='rule')node=element('hr');
    else {node=element(block.type==='quote'?'blockquote':'p');inline(node,block.text);}
    article.append(node);
  }
  return article;
}
