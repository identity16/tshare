import {TeamDatabase} from './database.js';
import {TeamAccess} from './access.js';
import {PgLoginFlows} from './login-flows.js';
import {createOidc} from './oidc.js';
import {createTeamServer} from './http.js';
// No development login bypass. TLS is terminated by the configured ingress.
const required=name=>{const value=process.env[name];if(!value)throw Error(`Missing ${name}.`);return value;};
let database,server;
try{
 const origin=required('TSHARE_TEAM_ORIGIN');
 database=await new TeamDatabase({connectionString:required('RUNTIME_DATABASE_URL')}).ready();
 const oidc=await createOidc({issuer:'https://accounts.google.com',clientId:required('GOOGLE_CLIENT_ID'),clientSecret:required('GOOGLE_CLIENT_SECRET'),redirectUri:new URL('/auth/google/callback',origin).href,flowStore:new PgLoginFlows(database)});
 server=await createTeamServer({origin,access:new TeamAccess(database),oidc,csrfSecret:required('CSRF_SECRET'),onError:event=>process.stderr.write(JSON.stringify(event)+'\n')});
 const port=Number(process.env.PORT||8792);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT.');
 server.listen(port,process.env.HOST||'127.0.0.1',()=>process.stdout.write('tshare team access server started\n'));
 server.on('error',async()=>{process.stderr.write('Team listener failed.\n');await database.close();process.exitCode=1;});
 const stop=()=>{server.close(async()=>{await database.close();process.exitCode=0;});setTimeout(()=>process.exit(1),10000).unref();};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
}catch{process.stderr.write('Team startup failed. Check database, origin and Google/CSRF configuration.\n');await database?.close();process.exitCode=1;}
