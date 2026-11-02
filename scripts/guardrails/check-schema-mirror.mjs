// Static structure check, not a substitute for Prisma validation or DB tests.
import { readFileSync, readdirSync } from "node:fs";
const ddl = readdirSync("deploy/database/ddl").filter(n => n.endsWith(".sql")).sort().map(n => readFileSync("deploy/database/ddl/"+n,"utf8")).join("\n");
const prisma = readFileSync("portals/app/prisma/schema.prisma","utf8");
const tables = new Map();
for (const m of ddl.matchAll(/CREATE TABLE (\w+\.\w+) \(([\s\S]*?)\n\);/g)) {
  const columns = [...m[2].matchAll(/^  (\w+) (text|uuid|varchar\(\d+\)|bigint|boolean|timestamptz|jsonb|numeric\(30,0\))([^\n]*)/gm)].map(c => ({name:c[1],type:c[2],nullable:!c[3].includes("NOT NULL")&&!c[3].includes("PRIMARY KEY")}));
  tables.set(m[1],columns);
}
const mirrored = new Set();
for (const m of prisma.matchAll(/model \w+ \{([\s\S]*?)\n\}/g)) {
  const body=m[1], schema=body.match(/@@schema\("(\w+)"\)/)?.[1], table=body.match(/@@map\("(\w+)"\)/)?.[1];
  const key=schema+"."+table; const expected=tables.get(key);
  if (!expected || mirrored.has(key)) throw Error("unexpected_model:"+key); mirrored.add(key);
  const fields=[...body.matchAll(/^  (\w+) (String|DateTime|Decimal|Json|BigInt|Boolean)(\?)?([^\n]*)/gm)].map(f => ({name:f[4].match(/@map\("(\w+)"\)/)?.[1]??f[1],type:f[2],nullable:!!f[3],attrs:f[4]}));
  if (fields.length!==expected.length) throw Error("column_count:"+key);
  for(const col of expected){const f=fields.find(f=>f.name===col.name);const type=["text","uuid"].includes(col.type)||col.type.startsWith("varchar")?"String":({timestamptz:"DateTime",jsonb:"Json",bigint:"BigInt",boolean:"Boolean"}[col.type]??"Decimal");
    if(!f || f.type!==type || f.nullable!==col.nullable || type==="Decimal"&&!f.attrs.includes("@db.Decimal(30,0)") || type==="DateTime"&&!f.attrs.includes("@db.Timestamptz()")) throw Error("column_mismatch:"+key+"."+col.name);
    if(col.type==="uuid"&&!f.attrs.includes("@db.Uuid") || col.type.startsWith("varchar")&&!f.attrs.includes("@db.VarChar("+col.type.match(/\d+/)[0]+")")) throw Error("native_type_mismatch:"+key+"."+col.name);
  }
}
if(mirrored.size!==tables.size || tables.size===0) throw Error("table_set_mismatch");
console.log("[schema-mirror] "+tables.size+" tables and columns match (static check only)");
