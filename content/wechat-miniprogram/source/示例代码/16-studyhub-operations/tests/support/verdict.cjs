function completePass(result,status,expected){
 const c=result?.summary?.counts;
 return result?.format==='studyhub-node-test-v1'&&status===0&&result.summary.success===true&&Number.isSafeInteger(expected)&&expected>0&&c?.tests===expected&&c.passed===expected&&!c.failed&&!c.cancelled&&!c.skipped&&!c.todo&&Array.isArray(result.scenarios)&&result.scenarios.length===expected&&result.scenarios.every(x=>x.status==='passed');
}
module.exports={completePass};
