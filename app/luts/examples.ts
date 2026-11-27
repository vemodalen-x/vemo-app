import baseExamples from './look-examples.json';
import { professionalLooks } from './professional-looks';

export type LookExample = {
  title: string;
  scene: string;
  note: string;
  strength: number;
  study?: string;
  originalFile?: string;
  sourceLook?: string;
};

const originals: Record<string, LookExample> = baseExamples;
const professionalExamples = Object.fromEntries(professionalLooks.map(look => {
  const { title, scene } = originals[look.sourceLook];
  return [look.id, { title, scene, sourceLook: look.sourceLook, note: look.note, strength: look.strength }];
}));

export const examples: Record<string, LookExample> = { ...originals, ...professionalExamples };

export function originalAsset(id: string) {
  const sourceId = examples[id]?.sourceLook ?? id;
  const file = examples[sourceId]?.originalFile ?? 'original.webp';
  return `/look-examples/${sourceId}/${file}`;
}
