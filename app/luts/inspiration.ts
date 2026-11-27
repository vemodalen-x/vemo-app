import {adaptiveRecipe, type Recipe} from '../film';
import {profilePixels, rankAgainstTargets, referenceDistance, type LookProfile, type RecommendationPixels, type RankedLooks, type ReferenceTarget} from './recommend';

export type InspirationPhoto = {
  id: string;
  name: string;
  thumbnail: string;
  profile: LookProfile;
  family?: string;
};

export type InspirationBoard = {
  id: string;
  name: string;
  photos: InspirationPhoto[];
  sourceUrl?: string;
  scene?: LookProfile;
};

export type InspirationMatch = {
  board: InspirationBoard;
  photos: InspirationPhoto[];
  relevance: number;
};

type Candidate = InspirationMatch & {target: ReferenceTarget};

const limit = (value: number, max: number) => Math.min(1, Math.abs(value) / max);

function sceneDistance(source: LookProfile, example: LookProfile) {
  const [s10,s50,s90] = source.quantiles;
  const [r10,r50,r90] = example.quantiles;
  const night = (p: LookProfile) => Math.max(0, .47 - p.quantiles[1]) * (p.support[0] + .36 * p.sky);
  return .19 * limit(s50-r50,.57) + .14 * limit(night(source)-night(example),.31)
    + .09 * limit((s90-s10)-(r90-r10),.56) + .15 * limit(source.foliage-example.foliage,.41)
    + .11 * limit(source.sky-example.sky,.62) + .1 * limit(source.warm-example.warm,.25)
    + .07 * limit(source.blue-example.blue,.43) + .05 * limit(source.pale-example.pale,.42)
    + .10 * limit(source.lamps-example.lamps,.42);
}

function candidates(source: LookProfile, boards: InspirationBoard[], pinned: string | null) {
  const shortlisted = boards.filter(board => board.photos.length && (!pinned || pinned === board.id)).map(board => {
    const examples = board.photos.map(photo => ({
      photo, distance: sceneDistance(source,board.scene ?? photo.profile)
    })).sort((a,b) => a.distance - b.distance);
    return {board,examples,distance:examples[0].distance};
  }).sort((a,b) => a.distance - b.distance).slice(0,3);
  return shortlisted.flatMap(({board, examples}) => {
    if (board.scene) {
      // Default style variants have the same original composition, so score
      // them independently. Averaging them would erase their different looks.
      return examples.map(({photo,distance}) => ({
        board, photos:[photo], relevance:1-distance, target:[{profile:photo.profile,weight:1,family:photo.family}]
      }));
    }
    return examples.slice(0,3).map(anchor => {
      const cluster = [anchor, ...examples.filter(other =>
        other !== anchor && other.distance < anchor.distance + .08
        && referenceDistance(other.photo.profile, anchor.photo.profile, source) < .078
      ).slice(0,2)];
      return {
        board, photos:cluster.map(item => item.photo),
        relevance: 1 - cluster.reduce((sum,item) => sum+item.distance,0) / cluster.length,
        target:cluster.map((item,index) => ({profile:item.photo.profile,weight:index === 0 ? 1 : .65}))
      };
    });
  });
}

function customizedLook(profile: LookProfile): Recipe {
  const [low,mid,high] = profile.quantiles;
  const span = high - low;
  const dark = mid < .34 && profile.support[0] > .4;
  const earthy = profile.foliage > .18;
  const warm = profile.warm > .10;
  const name = dark ? '暗处微光' : earthy ? '林间薄光' : warm ? '暖光留白' : '清光缓调';
  return {
    ...adaptiveRecipe, name,
    en: dark ? 'Light in the Shadows' : earthy ? 'Woodland Light' : warm ? 'Quiet Warmth' : 'Clear Light',
    contrast: dark ? .032 : Math.max(-.045, Math.min(.12, (.59-span)*.28)),
    saturation: dark ? -.047 : Math.max(-.11, Math.min(.10, (.28-profile.vivid)*.35)),
    warmth: dark ? .012 : warm ? .024 : .015,
    split: dark ? .07 : earthy ? .045 : .022,
    lift: dark ? .075 : low < .16 ? .045 : .02
  };
}

function chooseCandidate(available: Candidate[], ranks: RankedLooks[], intentional: boolean) {
  const valid = available.flatMap((candidate,index) => {
    const result = ranks[index];
    if (!intentional && (candidate.relevance < .70 || result.distance > .122 || result.penalty > .07)) return [];
    const ungraded = result.distance + result.improvement;
    if (!intentional && ungraded > .064 && result.improvement < .006) return [];
    return [{candidate,result,
      score: .58*candidate.relevance - 2.35*result.distance - result.penalty + .43*result.improvement
        + .008*(candidate.photos.length-1)}];
  });
  return valid.sort((a,b) => b.score-a.score)[0];
}

export function rankFromInspiration(input: RecommendationPixels, boards: InspirationBoard[], pinned: string | null) {
  const source = profilePixels(input);
  const available = candidates(source,boards,pinned);
  const ranked = rankAgainstTargets(input,[...available.map(entry => entry.target), []]);
  const selected = chooseCandidate(available, ranked, !!pinned);
  if (selected) return { ...selected.result, match: selected.candidate as InspirationMatch, adaptive: false };
  const fresh = rankAgainstTargets(input,[[]],[customizedLook(source)])[0].options[0];
  return {...ranked[ranked.length-1], match:null, adaptive:true, close:false,
    options:[{...fresh,detail:'根据原图生成，保留现有光线和层次'},...ranked[ranked.length-1].options.slice(0,3)]};
}
