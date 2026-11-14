import {test} from "node:test";
import assert from "node:assert/strict";
import {RULE_SECTIONS,ruleSectionFromHash} from "./sections";

test("existing analysis links select their parameter section and unknown hashes stay on monitoring",()=>{
 for(const [hash,section] of [["#monitoring-parameters","monitoring"],["#capacity-parameters","capacity"],["#verification-parameters","verification"],["#other-rules","other"]])assert.equal(ruleSectionFromHash(hash),section);
 for(const hash of ["","#capacity","#CAPACITY-PARAMETERS","#capacity-parameters?scope=other"])assert.equal(ruleSectionFromHash(hash),"monitoring");
 assert.equal(new Set(RULE_SECTIONS.map(section=>section.anchor)).size,RULE_SECTIONS.length);
});
