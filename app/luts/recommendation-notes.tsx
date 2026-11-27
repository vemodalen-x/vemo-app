export function RecommendationNotes() {
  return <details className="recommendation-notes">
    <summary>追色如何推荐</summary>
    <div>
      <h3>从灵感库找参考</h3>
      <p>先比较原图和参考的亮度范围、暗部、蓝天与植被色等线索，再对符合场景的参考图按影调一致性分组。个人库有照片时自动检索个人库，空库时使用 8 类默认灵感。</p>
      <h3>实渲染与画质检查</h3>
      <p>40 款影调各渲染五档强度，对照参考的亮度区间与 OKLab 色度。高光溢出、压黑和显著偏色会扣分。匹配不足时，会根据原图生成一套可导出的新影调。</p>
      <h3>两个输出</h3>
      <p>下载的 33³ LUT 已包含当前强度、曝光和色温。AI 成片以对应的 LUT 应用图为色彩目标，可以通过三种成对视图检查差异。</p>
    </div>
  </details>;
}
