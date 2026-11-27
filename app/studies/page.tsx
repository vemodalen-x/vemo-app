import type { Metadata } from 'next';
import { Columns2, Film, Layers3, PanelsTopLeft } from 'lucide-react';
import { StudyGallery } from './study-gallery';
import './studies.css';

export const metadata: Metadata = {
  title: 'Luma Studio · 风格对照',
  description: '在八个场景中比较六种 Image Gen 风格迁移与对应的 3D LUT，查看每组实际使用的提示词。',
};

type SearchParams = { scene?: string | string[]; style?: string | string[]; pair?: string | string[] };

export default async function StudiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  return (
    <>
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="/" aria-label="Luma Studio 工作台">
            <img src="/favicon.svg" width="35" height="35" alt="" />
            <strong>Luma<span>Studio</span></strong>
          </a>
          <nav aria-label="主导航">
            <a href="/"><PanelsTopLeft />工作台</a>
            <a href="/#library"><Layers3 />滤镜库</a>
            <a href="/#samples"><Film />场景样片</a>
            <a href="/studies" className="nav-active" aria-current="page"><Columns2 />风格对照</a>
          </nav>
        </div>
      </header>
      <StudyGallery
        initialScene={typeof query?.scene === 'string' ? query.scene : null}
        initialStyle={typeof query?.style === 'string' ? query.style : null}
        initialPair={typeof query?.pair === 'string' ? query.pair : null}
      />
    </>
  );
}
