"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DramaDetail, VodSource } from "@/types/drama";

interface PlayerInterface {
  name: string;
  url: string;
  type: "vod_source" | "external";
}

interface AvailableSource {
  source_key: string;
  source_name: string;
  vod_id: string | number;
  vod_name: string;
  match_confidence: "high" | "medium" | "low";
}

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dramaId = params.id as string;
  const currentSourceKey = searchParams.get("source");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dramaDetail, setDramaDetail] = useState<DramaDetail | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [playerUrl, setPlayerUrl] = useState("");
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playerInterfaces, setPlayerInterfaces] = useState<PlayerInterface[]>(
    []
  );
  const [playerLoadAttempts, setPlayerLoadAttempts] = useState(0);
  const [playerError, setPlayerError] = useState(false);

  // 多源相关状态
  const [availableSources, setAvailableSources] = useState<AvailableSource[]>(
    []
  );
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  
  // 视频源数据（从 API 获取）
  const [vodSources, setVodSources] = useState<VodSource[]>([]);
  const [selectedVodSource, setSelectedVodSource] = useState<VodSource | null>(null);

  // 从 API 获取视频源配置
  useEffect(() => {
    const fetchVodSources = async () => {
      try {
        const response = await fetch('/api/vod-sources');
        if (response.ok) {
          const result = await response.json();
          if (result.code === 200 && result.data) {
            setVodSources(result.data.sources || []);
            setSelectedVodSource(result.data.selected || null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch vod sources:', error);
      }
    };
    fetchVodSources();
  }, []);

  // 构建播放器库 - 合并VOD源的playUrl和外部播放器
  useEffect(() => {
    const players: PlayerInterface[] = [
      // 从VOD源获取playUrl
      ...vodSources.map((source) => ({
        name: source.name,
        url: source.playUrl,
        type: "vod_source" as const,
      })),
      // 添加外部播放器作为备份
      {
        name: "备用播放器1",
        url: "https://jx.xmflv.com/?url=",
        type: "external" as const,
      },
      {
        name: "备用播放器2",
        url: "https://jx.jsonplayer.com/player/?url=",
        type: "external" as const,
      },
    ];

    setPlayerInterfaces(players);
  }, [vodSources]);

  // 加载多源数据
  useEffect(() => {
    try {
      const stored = localStorage.getItem("multi_source_matches");
      if (stored) {
        const data = JSON.parse(stored);
        // 检查数据是否过期（30分钟）
        if (Date.now() - data.timestamp < 30 * 60 * 1000) {
          setAvailableSources(data.matches || []);
          console.log(`📦 加载了 ${data.matches?.length || 0} 个可用播放源`);
        }
      }
    } catch (err) {
      console.error("加载多源数据失败:", err);
    }
  }, []);

  // 自动切换到下一个播放器
  const tryNextPlayer = useCallback(() => {
    if (!dramaDetail || !playerInterfaces.length) return;

    // 检查是否已经尝试过所有播放器
    if (playerLoadAttempts >= playerInterfaces.length - 1) {
      console.error("❌ 所有播放器都无法加载");
      setPlayerError(true);
      setIsLoadingPlayer(false);
      return;
    }

    const nextIndex = (currentPlayerIndex + 1) % playerInterfaces.length;
    console.log(
      `🔄 播放器加载失败 (尝试 ${playerLoadAttempts + 1}/${
        playerInterfaces.length
      })，切换到第 ${nextIndex + 1} 个播放器...`
    );

    setCurrentPlayerIndex(nextIndex);
    setPlayerLoadAttempts((prev) => prev + 1);

    const episode = dramaDetail.episodes[currentEpisode];
    const player = playerInterfaces[nextIndex];
    const url = player.url + encodeURIComponent(episode.url);
    setPlayerUrl(url);
  }, [
    dramaDetail,
    currentPlayerIndex,
    currentEpisode,
    playerInterfaces,
    playerLoadAttempts,
  ]);

  // 监听播放器加载超时 - 10秒后自动切换
  useEffect(() => {
    if (playerUrl && isLoadingPlayer && !playerError) {
      // 清除之前的超时
      if (playerTimeoutRef.current) {
        clearTimeout(playerTimeoutRef.current);
      }

      // 设置10秒超时
      playerTimeoutRef.current = setTimeout(() => {
        console.warn("⏰ 播放器加载超时");
        tryNextPlayer();
      }, 10000);

      return () => {
        if (playerTimeoutRef.current) {
          clearTimeout(playerTimeoutRef.current);
        }
      };
    }
  }, [playerUrl, isLoadingPlayer, playerError, tryNextPlayer]);

  // 获取影视详情
  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        // 优先使用 URL 参数中的 source，否则使用 availableSources 的第一个，最后才使用默认源
        let sourceKey = currentSourceKey;
        if (!sourceKey && availableSources.length > 0) {
          sourceKey = availableSources[0].source_key;
        }
        
        if (!sourceKey && selectedVodSource) {
          sourceKey = selectedVodSource.key;
        }

        // 获取完整的 source 对象
        const source = sourceKey 
          ? vodSources.find((s) => s.key === sourceKey) 
          : selectedVodSource;

        // 如果没有配置视频源，显示错误
        if (!source) {
          setError('未配置视频源，请先在后台管理中配置视频源');
          setLoading(false);
          return;
        }

        console.log(`🎬 获取详情: ${dramaId}, 使用源: ${source.name}`);

        const response = await fetch("/api/drama/detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: dramaId,
            source: source, // 传递完整的 source 对象
            _t: Date.now(),
          }),
        });

        const result = await response.json();

        if (result.code !== 200) {
          throw new Error(result.msg || "获取影视详情失败");
        }

        const data = result.data;
        if (data && data.episodes && data.episodes.length > 0) {
          setDramaDetail(data);
        } else {
          setError("该影视暂无播放源");
        }
      } catch (err) {
        console.error("获取影视详情失败:", err);
        setError("获取影视详情失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    };

    if (dramaId && vodSources.length > 0) {
      fetchDetail();
    }
  }, [dramaId, currentSourceKey, availableSources, vodSources, selectedVodSource]);

  // 当dramaDetail和playerInterfaces都准备好时，生成初始播放地址
  // 使用ref来标记是否已经初始化，避免竞态条件
  const initializedRef = useRef(false);

  useEffect(() => {
    if (dramaDetail && playerInterfaces.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      const player = playerInterfaces[0];
      const initialUrl =
        player.url + encodeURIComponent(dramaDetail.episodes[0].url);
      setPlayerUrl(initialUrl);
      setIsLoadingPlayer(true);
      setPlayerError(false);
      setPlayerLoadAttempts(0);
      console.log(`🎬 初始化播放器: ${player.name}`);
    }
  }, [dramaDetail, playerInterfaces]);

  // 切换视频源
  const switchSource = useCallback(
    (sourceKey: string, vodId: string | number) => {
      console.log(`🔄 切换视频源: ${sourceKey}`);
      router.push(`/play/${vodId}?source=${sourceKey}&multi=true`);
    },
    [router]
  );

  // 切换剧集
  const selectEpisode = useCallback(
    (index: number) => {
      if (!dramaDetail || index === currentEpisode || !playerInterfaces.length)
        return;

      // 立即更新状态，不使用setTimeout避免竞态
      setCurrentEpisode(index);
      setIsLoadingPlayer(true);
      setPlayerError(false);
      setPlayerLoadAttempts(0);

      const episode = dramaDetail.episodes[index];
      const player = playerInterfaces[currentPlayerIndex];
      const newUrl = player.url + encodeURIComponent(episode.url);
      setPlayerUrl(newUrl);
      console.log(`🎬 切换到第 ${index + 1} 集，使用播放器: ${player.name}`);
    },
    [dramaDetail, currentEpisode, currentPlayerIndex, playerInterfaces]
  );

  // 切换播放器
  const switchPlayer = useCallback(
    (index: number) => {
      if (
        !dramaDetail ||
        index === currentPlayerIndex ||
        !playerInterfaces.length
      )
        return;

      // 立即更新状态，不使用setTimeout避免竞态
      setIsLoadingPlayer(true);
      setPlayerError(false);
      setPlayerLoadAttempts(0);
      setCurrentPlayerIndex(index);

      const episode = dramaDetail.episodes[currentEpisode];
      const player = playerInterfaces[index];
      const newUrl = player.url + encodeURIComponent(episode.url);
      setPlayerUrl(newUrl);
      console.log(`🎬 切换播放器: ${player.name}`);
    },
    [dramaDetail, currentEpisode, currentPlayerIndex, playerInterfaces]
  );

  // 上一集
  const previousEpisode = useCallback(() => {
    if (currentEpisode > 0) {
      selectEpisode(currentEpisode - 1);
    }
  }, [currentEpisode, selectEpisode]);

  // 下一集
  const nextEpisode = useCallback(() => {
    if (dramaDetail && currentEpisode < dramaDetail.episodes.length - 1) {
      selectEpisode(currentEpisode + 1);
    }
  }, [dramaDetail, currentEpisode, selectEpisode]);

  // 返回列表
  const goBack = useCallback(() => {
    router.push("/");
  }, [router]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // 如果在输入框中，不处理快捷键
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA"
      )
        return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          previousEpisode();
          break;
        case "ArrowDown":
          e.preventDefault();
          nextEpisode();
          break;
        case "ArrowLeft":
          e.preventDefault();
          previousEpisode();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextEpisode();
          break;
        case "s":
        case "S":
          e.preventDefault();
          setShowSettings((s) => !s);
          break;
        case "Escape":
          if (showSettings) {
            setShowSettings(false);
          } else {
            goBack();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [showSettings, previousEpisode, nextEpisode, goBack]);

  // 保存播放历史
  useEffect(() => {
    if (dramaDetail && typeof window !== "undefined") {
      try {
        const history = {
          id: dramaDetail.id,
          name: dramaDetail.name,
          episode: currentEpisode,
          timestamp: Date.now(),
        };
        localStorage.setItem(
          `play_history_${dramaDetail.id}`,
          JSON.stringify(history)
        );
      } catch (error) {
        console.error("Failed to save play history:", error);
      }
    }
  }, [dramaDetail, currentEpisode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-stone-300 border-t-amber-500 mx-auto mb-4" />
          <p className="text-white text-xl font-medium">正在加载影视详情...</p>
          <p className="text-stone-400 text-sm mt-2">请稍候</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-white text-xl font-medium mb-4">{error}</p>
          <button
            onClick={goBack}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-full hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
          >
            返回影视列表
          </button>
        </div>
      </div>
    );
  }

  if (!dramaDetail) return null;

  return (
    <div className="min-h-screen bg-black">
      {/* 顶部导航栏 - Netflix风格 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black via-black/95 to-transparent backdrop-blur-sm px-4 md:px-8 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="flex items-center space-x-2 text-white hover:text-gray-300 transition-all group"
          >
            <svg
              className="w-6 h-6 group-hover:scale-110 group-hover:-translate-x-1 transition-all"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="text-sm font-semibold">返回</span>
          </button>

          <div className="flex items-center space-x-2 md:space-x-4">
            {/* 多源选择器 */}
            {availableSources.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowSourceSelector(!showSourceSelector)}
                  className="flex items-center space-x-2 px-3 md:px-4 py-1.5 md:py-2 bg-white/10 hover:bg-white/20 rounded-full transition-all hover:scale-105 text-white text-xs md:text-sm font-medium shadow-lg"
                  title="切换视频源"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                  <span>{availableSources.length} 个播放源</span>
                </button>

                {/* 源选择下拉菜单 */}
                {showSourceSelector && (
                  <div className="absolute right-0 mt-2 w-64 bg-gray-900 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
                    <div className="p-2 border-b border-gray-700">
                      <p className="text-xs text-gray-400 px-2">选择播放源</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {availableSources.map((source) => {
                        const isCurrent =
                          source.source_key === currentSourceKey;
                        return (
                          <button
                            key={source.source_key}
                            onClick={() => {
                              if (!isCurrent) {
                                switchSource(source.source_key, source.vod_id);
                              }
                              setShowSourceSelector(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-white/10 transition-colors ${
                              isCurrent
                                ? "bg-red-600/20 border-l-4 border-red-600"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p
                                  className={`text-sm font-medium ${
                                    isCurrent ? "text-red-500" : "text-white"
                                  }`}
                                >
                                  {source.source_name}
                                  {isCurrent && " ✓"}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {source.vod_name}
                                </p>
                              </div>
                              <div className="ml-2">
                                {source.match_confidence === "high" && (
                                  <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                                    精准
                                  </span>
                                )}
                                {source.match_confidence === "medium" && (
                                  <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                                    相似
                                  </span>
                                )}
                                {source.match_confidence === "low" && (
                                  <span className="text-xs bg-gray-600 text-white px-2 py-1 rounded">
                                    模糊
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white/20 rounded-full transition-all hover:scale-110 text-white shadow-lg"
              title="播放器设置"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* 视频播放器区域 - 响应式高度 */}
      <div className="relative aspect-video mx-auto max-h-screen mt-14 sm:mt-0">
        <div className="absolute inset-0 bg-black">
          {/* 加载状态 */}
          {isLoadingPlayer && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-gray-700 border-t-red-600 mx-auto mb-3 md:mb-4" />
                <p className="text-white text-sm md:text-lg">
                  正在加载播放器...
                </p>
              </div>
            </div>
          )}

          {/* 播放器 */}
          {playerUrl && !playerError && (
            <iframe
              ref={iframeRef}
              key={playerUrl}
              src={playerUrl}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title="影视播放器"
              onLoad={() => {
                console.log("✅ 播放器iframe加载完成");
                // 延迟关闭loading，让播放器有时间初始化
                setTimeout(() => {
                  setIsLoadingPlayer(false);
                  if (playerTimeoutRef.current) {
                    clearTimeout(playerTimeoutRef.current);
                  }
                }, 500);
              }}
            />
          )}

          {/* 播放器错误 */}
          {playerError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
              <div className="text-center px-6">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-white text-lg mb-2">所有播放器均无法加载</p>
                <p className="text-gray-400 text-sm mb-6">
                  请稍后再试或切换其他剧集
                </p>
                <button
                  onClick={() => {
                    setPlayerError(false);
                    setCurrentPlayerIndex(0);
                    setPlayerLoadAttempts(0);
                    const episode = dramaDetail!.episodes[currentEpisode];
                    const player = playerInterfaces[0];
                    setPlayerUrl(player.url + encodeURIComponent(episode.url));
                    setIsLoadingPlayer(true);
                  }}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {/* 设置面板 */}
          {showSettings && (
            <div className="absolute top-20 right-4 bg-gray-900/98 text-white p-6 rounded-lg w-80 max-h-[80vh] overflow-y-auto z-50 shadow-2xl border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">设置</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    播放器库
                  </h4>
                  <span className="text-xs text-gray-600">
                    当前: {playerInterfaces[currentPlayerIndex]?.name || ""}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  如果播放器无法加载，系统将自动切换到下一个播放器
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {playerInterfaces.map((player, playerIndex) => (
                    <button
                      key={playerIndex}
                      onClick={() => switchPlayer(playerIndex)}
                      className={`w-full text-left px-4 py-2.5 text-sm rounded-lg transition-all font-medium flex items-center justify-between ${
                        currentPlayerIndex === playerIndex
                          ? "bg-red-600 text-white ring-2 ring-red-400"
                          : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                      }`}
                    >
                      <span className="truncate">{player.name}</span>
                      {currentPlayerIndex === playerIndex && (
                        <svg
                          className="w-4 h-4 ml-2 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 快捷键说明 */}
              <div className="pt-6 border-t border-gray-800">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  快捷键
                </h4>
                <div className="text-xs text-gray-500 space-y-2">
                  <div className="flex justify-between">
                    <span>← / →</span>
                    <span>上一集 / 下一集</span>
                  </div>
                  <div className="flex justify-between">
                    <span>S</span>
                    <span>播放器设置</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ESC</span>
                    <span>返回首页</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 详情内容区域 - Netflix深度优化 */}
      <div className="px-4 md:px-8 py-8 space-y-8 animate-fade-in max-w-[1800px] mx-auto">
        {/* 影视信息主区域 */}
        <div className="w-full">
          <div className="flex flex-col lg:flex-row lg:items-start lg:space-x-10">
            {/* 左侧：主要信息 */}
            <div className="flex-1 space-y-3 md:space-y-4 lg:space-y-6">
              <div>
                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 leading-tight tracking-tight">
                  {dramaDetail.name}
                </h1>

                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm md:text-base">
                  {dramaDetail.year && (
                    <span className="px-3 py-1 bg-green-600/90 text-white font-bold rounded-md shadow-lg">
                      {dramaDetail.year}
                    </span>
                  )}
                  {dramaDetail.remarks && (
                    <span className="px-3 py-1 border-2 border-gray-500 text-gray-200 rounded-md font-medium">
                      {dramaDetail.remarks}
                    </span>
                  )}
                  {dramaDetail.type && (
                    <span className="text-gray-400">{dramaDetail.type}</span>
                  )}
                  {dramaDetail.area && (
                    <>
                      <span className="text-gray-600">•</span>
                      <span className="text-gray-400">{dramaDetail.area}</span>
                    </>
                  )}
                  {dramaDetail.episodes && dramaDetail.episodes.length > 0 && (
                    <>
                      <span className="text-gray-600">•</span>
                      <span className="text-gray-400">
                        {dramaDetail.episodes.length} 集
                      </span>
                    </>
                  )}
                </div>
              </div>
 
              {/* 简介 */}
              {dramaDetail.blurb && (
                <div className="bg-gradient-to-r from-gray-900/100 to-transparent p-4 rounded-lg">
                  <p
                    className="text-base md:text-lg text-gray-200 leading-relaxed line-clamp-3"
                    dangerouslySetInnerHTML={{
                      __html: dramaDetail.blurb
                        .replace(/<[^>]*>/g, "")
                        .replace(/&nbsp;/g, " "),
                    }}
                  />
                </div>
              )}
            </div>

            {/* 右侧：演职人员信息 */}
            <div className="lg:w-96 space-y-5 text-sm md:text-base mt-6 lg:mt-0 bg-gray-900/10 p-6 rounded-xl backdrop-blur-sm">
              {dramaDetail.actor && (
                <div>
                  <span className="text-gray-400 font-semibold">主演</span>
                  <p className="text-gray-200 mt-2 leading-relaxed">
                    {dramaDetail.actor.split(",").slice(0, 4).join("、")}
                  </p>
                </div>
              )}
              {dramaDetail.director && (
                <div>
                  <span className="text-gray-400 font-semibold">导演</span>
                  <p className="text-gray-200 mt-2">{dramaDetail.director}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 剧集列表 - 增强版 */}
        <div className="bg-gradient-to-b from-gray-900 to-transparent p-6 md:p-8 rounded-2xl">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              剧集
            </h2>
            <div className="text-sm md:text-base text-gray-400">
              <span className="text-red-500 font-bold text-lg">
                第 {currentEpisode + 1} 集
              </span>
              <span className="text-gray-500 mx-2">/</span>
              <span>共 {dramaDetail.episodes.length} 集</span>
            </div>
          </div>

          <div className="relative group">
            {/* 左侧渐变指示器 */}
            <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-gray-900/90 via-gray-900/50 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* 右侧渐变指示器 */}
            <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-gray-900/90 via-gray-900/50 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex overflow-x-auto space-x-2 md:space-x-5 p-2 md:p-8 scrollbar-hide scroll-smooth">
              {dramaDetail.episodes.map((episode, index) => (
                <button
                  key={index}
                  onClick={() => selectEpisode(index)}
                  className={`flex-shrink-0 w-14 sm:w-24 md:w-28 rounded-xl overflow-hidden transition-all transform hover:scale-110 hover:shadow-2xl ${
                    currentEpisode === index
                      ? "ring-4 ring-red-500 shadow-2xl shadow-red-500/50"
                      : "hover:ring-2 hover:ring-gray-400"
                  }`}
                >
                  {/* 缩略图区域 */}
                  <div
                    className={`aspect-video flex items-center justify-center text-3xl md:text-4xl font-black ${
                      currentEpisode === index
                        ? "bg-gradient-to-br from-red-600 to-red-700 text-white"
                        : "bg-gradient-to-br from-gray-800 to-gray-900 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* 信息区域 */}
                  <div
                    className={`p-3 md:p-4 ${
                      currentEpisode === index
                        ? "bg-gradient-to-br from-gray-800 to-gray-900"
                        : "bg-gray-900/80"
                    }`}
                  >
                    <div className="text-sm md:text-base font-bold text-white truncate mb-1">
                      第 {index + 1} 集
                    </div>
                    <div className="text-xs text-gray-400 truncate leading-tight">
                      {episode.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
