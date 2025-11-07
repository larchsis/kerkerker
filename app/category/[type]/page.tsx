'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DoubanCard from '@/components/DoubanCard';
import { DoubanMovie } from '@/types/douban';

// URL 路径到分类名称的映射
const CATEGORY_NAMES: Record<string, string> = {
  'in_theaters': '豆瓣热映',
  'top250': '豆瓣 Top 250',
  'hot_movies': '热门电影',
  'hot_tv': '热门电视',
  'us_tv': '美剧',
  'jp_tv': '日剧',
  'kr_tv': '韩剧',
  'anime': '日本动画',
};

// 新 API 返回的数据结构
interface NewApiMovie {
  id: string;
  title: string;
  rate: string;
  cover: string;
  url: string;
  [key: string]: unknown;
}

interface CategoryData {
  name: string;
  data: NewApiMovie[];
}

export default function CategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryType = params.type as string;
  
  const [movies, setMovies] = useState<DoubanMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingMovie, setMatchingMovie] = useState<string | null>(null);

  const categoryName = CATEGORY_NAMES[categoryType] || '影视列表';

  useEffect(() => {
    fetchCategoryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryType]);

  const fetchCategoryData = async () => {
    setLoading(true);
    try {
      // Top250 使用专门的 API
      if (categoryType === 'top250') {
        const response = await fetch('/api/douban/250');
        const result = await response.json();
        
        if (result.code === 200 && result.data?.subjects) {
          setMovies(result.data.subjects);
        }
      } else {
        // 其他分类从新 API 获取数据
        const response = await fetch('/api/douban/new');
        const result = await response.json();
        
        if (result.code === 200 && result.data) {
          const categories: CategoryData[] = result.data;
          
          // 根据 categoryType 找到对应的分类数据
          const targetCategoryName = CATEGORY_NAMES[categoryType];
          const targetCategory = categories.find(cat => cat.name === targetCategoryName);
          
          if (targetCategory && targetCategory.data) {
            // 转换为 DoubanMovie 格式
            const convertedMovies: DoubanMovie[] = targetCategory.data.map((item: NewApiMovie) => ({
              id: item.id,
              title: item.title,
              cover: item.cover || '',
              url: item.url || '',
              rate: item.rate || '',
              episode_info: (item.episode_info as string) || '',
              cover_x: (item.cover_x as number) || 0,
              cover_y: (item.cover_y as number) || 0,
              playable: (item.playable as boolean) || false,
              is_new: (item.is_new as boolean) || false,
            }));
            
            setMovies(convertedMovies);
          }
        }
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 点击影片 - 搜索所有VOD播放源
  const handleMovieClick = async (movie: DoubanMovie) => {
    setMatchingMovie(movie.id);
    try {
      console.log(`🎬 开始搜索《${movie.title}》的所有播放源...`);
      
      const response = await fetch('/api/douban/match-vod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          douban_id: movie.id,
          title: movie.title
        }),
      });

      const result = await response.json();
      
      if (result.code === 200 && result.data?.matches && result.data.matches.length > 0) {
        const matches = result.data.matches;
        console.log(`✅ 找到 ${matches.length} 个可用播放源`);
        
        // 将所有匹配结果存储到localStorage
        localStorage.setItem('multi_source_matches', JSON.stringify({
          douban_id: movie.id,
          title: movie.title,
          matches: matches,
          timestamp: Date.now(),
        }));
        
        // 跳转到第一个匹配源的播放页
        const firstMatch = matches[0];
        router.push(`/play/${firstMatch.vod_id}?source=${firstMatch.source_key}&multi=true`);
      } else {
        console.log(`❌ 所有视频源均未找到《${movie.title}》`);
        alert(
          `未在任何播放源中找到《${movie.title}》\n\n已搜索 ${result.data?.total_sources || 9} 个视频源\n建议：尝试使用其他关键词搜索`
        );
      }
    } catch (error) {
      console.error('搜索播放源失败:', error);
      alert('搜索播放源时出错，请重试');
    } finally {
      setMatchingMovie(null);
    }
  };

  const goBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 顶部导航栏 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black via-black/95 to-transparent">
        <div className="px-4 md:px-12 py-4 md:py-6">
          <div className="flex items-center justify-between">
            {/* 返回按钮 */}
            <button
              onClick={goBack}
              className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors group"
            >
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm md:text-base font-medium">返回</span>
            </button>

            {/* Logo */}
            <h1 className="text-red-600 text-2xl md:text-3xl font-bold tracking-tight">壳儿</h1>
          </div>
        </div>
      </nav>

      {/* 内容区域 */}
      <div className="pt-24 md:pt-32 px-4 md:px-12 pb-12">
        {/* 标题 */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
            {categoryName}
          </h1>
          <p className="text-sm md:text-base text-gray-400">
            {loading ? '正在加载...' : `共 ${movies.length} 部影片`}
          </p>
        </div>

        {loading ? (
          /* 加载状态 */
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-red-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">正在加载精彩内容...</p>
            </div>
          </div>
        ) : (
          /* 影片网格 */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 lg:gap-6">
            {movies.map((movie) => (
              <DoubanCard
                key={movie.id}
                movie={movie}
                onSelect={handleMovieClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* 匹配中遮罩 */}
      {matchingMovie && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-red-600 mx-auto mb-4" />
            <p className="text-white text-lg">正在匹配播放源...</p>
            <p className="text-gray-400 text-sm mt-2">正在搜索所有可用播放源</p>
          </div>
        </div>
      )}
    </div>
  );
}
