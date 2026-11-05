const fs=require('node:fs'),path=require('node:path');
const project=path.resolve(__dirname,'../示例代码/13-studyhub-accessibility');
const compat=require(path.join(project,'miniprogram/utils/compatibility'));
const {paletteReport}=require(path.join(project,'miniprogram/utils/accessibility'));
const {inspect}=require(path.join(project,'tools/package-info.cjs'));
const result={date:'2026-11-02',project:'13-studyhub-accessibility',kind:'fixedNodeModel',
 versionCases:[['2.10.0','2.9.9'],['2.20','2.20.0'],['unknown','2.20.1']].map(([left,right])=>({left,right,result:compat.compareVersion(left,right)})),
 missingCapabilities:compat.readEnvironment({},undefined),palette:paletteReport(),clientSource:inspect(project),
 realWechat:false,screenReaderVerified:false,skylineCompiled:false,
 note:'固定Node模型，不代表当前手机环境。配色为不透明颜色计算，源码为原始字节；不是整应用无障碍合规、原生截图或实际编译包。'};
fs.writeFileSync(path.resolve(__dirname,'../验证/第十二阶段兼容模型结果.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({versionCases:result.versionCases,palettePairs:result.palette.length,allTeachingColourTargets:result.palette.every(x=>x.meetsTeachingTarget),clientPages:result.clientSource.pageCount,realWechat:false}));
