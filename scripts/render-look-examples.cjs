// Render the filter library from its ungraded sample files with the workbench renderer.
// Run from the repository root. Pass a folder of source PNGs to initialize missing originals.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const readFileSync = require('node:fs').readFileSync;
const path = require('node:path');
const sharp = require('sharp');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  });
  module._compile(outputText, filename);
};

const { recipes } = require('../app/film.ts');
const { gradePixels } = require('../app/pixels.ts');
const { loadLookBank } = require('../app/luts/bank.ts');
const { measureTone, toneCategories } = require('../app/luts/tones.ts');
const { examples, originalAsset, realExamples } = require('../app/luts/examples.ts');
const { professionalLooks } = require('../app/luts/professional-looks.ts');

global.fetch = async () => new Response(await fs.readFile('public/luma-luts/bank.bin'));
const isFile = file => fs.stat(file).then(info=>info.isFile()).catch(()=>false);

async function main() {
  const sourceDirectory = process.argv[2];
  const selected = new Set(process.argv.slice(3));
  if (selected.delete('--professional')) {
    for (const look of professionalLooks) selected.add(look.id);
  }
  assert.equal(Object.keys(examples).length, recipes.length);
  assert(await loadLookBank(), 'The LUT bank must load before rendering.');
  let rendered = 0;
  const skipped = [];
  const samples = recipes.flatMap(recipe => [examples[recipe.id], realExamples[recipe.id]]
    .filter(Boolean).map(example => ({recipe, example, id: example.assetId ?? recipe.id})));
  for (const {recipe, example, id} of samples) {
    if (selected.size && !selected.has(id)) continue;
    assert(example && example.title && example.note && example.scene);
    const dir = path.join('public','look-examples',id);
    const original = 'public' + originalAsset(recipe.id, example);
    await fs.mkdir(dir,{recursive:true});
    if (!await isFile(original)) {
      assert(!example.sourceLook && !example.assetId, 'Missing original for ' + id);
      const source = example.study ? 'public/samples/'+example.study+'.jpg'
        : sourceDirectory && path.join(sourceDirectory,recipe.id+'.png');
      if (!source || !await isFile(source)) {
        skipped.push(id);
        continue;
      }
      await sharp(source).rotate().toColourspace('srgb').flatten({background:'#151615'})
        .resize(1152,864,{fit:'inside',withoutEnlargement:true}).webp({quality:92,effort:5}).toFile(original);
    }
    const normalized = await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const {data,info:{width,height}} = normalized;
    assert(width >= 480 && height >= 320, 'Sample too small: '+recipe.id);
    const pixels = new Uint8ClampedArray(data.buffer,data.byteOffset,data.byteLength);
    gradePixels(pixels,recipe,{strength:example.strength,exposure:0,temp:0});
    const render = sharp(data,{raw:{width,height,channels:4}}).removeAlpha();
    await render.clone().webp({quality:91,effort:5}).toFile(path.join(dir,'graded.webp'));
    // Match the crop exactly on both sides of the preview.
    const crop = {fit:'cover',position:'centre'};
    await render.resize(720,480,crop)
      .webp({quality:83,effort:5}).toFile(path.join(dir,'thumb.webp'));
    await sharp(original).resize(720,480,crop)
      .webp({quality:83,effort:5}).toFile(path.join(dir,'original-thumb.webp'));
    rendered++;
  }
  console.log(JSON.stringify({rendered,skipped}));
  if (skipped.length) {
    process.exitCode = 1;
    return;
  }

  const toneIndex = {};
  const counts = {};
  const measures = {};
  for (const recipe of recipes) {
    const sample = await sharp(path.join('public','look-examples',recipe.id,'graded.webp'))
      .resize({width:256,height:256,fit:'inside'}).ensureAlpha().raw().toBuffer();
    const measured = measureTone(sample);
    measures[recipe.id] = measured;
    toneIndex[recipe.id] = measured.id;
    counts[measured.id] = (counts[measured.id] ?? 0) + 1;
  }
  const mismatches = professionalLooks.flatMap(({ id, tone }) => {
    const measured = measures[id];
    return measured.id === tone ? [] : [{ id, expected: tone, actual: measured.id, median: measured.median, span: measured.span }];
  });
  assert.equal(mismatches.length, 0, 'Check professional sample targets: ' + JSON.stringify(mismatches));
  for (const [id, { representative }] of Object.entries(toneCategories)) {
    assert.equal(toneIndex[representative], id, 'Check the representative sample for '+id+' ('+representative+')');
    assert((counts[id] ?? 0) >= 5, 'Fewer than five sample filters for ' + id);
  }
  console.log('Verified category counts:', JSON.stringify(counts));
  await fs.writeFile('app/luts/sample-tones.json', JSON.stringify(toneIndex,null,2)+'\n');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
