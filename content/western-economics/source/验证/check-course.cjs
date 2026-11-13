/* Read-only checks of this course, except for its own JSON result file. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Marked } = require('marked');
const hljs = require('highlight.js');
const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'source');
const siteRoot = path.resolve(root, '../..');
const checks = [];
function check(label, fn) { fn(); checks.push(label); }
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
    assert.ok(!e.isSymbolicLink(), 'Unexpected symlink');
    const f = path.join(dir, e.name);
    return e.isDirectory() ? walk(f) : [f];
  });
}
const metaPath = path.join(root, process.argv.includes('--draft') ? 'maintenance/course-meta.json' : 'course.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(siteRoot, 'site.config.json'), 'utf8'));
const files = walk(source), mdFiles = files.filter(f => f.endsWith('.md'));
const chapters = mdFiles.filter(f => path.dirname(f) === source && /^\d{2}-/.test(path.basename(f)) && !/^(00|99)-/.test(path.basename(f))).sort();
check('Stable course identity and existing category', () => {
  assert.equal(meta.id, 'western-economics');
  assert.equal(meta.source, 'source');
  assert.equal(meta.status, 'complete');
  assert.ok(site.categories.some(x => x.id === meta.category));
});
check('Exactly sixty real numbered chapters, no planned stubs', () => {
  assert.equal(chapters.length, 60);
  assert.equal(meta.stats.chapters, 60);
  const all = mdFiles.filter(f => path.dirname(f) === source && /^\d{2}-/.test(path.basename(f)) && !/^(00|99)-/.test(path.basename(f)));
  assert.equal(all.length, 60);
  assert.deepEqual(chapters.map(f => Number(path.basename(f).slice(0,2))), Array.from({length:60}, (_,i)=>i+1));
  assert.equal(meta.groups.length,10);
  assert.equal(meta.stats.examples,58);
});
for (const file of chapters) {
  const body = fs.readFileSync(file, 'utf8');
  check('Teaching structure: ' + path.basename(file), () => {
    assert.ok(body.startsWith('# '));
    assert.ok(body.length > 1500, 'Insufficient chapter body');
    for (const heading of ['学习目标与先修','常见错误','练习与参考答案','完成条件']) assert.ok(body.includes('## ' + heading), heading);
    const n = Number(path.basename(file).slice(0,2));
    assert.equal(meta.groups.filter(g => n >= g.range[0] && n <= g.range[1]).length, 1);
  });
}
let links = 0, images = 0, codeBlocks = 0;
for (const file of mdFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const parser = new Marked({walkTokens(token) {
    if (token.type === 'link' || token.type === 'image') {
      const href = token.href;
      if (/^https?:\/\//i.test(href) || href.startsWith('#')) return;
      assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(href), 'Unsupported link ' + href);
      const target = path.resolve(path.dirname(file), decodeURIComponent(href.split('#')[0]));
      assert.ok(target.startsWith(source + path.sep), 'Link leaves course source: ' + href);
      if (target !== path.join(__dirname, 'content-results-stage10.json')) {
        assert.ok(fs.existsSync(target) && fs.statSync(target).isFile(), file + ': missing ' + href);
      }
      links++;
      if(token.type === 'image') images++;
    }
    if (token.type === 'code') {
      codeBlocks++;
      if (token.lang && hljs.getLanguage(token.lang)) hljs.highlight(token.text, {language:token.lang, ignoreIllegals:true});
    }
  }});
  check('Markdown parses and local links resolve: ' + path.relative(source,file), () => {
    const html = parser.parse(text);
    assert.ok(html.length > 0);
    assert.ok(!/\uFFFD/.test(text), 'Replacement character');
    assert.equal((text.match(/^```/gm) || []).length % 2, 0, 'Unclosed fence');
  });
}
check('All fifty figure sets exist, including generated project figures', () => {
  for(const name of ['market-shift','market-surplus','market-tax','stage4-budget','stage4-effects','stage4-production','stage4-costs','stage4-isocost','stage4-competition','stage4-labor','stage5-monopoly','stage5-cournot','stage5-exchange','stage5-externality','stage5-abatement','stage5-public-good','stage5-information','stage6-value-added','stage6-price-volume','stage6-price-indexes','stage6-labour','stage6-balances','stage6-seasonal','stage6-vintages','stage7-cross','stage7-multiplier','stage7-banking','stage7-money','stage7-is-lm','stage7-policy','stage7-floor','stage8-ad-as','stage8-expectations','stage8-cycles','stage8-fiscal','stage8-rule','stage8-debt','stage8-debt-sensitivity']) {
    const body = fs.readFileSync(path.join(source,'images', name+'.svg'),'utf8');
    assert.ok(body.includes('<svg'));
    assert.ok(!/<script\b/i.test(body));
  }
  for(const name of ['exchange','regimes','compound','solow','saving-consumption','technology','comparison']) {
    const body=fs.readFileSync(path.join(source,'images','stage9-'+name+'.svg'),'utf8');
    assert.ok(body.includes('<svg'));
    assert.ok(!/<script\b/i.test(body));
    assert.ok(fs.statSync(path.join(source,'images','stage9-'+name+'.png')).size>0);
  }
  for(const relative of ['images/stage10-objects','images/stage10-reproduce','最终实践参考结果/regression','最终实践参考结果/sampling','最终实践参考结果/sensitivity']) {
    const body=fs.readFileSync(path.join(source,relative+'.svg'),'utf8');
    assert.ok(body.includes('<svg'));
    assert.ok(!/<script\b/i.test(body));
    assert.ok(fs.statSync(path.join(source,relative+'.png')).size>0);
  }
  assert.equal(images,53); // 50 teaching figures, three reused in the reference report.
});
check('No caches, environments or run artifacts in source', () => {
  for(const file of files) assert.ok(!/[\\/](?:__pycache__|\.venv|node_modules|output)[\\/]/.test(file), file);
});
const runtime = JSON.parse(fs.readFileSync(path.join(__dirname,'example-results.json'),'utf8'));
check('Runtime report passed and covers current program hashes', () => {
  assert.equal(runtime.successful, true);
  for(const [rel, hash] of Object.entries(runtime.sourceHashes)) {
    const current=crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex');
    assert.equal(current, hash, 'Stale runtime verification: '+rel);
  }
});
const stage4 = JSON.parse(fs.readFileSync(path.join(__dirname,'stage4-results.json'),'utf8'));
check('Stage-four runtime report passed and matches every new example', () => {
  assert.equal(stage4.successful,true);
  assert.equal(stage4.preservedPriorFiles,30);
  for(const [rel,hash] of Object.entries(stage4.sourceHashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex'),hash,'Stale stage-four verification: '+rel);
  }
});
const stage5=JSON.parse(fs.readFileSync(path.join(__dirname,'stage5-results.json'),'utf8'));
check('Stage-five runtime report passed and matches every new example', () => {
  assert.equal(stage5.successful,true);
  assert.equal(stage5.preservedPriorFiles,48);
  for(const [rel,hash] of Object.entries(stage5.sourceHashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex'),hash,'Stale stage-five verification: '+rel);
  }
});
const stage6=JSON.parse(fs.readFileSync(path.join(__dirname,'stage6-results.json'),'utf8'));
check('Stage-six runtime report passed and matches every new example and dataset', () => {
  assert.equal(stage6.successful,true);
  assert.equal(stage6.preservedPriorFiles,62);
  assert.equal(Object.keys(stage6.sourceHashes).length,17);
  for(const [rel,hash] of Object.entries(stage6.sourceHashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex'),hash,'Stale stage-six verification: '+rel);
  }
});
const stage7=JSON.parse(fs.readFileSync(path.join(__dirname,'stage7-results.json'),'utf8'));
check('Stage-seven runtime report passed and matches every new example', () => {
  assert.equal(stage7.successful,true);
  assert.equal(stage7.preservedPriorFiles,85);
  assert.equal(Object.keys(stage7.sourceHashes).length,8);
  for(const [rel,hash] of Object.entries(stage7.sourceHashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex'),hash,'Stale stage-seven verification: '+rel);
  }
});
const stage8=JSON.parse(fs.readFileSync(path.join(__dirname,'stage8-results.json'),'utf8'));
check('Stage-eight runtime report passed and matches every new example', () => {
  assert.equal(stage8.successful,true);
  assert.equal(stage8.preservedPriorFiles,99);
  assert.equal(Object.keys(stage8.sourceHashes).length,8);
  for(const [rel,hash] of Object.entries(stage8.sourceHashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex'),hash,'Stale stage-eight verification: '+rel);
  }
});
const stage9=JSON.parse(fs.readFileSync(path.join(__dirname,'stage9-results.json'),'utf8'));
check('Stage-nine runtime report passed and matches every new example', () => {
  assert.equal(stage9.successful,true);
  assert.equal(stage9.preservedPriorFiles,113);
  assert.equal(Object.keys(stage9.sourceHashes).length,8);
  for(const [rel,hash] of Object.entries(stage9.sourceHashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex'),hash,'Stale stage-nine verification: '+rel);
  }
});
const stage10=JSON.parse(fs.readFileSync(path.join(__dirname,'stage10-results.json'),'utf8'));
check('Stage-ten runtime and generated reference outputs match current hashes', () => {
  assert.equal(stage10.successful,true);
  assert.equal(stage10.preservedPriorFiles,127);
  assert.equal(Object.keys(stage10.sourceHashes).length,9);
  assert.equal(Object.keys(stage10.referenceHashes).length,11);
  for(const [rel,hash] of Object.entries({...stage10.sourceHashes,...stage10.referenceHashes})) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,rel))).digest('hex'),hash,'Stale stage-ten verification: '+rel);
  }
});
check('Clean-copy evidence covers the same eleven reference artifacts', () => {
  const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'stage10-reproduction.json'),'utf8'));
  assert.equal(evidence.successful,true);
  assert.equal(evidence.runs.length,2);
  assert.equal(Object.keys(evidence.artifactHashes).length,11);
  for(const [name,hash] of Object.entries(evidence.artifactHashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'最终实践参考结果',name))).digest('hex'),hash);
  }
});
check('All Python examples and CSV/JSON input have recorded source hashes', () => {
  const covered=new Set([...Object.keys(runtime.sourceHashes),...Object.keys(stage4.sourceHashes),...Object.keys(stage5.sourceHashes),...Object.keys(stage6.sourceHashes),...Object.keys(stage7.sourceHashes),...Object.keys(stage8.sourceHashes),...Object.keys(stage9.sourceHashes),...Object.keys(stage10.sourceHashes)]);
  const exampleFiles=files.filter(f=>f.startsWith(path.join(source,'示例代码')+path.sep) && /\.(?:py|csv|json)$/.test(f));
  for(const file of exampleFiles) assert.ok(covered.has(path.relative(source,file).split(path.sep).join('/')));
  assert.equal(exampleFiles.length,79);
});
const report = {
  verifiedDate: '2026-11-13', timezone:'Asia/Shanghai', courseId:meta.id,
  checks:checks.length, chapters:chapters.length, markdownDocuments:mdFiles.length,
  localLinks:links, chapterImageEmbeds:images, codeBlocks, successful:true,
  teachingFigures:50,
  runtimeTestsAcrossBatches:runtime.testsRun+stage4.testsRun+stage5.testsRun+stage6.testsRun+stage7.testsRun+stage8.testsRun+stage9.testsRun+stage10.testsRun,
  subprocessRunsAcrossBatches:runtime.subprocessRuns+stage4.subprocessRuns+stage5.subprocessRuns+stage6.subprocessRuns+stage7.subprocessRuns+stage8.subprocessRuns+stage9.subprocessRuns+stage10.subprocessRuns,
  scope:'Course-local metadata, teaching structure, Marked parsing, highlight.js and local file links; no site build or browser verification',
  labels:checks
};
fs.writeFileSync(path.join(__dirname,'content-results-stage10.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report, labels:undefined}));
