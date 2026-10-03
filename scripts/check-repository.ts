import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const files=execFileSync("rg",["--files","--hidden","-g","!.git","-g","!node_modules","-g","!dist","-g","!.env*","-g",".env.example"],{encoding:"utf8"}).trim().split("\n");
const forbidden=new RegExp(["supa","base"].join(""),"i");
let failed=false;
for(const path of files) {
  const text=await readFile(path,"utf8");
  for(const [i,line] of text.split("\n").entries()) {
    if(forbidden.test(line) && !(path==="README.md" && line==="The schema is Postgres-first and does not depend on "+["Supa","base"].join("")+".")) {
      console.error(`Forbidden provider reference: ${path}:${i+1}`);failed=true;
    }
    if(line.includes("\u2014")) {console.error(`Forbidden punctuation: ${path}:${i+1}`);failed=true;}
  }
}
if(failed) process.exitCode=1;else console.log("Repository provider and punctuation checks passed");
