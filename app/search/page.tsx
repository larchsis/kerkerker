'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Drama } from '@/types/drama';
import { VodSource } from '@/types/drama';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryKeyword = searchParams.get('q') || '';
  
  const [searchKeyword, setSearchKeyword] = useState(queryKeyword);
  const [searchResults, setSearchResults] = useState<Drama[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [allSources, setAllSources] = useState<VodSource[]>([]);
  const [currentSource, setCurrentSource] = useState<VodSource | null>(null);
  
  // 从数据库加载视频源配置
  useEffect(() => {
    const loadSources = async () => {
      try {
        const response = await fetch('/api/vod-sources');
        const result = await response.json();
        
        if (result.code === 200 && result.data) {
          setAllSources(result.data.sources || []);
          setCurrentSource(result.data.selected || null);
        }
      } catch (error) {
        console.error('加载视频源配置失败:', error);
      }
    };
    
    loadSources();
  }, []);

  // 执行搜索
  const performSearch = useCallback(async (keyword: string, sourceKey?: string) => {
    if (!keyword.trim()) return;
    
    // 检查是否有视频源
    if (allSources.length === 0) {
      setSearchResults([]);
      setSearched(true);
      return;
    }
    
    setLoading(true);
    setSearched(true);
    
    try {
      const source = sourceKey 
        ? allSources.find(s => s.key === sourceKey) 
        : currentSource;
      
      if (!source) {
        setSearchResults([]);
        setLoading(false);
        return;
      }
      
      setCurrentSource(source);
      
      console.log(`🔍 使用 ${source.name} 搜索: ${keyword}`);
      
      const response = await fetch('/api/drama/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: source,
          page: 1,
          limit: 50,
          keyword: keyword.trim(),
        }),
      });

      const result = await response.json();
      
      if (result.code === 200 && result.data?.list) {
        setSearchResults(result.data.list);
        console.log(`✅ 找到 ${result.data.list.length} 个结果`);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentSource, allSources]);

  // 初始搜索
  useEffect(() => {
    if (queryKeyword) {
      performSearch(queryKeyword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKeyword]);

  // 处理搜索提交
  const handleSearch = () => {
    if (!searchKeyword.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchKeyword.trim())}`);
  };

  // 切换播放源并重新搜索
  const handleSourceChange = (sourceKey: string) => {
    if (searchKeyword.trim()) {
      performSearch(searchKeyword.trim(), sourceKey);
    }
  };

  // 点击影片 - 直接跳转播放页面
  const handlePlayClick = (drama: Drama) => {
    if (!currentSource) return;
    router.push(`/play/${drama.id}?source=${currentSource.key}`);
  };

  // 返回首页
  const goBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 顶部导航栏 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-gray-800/50">
        <div className="px-4 md:px-12 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            {/* 返回按钮 */}
            <button
              onClick={goBack}
              className="flex items-center space-x-1 md:space-x-2 text-white hover:text-gray-300 transition-colors group"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-xs md:text-sm font-medium">返回</span>
            </button>

            {/* Logo */}
            <h1 className="text-red-600 text-xl md:text-2xl font-bold tracking-tight cursor-pointer hover:text-red-500 transition-colors" onClick={goBack}>
              壳儿
            </h1>
          </div>

          {/* 搜索框 */}
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="flex-1 max-w-4xl">
              <div className="flex items-center bg-gray-900/80 border border-gray-700/50 rounded-lg overflow-hidden focus-within:border-red-600 focus-within:bg-gray-900 transition-all shadow-lg">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="搜索电影、电视剧、动漫..."
                  className="flex-1 bg-transparent px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base outline-none placeholder-gray-500"
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-4 md:px-6 py-2.5 md:py-3 bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 播放源选择器 */}
            {allSources.length > 0 && currentSource ? (
              <select
                value={currentSource.key}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="bg-gray-900/80 border border-gray-700/50 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm outline-none hover:border-gray-600 hover:bg-gray-900 transition-all cursor-pointer shadow-lg"
              >
                {allSources.map(source => (
                  <option key={source.key} value={source.key}>{source.name}</option>
                ))}
              </select>
            ) : (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-2.5 text-xs md:text-sm text-red-400">
                未配置视频源
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 内容区域 */}
      <div className="pt-32 md:pt-36 lg:pt-40 px-4 md:px-12 pb-12">
        {allSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="text-center">
              <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">未配置视频源</h3>
              <p className="text-gray-400 mb-6">请先在后台管理中配置视频源后再使用搜索功能</p>
              <a
                href="/admin/settings"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                前往配置
              </a>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24 md:py-32">
            <div className="text-center animate-fade-in">
              <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-gray-700 border-t-red-600 mx-auto mb-4" />
              <p className="text-gray-300 text-base md:text-lg font-medium">正在搜索...</p>
              {currentSource && <p className="text-gray-500 text-xs md:text-sm mt-2">使用 {currentSource.name} 搜索中</p>}
            </div>
          </div>
        ) : searched ? (
          searchResults.length > 0 ? (
            <div className="animate-fade-in">
              <div className="mb-6 md:mb-8">
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2">
                  搜索结果
                </h2>
                <p className="text-gray-400 text-xs md:text-sm">
                  在 <span className="text-red-500 font-semibold">{currentSource?.name || '未知源'}</span> 中找到 <span className="text-white font-semibold">{searchResults.length}</span> 个结果
                  {queryKeyword && <> · 关键词: <span className="text-white font-medium">&ldquo;{queryKeyword}&rdquo;</span></>}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 md:gap-4 lg:gap-5">
                {searchResults.map((drama) => (
                  <div
                    key={drama.id}
                    onClick={() => handlePlayClick(drama)}
                    className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:z-10"
                  >
                    {/* 封面 */}
                    <div className="relative aspect-[2/3] bg-gray-900 rounded-lg overflow-hidden mb-2 md:mb-3 shadow-lg group-hover:shadow-2xl transition-shadow">
                      {drama.pic ? (
                        <img
                          src={drama.pic}
                          alt={drama.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      
                      {/* 悬停遮罩 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                        <div className="text-center transform scale-75 group-hover:scale-100 transition-transform duration-300">
                          <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-2 mx-auto border-2 border-white/30">
                            <svg className="w-6 h-6 md:w-7 md:h-7 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                          <p className="text-white text-xs md:text-sm font-bold drop-shadow-lg">立即播放</p>
                        </div>
                      </div>

                      {/* 标签 */}
                      {drama.remarks && (
                        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                          {drama.remarks}
                        </div>
                      )}
                    </div>

                    {/* 信息 */}
                    <div>
                      <h3 className="text-white font-semibold text-xs md:text-sm mb-1 line-clamp-2 group-hover:text-red-400 transition-colors leading-tight">
                        {drama.name}
                      </h3>
                      <div className="flex items-center space-x-1.5 md:space-x-2 text-[10px] md:text-xs text-gray-400">
                        {drama.year && <span>{drama.year}</span>}
                        {drama.area && (
                          <>
                            <span>•</span>
                            <span>{drama.area}</span>
                          </>
                        )}
                      </div>
                      {drama.score && parseFloat(drama.score) > 0 && (
                        <div className="flex items-center mt-1">
                          <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-yellow-500 text-xs ml-1 font-medium">{drama.score}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* 无结果 */
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">未找到相关内容</h3>
              <p className="text-gray-400 mb-6">
                在 {currentSource?.name || '当前源'} 中搜索 &ldquo;{queryKeyword}&rdquo; 没有结果
              </p>
              <div className="flex items-center space-x-4">
                <button
                  onClick={goBack}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  返回首页
                </button>
                <button
                  onClick={() => setSearchKeyword('')}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  重新搜索
                </button>
              </div>
              
              {/* 切换其他源提示 */}
              {currentSource && allSources.length > 1 && (
                <div className="mt-8 text-center">
                  <p className="text-gray-500 text-sm mb-3">或尝试切换其他播放源：</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {allSources.filter(s => s.key !== currentSource.key).slice(0, 5).map(source => (
                    <button
                      key={source.key}
                      onClick={() => handleSourceChange(source.key)}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white text-sm rounded transition-colors"
                    >
                      {source.name}
                    </button>
                  ))}
                </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* 初始状态 */
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">搜索影视资源</h3>
            <p className="text-gray-400">
              输入关键词开始搜索{currentSource && <> · 当前使用 {currentSource.name}</>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
