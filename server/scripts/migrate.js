import {migrate} from '../src/database.js';
try{
 if(!process.env.MIGRATION_DATABASE_URL||!process.env.TSHARE_RUNTIME_ROLE)throw Error('configuration');
 const result=await migrate({connectionString:process.env.MIGRATION_DATABASE_URL,runtimeRole:process.env.TSHARE_RUNTIME_ROLE});
 console.log(`Team schema ${result.version} ready.`);
}catch{console.error('Migration failed. Check migration credentials, runtime role and installed schema.');process.exitCode=1;}
