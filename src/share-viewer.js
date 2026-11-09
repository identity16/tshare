import fs from 'node:fs';
const template=fs.readFileSync(new URL('../web/share.html',import.meta.url),'utf8');
// .tshare cannot be an artifact name. Keep reader resources below /share so
// a proxy can expose shared links without proxying the library root or API.
export const sharedAssets=new Set(['share.js','share.css','viewer.js','markdown.js','style.css','reader.css']);
export function sharePage(item){
  const data=JSON.stringify({name:item.name,title:item.title,description:item.description,kind:item.kind,entry:item.entry,bytes:item.bytes,reviewRevision:item.object,number:item.number??item.revision})
    .replace(/[<>&\u2028\u2029]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
  return template.replace('<!--SHARE_DATA-->',()=>data);
}
