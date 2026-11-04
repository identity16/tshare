export const contentURL = item => `${item.reviewRevision ? '/revision/'+encodeURIComponent(item.name)+'/'+encodeURIComponent(item.reviewRevision) : '/share/'+encodeURIComponent(item.name)}/${item.entry === 'index.html' ? '' : item.entry.split('/').map(encodeURIComponent).join('/')}`;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function markdown(source) {
  return source.split(/(```[\s\S]*?```)/g).map(part=>part.startsWith('```')?`<pre>${escape(part.replace(/^```[^\n]*\n?/, '').replace(/```$/, ''))}</pre>`:part.split(/\n\s*\n/).map(block=>{const heading=/^(#{1,3}) (.*)$/.exec(block);if(heading)return `<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`;if(block.startsWith('> '))return `<blockquote>${escape(block.slice(2)).replaceAll('\n','<br>')}</blockquote>`;return `<p>${escape(block).replaceAll('\n','<br>')}</p>`;}).join('')).join('');
}

// One mounted viewer owns its DOM and pending reads. Replacing it cancels both.
export function mountViewer(item, {body, isCurrent, status}) {
  const abort = new AbortController();
  const alive = () => !abort.signal.aborted && isCurrent();
  body.replaceChildren();
  if (item.kind === 'markdown') {
    const article = document.createElement('article');article.className='reading';article.textContent='Loading document…';body.append(article);
    (async()=>{
      if(item.bytes>2097152)throw Error('This document is too large to preview. Use Download.');
      const response=await fetch(contentURL(item),{signal:abort.signal});
      if(!response.ok)throw Error('Could not load this document. Try Open original.');
      const text=await response.text();if(alive())article.innerHTML=markdown(text);
    })().catch(error=>{if(alive())article.textContent=error.message;});
  } else if (item.kind === 'image') {
    const image=document.createElement('img');image.src=contentURL(item);image.alt=item.title;body.append(image);
  } else if (['html','pdf','folder'].includes(item.kind)) {
    const iframe=document.createElement('iframe');iframe.title=item.title;iframe.src=contentURL(item);if(item.kind==='html')iframe.sandbox='allow-scripts';body.append(iframe);
    if(item.kind==='pdf')status('PDF not showing? Use Open original or Download.');
  } else {
    const wrap=document.createElement('div');wrap.className='download-fallback';
    const message=document.createElement('p');message.textContent='Download this file to open it in your preferred app.';
    const link=document.createElement('a');link.href=contentURL(item)+'?download';link.download='';link.textContent='Download file';wrap.append(message,link);body.append(wrap);
  }
  return () => {abort.abort();body.replaceChildren();};
}
