import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const here=new URL('./',import.meta.url);
const sources=[['mileage','https://nssdc.gsfc.nasa.gov/planetary/mars_mileage_guide.html'],['coordinate-guidance','https://planetarynames.wr.usgs.gov/Page/MARS/system'],['olympus','https://planetarynames.wr.usgs.gov/Feature/4453'],['valles-marineris','https://planetarynames.wr.usgs.gov/Feature/6288'],['elysium-mons','https://planetarynames.wr.usgs.gov/Feature/1783'],['gale','https://planetarynames.wr.usgs.gov/Feature/2071'],['jezero','https://planetarynames.wr.usgs.gov/Feature/14300']];
const receipts=[];
await Promise.all(sources.map(async([name,url])=>{const retrievedAt=new Date().toISOString();try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});const b=Buffer.from(await r.arrayBuffer());await writeFile(new URL(name+'.html',here),b);receipts.push({name,requestedUrl:url,finalUrl:r.url,status:r.status,retrievedAt,contentType:r.headers.get('content-type'),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});console.log(name,r.status,b.length);}catch(e){receipts.push({name,requestedUrl:url,retrievedAt,error:String(e)});console.log(name,String(e));}}));
await writeFile(new URL('source-http.json',here),JSON.stringify(receipts,null,2)+'\n');
