const fs = require('fs');
const path = require('path');

function walk(dir){
  const out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const root = path.join(__dirname,'src');
const files = walk(root).filter(f=>/\.tsx?$/.test(f));
const hits=[];
for(const f of files){
  const t = fs.readFileSync(f,'utf8');
  if(t.includes('fetch(') && (t.includes('throw new Error(await res.text())') || t.includes('return (await res.json())'))){
    hits.push(f);
  }
}
console.log(hits.map(f=>path.relative(__dirname,f)).join('\n'));
