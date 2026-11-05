const test=require('node:test');
test('故意超过期限的实验',{timeout:30},async t=>{const timer=setInterval(()=>{},1000);t.after(()=>clearInterval(timer));await new Promise(()=>{});});
