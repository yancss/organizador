const fs=require('fs');const path=require('path');
function walk(dir){let out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,ent.name);
  if(ent.isDirectory()) out=out.concat(walk(p));
  else out.push(p);
}return out;}
const root=path.join(__dirname,'src','app','app');
const files=walk(root).filter(f=>f.endsWith('.ts')||f.endsWith('.tsx'));
for(const f of files){
  const t=fs.readFileSync(f,'utf8');
  if(t.includes('alert(') || t.includes('confirm(')){
    console.log(path.relative(__dirname,f));
  }
}
