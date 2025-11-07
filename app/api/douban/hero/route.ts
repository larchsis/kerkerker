import { NextResponse } from 'next/server';

/**
 * Hero Banner API
 * GET /api/douban/hero
 * 
 * 功能：
 * 1. 获取适合作为 Hero Banner 的电影
 * 2. 提供 PC 端 16:9 横向海报
 * 3. 提供移动端 9:16 竖向海报
 */

interface HeroMovie {
  id: string;
  title: string;
  rate: string;
  cover: string;  // 竖向海报
  poster_horizontal: string;  // 横向海报 16:9
  poster_vertical: string;    // 竖向海报 9:16
  url: string;
  episode_info?: string;
  genres?: string[];
  description?: string;
}

// 内存缓存
let cacheStore: { data: HeroMovie | null; timestamp: number } | null = null;
const CACHE_EXPIRATION = 60 * 60 * 1000; // 缓存1小时

export async function GET() {
  try {
    // 检查缓存
    if (cacheStore && Date.now() - cacheStore.timestamp < CACHE_EXPIRATION && cacheStore.data) {
      return NextResponse.json({
        code: 200,
        data: cacheStore.data,
        source: 'cache'
      });
    }

    console.log('🎬 开始获取 Hero Banner 数据...');

    // 获取豆瓣热映电影
    const hotMoviesUrl = new URL('https://movie.douban.com/j/search_subjects');
    hotMoviesUrl.searchParams.append('type', '');
    hotMoviesUrl.searchParams.append('tag', '热门');
    hotMoviesUrl.searchParams.append('page_limit', '10');
    hotMoviesUrl.searchParams.append('page_start', '0');

    const response = await fetch(hotMoviesUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://movie.douban.com/'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.subjects || data.subjects.length === 0) {
      throw new Error('未获取到电影数据');
    }

    // 选择评分最高的电影作为 Hero
    const sortedMovies = data.subjects.sort((a: { rate: string }, b: { rate: string }) => {
      const rateA = parseFloat(a.rate) || 0;
      const rateB = parseFloat(b.rate) || 0;
      return rateB - rateA;
    });

    const selectedMovie = sortedMovies[0];

    // 尝试获取电影详情以获取更多海报信息
    let movieDetail = null;
    try {
      const movieId = selectedMovie.id;
      const detailResponse = await fetch(`https://movie.douban.com/j/subject_abstract?subject_id=${movieId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://movie.douban.com/'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (detailResponse.ok) {
        movieDetail = await detailResponse.json();
      }
    } catch {
      console.log('获取电影详情失败，使用基础数据');
    }

    // 构建 Hero 数据
    const coverUrl = selectedMovie.cover || '';
    
    // 豆瓣图片 URL 格式转换
    // 原始: https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2561716440.jpg
    // 横向大图: https://img2.doubanio.com/view/photo/l_ratio_poster/public/p2561716440.jpg
    // 竖向大图: https://img2.doubanio.com/view/photo/l/public/p2561716440.jpg
    
    const getHorizontalPoster = (url: string): string => {
      if (!url) return url;
      // 将 s_ratio_poster 或其他尺寸替换为 l_ratio_poster (横向大图)
      return url.replace(/\/view\/photo\/\w+\//, '/view/photo/l_ratio_poster/');
    };

    const getVerticalPoster = (url: string): string => {
      if (!url) return url;
      // 将 s_ratio_poster 替换为 l (竖向大图)
      return url.replace(/\/view\/photo\/\w+_ratio_poster\//, '/view/photo/l/');
    };

    const heroData: HeroMovie = {
      id: selectedMovie.id,
      title: selectedMovie.title,
      rate: selectedMovie.rate,
      cover: coverUrl,
      poster_horizontal: getHorizontalPoster(coverUrl),
      poster_vertical: getVerticalPoster(coverUrl),
      url: selectedMovie.url,
      episode_info: selectedMovie.episode_info || '',
      genres: movieDetail?.subject?.genres || [],
      description: movieDetail?.subject?.intro || ''
    };

    // 更新缓存
    cacheStore = {
      data: heroData,
      timestamp: Date.now()
    };

    console.log('✅ Hero Banner 数据获取成功:', heroData.title);

    return NextResponse.json({
      code: 200,
      data: heroData,
      source: 'fresh'
    });

  } catch (error) {
    console.error('❌ Hero Banner 数据获取失败:', error);
    
    return NextResponse.json(
      {
        code: 500,
        msg: 'error',
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * 清除缓存接口
 * DELETE /api/douban/hero
 */
export async function DELETE() {
  cacheStore = null;
  
  return NextResponse.json({
    code: 200,
    message: 'Hero Banner 缓存已清除'
  });
}
