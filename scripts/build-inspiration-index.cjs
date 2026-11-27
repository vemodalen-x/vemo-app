// Derive the bundled search index from the existing style studies.
// Run from the repository root with node scripts/build-inspiration-index.cjs.
const fs = require('node:fs');
const sharp = require('sharp');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  });
  module._compile(outputText, filename);
};

const { profilePixels, recommendationPreviewEdge: edge } = require('../app/luts/recommend.ts');
const { scenes, styles } = require('../app/studies/studies.json');

async function profile(asset) {
  const { data, info } = await sharp('public' + asset).flatten({background:'#151615'}).ensureAlpha()
    .resize(edge,edge,{fit:'inside',kernel:'linear',withoutEnlargement:true})
    .raw().toBuffer({resolveWithObject:true});
  return profilePixels({data:new Uint8ClampedArray(data), width:info.width});
}

async function main() {
  const boards = await Promise.all(scenes.map(async scene => ({
    id: 'default-' + scene.id,
    name: scene.name,
    scene: await profile('/study-assets/' + scene.id + '.webp'),
    photos: await Promise.all(styles.map(async style => {
      const root = '/study-assets/' + scene.id + '/' + style.id;
      return {
        id: scene.id+'-'+style.id,
        name: style.name,
        family: style.id,
        thumbnail: root + '/ImageGen.webp',
        profile: await profile(root + '/ImageGen.webp')
      };
    }))
  })));
  fs.writeFileSync('app/luts/inspiration-defaults.json',JSON.stringify(boards,(_key,value) =>
    typeof value==='number' ? Math.round(value*100000)/100000 : value)+'\n');
}

main().catch(error => {console.error(error);process.exitCode=1});
