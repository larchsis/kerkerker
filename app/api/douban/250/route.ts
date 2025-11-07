import { NextResponse } from 'next/server';

// 缓存数据接口
interface CacheData {
  subjects: Array<{
    id: string;
    title: string;
    rate: string;
    url: string;
    cover: string;
  }>;
  timestamp: number;
}

// 内存缓存
let cacheStore: CacheData | null = null;
const CACHE_EXPIRATION = 60 * 60 * 24 * 1000; // 缓存1天

/**
 * 豆瓣 Top 250 API
 * GET /api/douban/250
 * 
 * 获取完整的 250 部电影数据
 */
export async function GET() {
  try {
    // 检查缓存
    if (cacheStore && Date.now() - cacheStore.timestamp < CACHE_EXPIRATION) {
      return NextResponse.json({
        code: 200,
        data: {
          subjects: cacheStore.subjects,
        },
        source: 'memory-cache',
        cachedAt: new Date(cacheStore.timestamp).toISOString(),
        total: cacheStore.subjects.length,
      });
    }

    console.log('🚀 开始抓取豆瓣 Top 250...');

    // 分批抓取（每批25部，共10批）
    const allMovies: Array<{
      id: string;
      title: string;
      rate: string;
      url: string;
      cover: string;
    }> = [];

    // 并行抓取10批数据
    const batchPromises = [];
    for (let i = 0; i < 10; i++) {
      batchPromises.push(fetchTop250Batch(i * 25));
    }

    const results = await Promise.all(batchPromises);
    
    // 合并结果
    results.forEach(batch => {
      if (batch.subjects) {
        allMovies.push(...batch.subjects);
      }
    });

    console.log(`✅ Top 250 抓取完成，共 ${allMovies.length} 部`);

    // 更新缓存
    cacheStore = {
      subjects: allMovies,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      code: 200,
      data: {
        subjects: allMovies,
      },
      source: 'fresh-data',
      total: allMovies.length,
    });

  } catch (error) {
    console.error('❌ Top 250 抓取失败:', error);
    
    return NextResponse.json(
      {
        code: 500,
        msg: 'error',
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 抓取单批 Top 250 数据
 */
async function fetchTop250Batch(start: number) {
  try {
    const url = new URL('https://movie.douban.com/j/search_subjects');
    url.searchParams.append('type', 'movie');
    url.searchParams.append('tag', '豆瓣高分');
    url.searchParams.append('sort', 'recommend');
    url.searchParams.append('page_limit', '25');
    url.searchParams.append('page_start', start.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://movie.douban.com/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`✓ 抓取 Top 250 第 ${start / 25 + 1} 批: ${data.subjects?.length || 0} 部`);
    
    return data;
  } catch (error) {
    console.error(`✗ 抓取 Top 250 第 ${start / 25 + 1} 批失败:`, error);
    return { subjects: [] };
  }
}

/**
 * 清除缓存
 * DELETE /api/douban/250
 */
export async function DELETE() {
  cacheStore = null;
  
  return NextResponse.json({
    code: 200,
    message: 'Top 250 缓存已清除',
  });
}
