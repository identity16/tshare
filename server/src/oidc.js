import * as oidc from 'openid-client';
import {createHash,randomBytes} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
function secureURL(value,label){let url;try{url=new URL(value);}catch{throw new TypeError(`Invalid ${label}.`);}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new TypeError(`${label} must be an HTTPS URL without credentials, query or fragment.`);return url;}
export class AuthenticationError extends Error {
  constructor(code){super('Sign-in could not be verified.');this.name='AuthenticationError';this.code=code;this.status=401;}
}

// Issuer/client configuration and optional outbound transport are operator
// inputs, never request parameters. Persistent, one-use flow storage is required.
export async function createOidc({issuer,clientId,clientSecret,redirectUri,flowStore,fetch:transport}) {
  const server=secureURL(issuer,'OIDC issuer'),redirect=secureURL(redirectUri,'Redirect URI');
  if(typeof clientId!=='string'||!clientId||typeof clientSecret!=='string'||!clientSecret)throw new TypeError('OIDC client credentials are required.');
  if(!flowStore||typeof flowStore.save!=='function'||typeof flowStore.consume!=='function')throw new TypeError('Persistent one-use login-flow storage is required.');
  const options={timeout:10,execute:[oidc.enableNonRepudiationChecks]};if(transport)options[oidc.customFetch]=transport;
  const config=await oidc.discovery(server,clientId,{client_secret:clientSecret,id_token_signed_response_alg:'RS256'},oidc.ClientSecretPost(clientSecret),options);
  for(const key of ['authorization_endpoint','token_endpoint','jwks_uri']){
    const endpoint=new URL(config.serverMetadata()[key]);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hash)throw new TypeError('OIDC endpoints must use HTTPS.');
  }
  return {
    async begin(){
      const state=oidc.randomState(),nonce=oidc.randomNonce(),codeVerifier=oidc.randomPKCECodeVerifier(),browserBinding=randomBytes(32).toString('base64url');
      const authorization=oidc.buildAuthorizationUrl(config,{redirect_uri:redirect.href,scope:'openid email profile',response_type:'code',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(codeVerifier),code_challenge_method:'S256'});
      await flowStore.save({stateHash:digest(state),bindingHash:digest(browserBinding),codeVerifier,nonce,expiresAt:Date.now()+600000});
      // The HTTP integration must set browserBinding as an HttpOnly/Secure cookie,
      // never render it into the URL, page, localStorage, or provider parameters.
      return {authorizationUrl:authorization.href,browserBinding};
    },
    async complete(callbackURL,{browserBinding}={}){
      let callback;
      try{callback=new URL(callbackURL);}catch{throw new AuthenticationError('invalid_callback');}
      if(callback.origin!==redirect.origin||callback.pathname!==redirect.pathname||callback.hash||callback.username||callback.password||callback.searchParams.getAll('state').length!==1||callback.searchParams.getAll('code').length!==1)throw new AuthenticationError('invalid_callback');
      const state=callback.searchParams.get('state');
      if(typeof browserBinding!=='string'||browserBinding.length<32||browserBinding.length>128||!state||state.length>512)throw new AuthenticationError('invalid_flow');
      const flow=await flowStore.consume(digest(state),digest(browserBinding));
      if(!flow||!Number.isFinite(flow.expiresAt)||flow.expiresAt<=Date.now())throw new AuthenticationError('invalid_flow');
      let claims;
      try{
        const tokens=await oidc.authorizationCodeGrant(config,callback,{pkceCodeVerifier:flow.codeVerifier,expectedState:state,expectedNonce:flow.nonce,idTokenExpected:true});claims=tokens.claims();
      }catch{throw new AuthenticationError('provider_response');}
      if(!claims||claims.email_verified!==true||typeof claims.email!=='string'||claims.email.length>320||!/^\S+@\S+\.\S+$/.test(claims.email)||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255)throw new AuthenticationError('unverified_identity');
      // Only identity leaves this module. Authentication grants no organization
      // membership, role or application session by itself.
      return {issuer:claims.iss,subject:claims.sub,email:claims.email.toLowerCase(),displayName:(typeof claims.name==='string'&&claims.name.trim()?claims.name.trim():claims.email).slice(0,100)};
    }
  };
}
