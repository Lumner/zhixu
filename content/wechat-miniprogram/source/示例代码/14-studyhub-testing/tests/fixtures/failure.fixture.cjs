const test=require('node:test'),assert=require('node:assert/strict');
test('故意失败：四不等于五',()=>assert.equal(2+2,5));
