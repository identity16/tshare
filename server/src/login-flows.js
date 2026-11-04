// Globally scoped pre-login data is isolated by both random state and a
// browser-held binding. Neither raw binding values nor provider tokens persist.
export class PgLoginFlows {
  constructor(database){this.database=database;}
  async save(flow) {
    await this.database.withLoginFlow(flow,c=>c.query('INSERT INTO tshare.login_flows(state_hash,binding_hash,code_verifier,nonce,expires_at) VALUES($1,$2,$3,$4,$5)',[flow.stateHash,flow.bindingHash,flow.codeVerifier,flow.nonce,new Date(flow.expiresAt)]));
  }
  async consume(stateHash,bindingHash) {
    return this.database.withLoginFlow({stateHash,bindingHash},async c=>{
      const {rows}=await c.query('DELETE FROM tshare.login_flows WHERE state_hash=$1 AND binding_hash=$2 RETURNING code_verifier,nonce,expires_at',[stateHash,bindingHash]);
      if(!rows.length)return null;
      return {codeVerifier:rows[0].code_verifier,nonce:rows[0].nonce,expiresAt:rows[0].expires_at.getTime()};
    });
  }
}
