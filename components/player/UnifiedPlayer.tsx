'use client';

import { useState, useEffect, useCallback } from 'react';
import { IframePlayer } from './IframePlayer';
import { LocalHlsPlayer } from './LocalHlsPlayer';
import type { PlayerConfig } from '@/app/api/player-config/route';

interface UnifiedPlayerProps {
  videoUrl: string;
  title: string;
  mode?: 'iframe' | 'local';
  currentIframePlayerIndex?: number;
  onProgress?: (time: number) => void;
  onEnded?: () => void;
  onIframePlayerSwitch?: (playerIndex: number) => void;
}

export function UnifiedPlayer({
  videoUrl,
  title,
  mode: externalMode,
  currentIframePlayerIndex,
  onProgress,
  onEnded,
  onIframePlayerSwitch,
}: UnifiedPlayerProps) {
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const [currentMode, setCurrentMode] = useState<'iframe' | 'local' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 加载播放器配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/player-config');
        const result = await response.json();
        
        if (result.code === 200 && result.data) {
          setPlayerConfig(result.data);
          
          // 如果外部传入了mode，使用外部的；否则根据配置决定
          if (externalMode) {
            setCurrentMode(externalMode);
          } else if (result.data.mode === 'auto') {
            setCurrentMode(result.data.enableProxy ? 'local' : 'iframe');
          } else {
            setCurrentMode(result.data.mode);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Player Config Load Failed]', error);
        }
        setCurrentMode(externalMode || 'iframe');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [externalMode]);

  // 监听外部mode变化
  useEffect(() => {
    if (externalMode && externalMode !== currentMode) {
      setCurrentMode(externalMode);
    }
  }, [externalMode, currentMode]);

  // 处理播放器错误（降级）
  const handlePlayerError = useCallback(() => {
    if (currentMode === 'local') {
      setCurrentMode('iframe');
    }
  }, [currentMode]);

  // 处理播放器切换（用于iframe模式）
  const handlePlayerSwitch = useCallback((playerIndex: number) => {
    onIframePlayerSwitch?.(playerIndex);
  }, [onIframePlayerSwitch]);

  if (isLoading || !currentMode || !playerConfig) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-red-600 mx-auto mb-4" />
          <p className="text-white text-lg">加载播放器配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* 播放器 */}
      {currentMode === 'iframe' && (
        <IframePlayer
          videoUrl={videoUrl}
          players={playerConfig.iframePlayers}
          currentPlayerIndex={currentIframePlayerIndex}
          onProgress={onProgress}
          onEnded={onEnded}
          onPlayerSwitch={handlePlayerSwitch}
        />
      )}

      {currentMode === 'local' && (
        <LocalHlsPlayer
          videoUrl={videoUrl}
          title={title}
          settings={playerConfig.localPlayerSettings}
          onProgress={onProgress}
          onEnded={onEnded}
          onError={handlePlayerError}
        />
      )}
    </div>
  );
}
