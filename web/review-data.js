// Shared transport for reader metadata and review mutations. No identity is
// inferred here: HTTP still enforces the existing shared-owner contract.
export async function feedbackAPI(url, data) {
  const response=await fetch(url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Tshare-Request':'manage'},body:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Request failed.');
  return result;
}
export async function reviewSnapshot(name,requested) {
  const [capabilities,result]=await Promise.all([feedbackAPI('/api/capabilities'),feedbackAPI(`/api/artifacts/${encodeURIComponent(name)}/revisions`)]);
  const revision=requested?result.revisions.find(row=>row.id===requested):result.revisions[0];
  if(!revision)throw Error('This revision is no longer available.');
  return {capabilities,revisions:result.revisions,revision};
}
