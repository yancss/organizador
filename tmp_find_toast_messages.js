const fs=require('fs'),path=require('path');
function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){
 const p=path.join(d,e.name); if(e.isDirectory()) o=o.concat(walk(p)); else o.push(p);
}return o;}
const files=walk(path.join(__dirname,'src')).filter(f=>/\.(ts|tsx)$/.test(f));
for(const f of files){const t=fs.readFileSync(f,'utf8'); if(t.includes('toast-messages')) console.log(path.relative(__dirname,f));}
