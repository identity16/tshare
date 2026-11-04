import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
for (const directory of ['src','test','integration','scripts']) {
  if (!fs.existsSync(directory)) continue;
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith('.js')) continue;
    const result=spawnSync(process.execPath,['--check',path.join(directory,name)],{stdio:'inherit'});
    if (result.status!==0) process.exit(result.status||1);
  }
}
