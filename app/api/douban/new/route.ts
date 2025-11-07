import { NextResponse } from 'next/server';

// 缓存数据接口
interface CacheData {
  data: CategoryData[];
  timestamp: number;
}

interface CategoryData {
  name: string;
  data: Array<{
    id: string;
    title: string;
    rate: string;
    url: string;
    cover: string;
  }>;
}

// 内存缓存（简单实现，生产环境建议使用 Redis）
let cacheStore: CacheData | null = null;
const CACHE_EXPIRATION = 60 * 60 * 24 * 1000; // 缓存1天（毫秒）

/**
 * 豆瓣数据实时抓取 API
 * GET /api/douban/new
 * 
 * 特性：
 * 1. 内存缓存机制，避免频繁请求
 * 2. 实时抓取豆瓣最新数据
 * 3. 多分类数据聚合
 */
export async function GET() {
  try {
    // 检查缓存
    if (cacheStore && Date.now() - cacheStore.timestamp < CACHE_EXPIRATION) {
      return NextResponse.json({
        code: 200,
        data: cacheStore.data,
        source: 'memory-cache',
        cachedAt: new Date(cacheStore.timestamp).toISOString()
      });
    }

    console.log('🚀 开始抓取豆瓣数据...');

    // 并行抓取所有分类数据
    const [
      remen,
      remenTv,
      guochanTV,
      zongyi,
      meiju,
      riju,
      hanju,
      ribendonghua,
      jilupian
    ] = await Promise.all([
      fetchDoubanData('', '热门'),
      fetchDoubanData('tv', '热门'),
      fetchDoubanData('tv', '国产剧'),
      fetchDoubanData('tv', '综艺'),
      fetchDoubanData('tv', '美剧'),
      fetchDoubanData('tv', '日剧'),
      fetchDoubanData('tv', '韩剧'),
      fetchDoubanData('tv', '日本动画'),
      fetchDoubanData('tv', '纪录片')
    ]);

    const resultData: CategoryData[] = [
      {
        name: '豆瓣热映',
        data: remen.subjects || []
      },
      {
        name: '热门电视',
        data: remenTv.subjects || []
      },
      {
        name: '国产剧',
        data: guochanTV.subjects || []
      },
      {
        name: '综艺',
        data: zongyi.subjects || []
      },
      {
        name: '美剧',
        data: meiju.subjects || []
      },
      {
        name: '日剧',
        data: riju.subjects || []
      },
      {
        name: '韩剧',
        data: hanju.subjects || []
      },
      {
        name: '日本动画',
        data: ribendonghua.subjects || []
      },
      {
        name: '纪录片',
        data: jilupian.subjects || []
      }
    ];

    // 更新缓存
    cacheStore = {
      data: resultData,
      timestamp: Date.now()
    };

    console.log('✅ 豆瓣数据抓取成功');

    return NextResponse.json({
      code: 200,
      data: resultData,
      source: 'fresh-data',
      totalCategories: resultData.length,
      totalItems: resultData.reduce((sum, cat) => sum + cat.data.length, 0)
    });

  } catch (error) {
    console.error('❌ 豆瓣数据抓取失败:', error);
    
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
 * 抓取豆瓣分类数据
 */
async function fetchDoubanData(type: string, tag: string) {
  try {
    const url = new URL('https://movie.douban.com/j/search_subjects');
    url.searchParams.append('type', type);
    url.searchParams.append('tag', tag);
    url.searchParams.append('page_limit', '24');
    url.searchParams.append('page_start', '0');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://movie.douban.com/'
      },
      // 添加超时控制
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`✓ 抓取成功: ${tag} (${data.subjects?.length || 0}条)`);
    
    return data;
  } catch (error) {
    console.error(`✗ 抓取失败: ${tag}`, error);
    return { subjects: [] };
  }
}

/**
 * 清除缓存接口（可选）
 * DELETE /api/douban/new
 */
export async function DELETE() {
  cacheStore = null;
  
  return NextResponse.json({
    code: 200,
    message: '缓存已清除'
  });
}
