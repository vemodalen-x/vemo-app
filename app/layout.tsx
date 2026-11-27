import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Luma Studio · 影调工作台',description:'上传一张照片，探索适合画面光线与色彩的滤镜。',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
