const fs=require('fs');const path=require('path');
function walk(dir){let out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,ent.name);
  if(ent.isDirectory()) out=out.concat(walk(p));
  else out.push(p);
}return out;}
const root=path.join(__dirname,'src','app','app');
const files=walk(root).filter(f=>f.endsWith('.tsx')||f.endsWith('.ts'));
for(const f of files){
  const t=fs.readFileSync(f,'utf8');
  if(!t.includes('alert(')) continue;
  const rel=path.relative(__dirname,f);
  const lines=t.split(/\r?\n/);
  const hits=[];
  for(let i=0;i<lines.length;i++){
    if(lines[i].includes('alert(')) hits.push(`${i+1}:${lines[i].trim()}`);
  }
  console.log(rel+'\n  '+hits.join('\n  ')+'\n');
}
