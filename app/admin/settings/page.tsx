'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VodSource } from '@/types/drama';
import { presetVodSources } from '@/lib/preset-vod-sources';
import { Toast, ConfirmDialog } from '@/components/Toast';
import type { PlayerConfig, IframePlayer } from '@/app/api/player-config/route';

type TabType = 'sources' | 'player';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('sources');
  const [sources, setSources] = useState<VodSource[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [editingSource, setEditingSource] = useState<VodSource | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [formData, setFormData] = useState<VodSource>({
    key: '',
    name: '',
    api: '',
    playUrl: '',
    type: 'json'
  });
 
  // 播放器配置
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<IframePlayer | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [playerFormData, setPlayerFormData] = useState<IframePlayer>({
    id: '',
    name: '',
    url: '',
    priority: 1,
    timeout: 10000,
    enabled: true,
  });

  // Toast 通知状态
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  
  // 确认对话框状态
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  useEffect(() => {
    // 从数据库加载配置
    const loadSettings = async () => {
      try {
        // 加载视频源配置
        const vodResponse = await fetch('/api/vod-sources');
        const vodResult = await vodResponse.json();
        
        if (vodResult.code === 200 && vodResult.data) {
          setSources(vodResult.data.sources || []);
          setSelectedKey(vodResult.data.selected?.key || '');
        }
        
        // 加载播放器配置
        const playerResponse = await fetch('/api/player-config');
        const playerResult = await playerResponse.json();
        
        if (playerResult.code === 200 && playerResult.data) {
          setPlayerConfig(playerResult.data);
        }
      } catch (error) {
        setToast({ message: error instanceof Error ? error.message : '加载配置失败', type: 'error' });
      }
    };
    
    loadSettings();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleImportPreset = () => {
    setConfirm({
      title: '导入预设配置',
      message: '确定要导入预设视频源吗？这将覆盖当前配置，并自动配置相关播放器。',
      onConfirm: async () => {
        try {
          // 1. 导入视频源
          const vodResponse = await fetch('/api/vod-sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sources: presetVodSources,
              selected: presetVodSources[0]?.key || null,
            }),
          });
          
          const vodResult = await vodResponse.json();
          
          if (vodResult.code !== 200) {
            setToast({ message: vodResult.message || '导入视频源失败', type: 'error' });
            setConfirm(null);
            return;
          }
          
          // 2. 从视频源中提取播放器URL，自动配置iframe播放器
          if (playerConfig) {
            const newPlayers: IframePlayer[] = presetVodSources
              .filter(source => source.playUrl) // 只处理有playUrl的源
              .map((source, index) => ({
                id: `player_${source.key}_${Date.now()}`,
                name: `${source.name}播放器`,
                url: source.playUrl,
                priority: index + 1,
                timeout: 10000,
                enabled: true,
              }));
            
            // 合并现有播放器和新播放器，去重（基于URL）
            const existingUrls = new Set(playerConfig.iframePlayers.map(p => p.url));
            const uniqueNewPlayers = newPlayers.filter(p => !existingUrls.has(p.url));
            const mergedPlayers = [...playerConfig.iframePlayers, ...uniqueNewPlayers];
            
            // 保存播放器配置
            const playerResponse = await fetch('/api/player-config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...playerConfig,
                iframePlayers: mergedPlayers,
              }),
            });
            
            const playerResult = await playerResponse.json();
            
            if (playerResult.code === 200) {
              setPlayerConfig({ ...playerConfig, iframePlayers: mergedPlayers });
            }
          }
          
          // 3. 更新UI状态
          setSources(presetVodSources);
          if (presetVodSources.length > 0) {
            setSelectedKey(presetVodSources[0].key);
          }
          
          setToast({ 
            message: '已成功导入预设视频源和播放器配置', 
            type: 'success' 
          });
        } catch (error) {
          console.error('导入失败:', error);
          setToast({ message: '导入失败', type: 'error' });
        }
        setConfirm(null);
      },
      danger: false
    });
  };

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingSource(null);
    setFormData({
      key: '',
      name: '',
      api: '',
      playUrl: '',
      type: 'json'
    });
  };

  const handleEdit = (source: VodSource) => {
    setIsAddMode(false);
    setEditingSource(source);
    setFormData({ ...source });
  };

  const handleDelete = (key: string) => {
    const sourceToDelete = sources.find(s => s.key === key);
    setConfirm({
      title: '删除视频源',
      message: `确定要删除「${sourceToDelete?.name}」吗？`,
      onConfirm: async () => {
        try {
          const newSources = sources.filter(s => s.key !== key);
          const newSelected = selectedKey === key && newSources.length > 0 
            ? newSources[0].key 
            : selectedKey;
          
          const response = await fetch('/api/vod-sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sources: newSources,
              selected: newSelected,
            }),
          });
          
          const result = await response.json();
          
          if (result.code === 200) {
            setSources(newSources);
            setSelectedKey(newSelected);
            setToast({ message: '删除成功', type: 'success' });
          } else {
            setToast({ message: result.message || '删除失败', type: 'error' });
          }
        } catch (error) {
          console.error('删除失败:', error);
          setToast({ message: '删除失败', type: 'error' });
        }
        setConfirm(null);
      },
      danger: true
    });
  };

  const handleSave = async () => {
    if (!formData.key || !formData.name || !formData.api || !formData.playUrl) {
      setToast({ message: '请填写完整信息', type: 'warning' });
      return;
    }

    let newSources: VodSource[];
    
    if (isAddMode) {
      // 检查key是否重复
      if (sources.some(s => s.key === formData.key)) {
        setToast({ message: '视频源key已存在', type: 'error' });
        return;
      }
      newSources = [...sources, formData];
    } else {
      // 编辑模式
      newSources = sources.map(s => 
        s.key === editingSource?.key ? formData : s
      );
    }

    try {
      const response = await fetch('/api/vod-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: newSources,
          selected: selectedKey,
        }),
      });
      
      const result = await response.json();
      
      if (result.code === 200) {
        setSources(newSources);
        setEditingSource(null);
        setIsAddMode(false);
        setToast({ message: '保存成功', type: 'success' });
      } else {
        setToast({ message: result.message || '保存失败', type: 'error' });
      }
    } catch (error) {
      console.error('保存失败:', error);
      setToast({ message: '保存失败', type: 'error' });
    }
  };

  const handleCancel = () => {
    setEditingSource(null);
    setIsAddMode(false);
  };

  const handleSelectSource = async (key: string) => {
    try {
      const response = await fetch('/api/vod-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: key }),
      });
      
      const result = await response.json();
      
      if (result.code === 200) {
        setSelectedKey(key);
      } else {
        setToast({ message: result.message || '选择失败', type: 'error' });
      }
    } catch (error) {
      console.error('选择视频源失败:', error);
      setToast({ message: '选择失败', type: 'error' });
    }
  };
  
  // 播放器配置相关函数
  const handleSavePlayerConfig = async (newConfig: PlayerConfig) => {
    try {
      const response = await fetch('/api/player-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      
      const result = await response.json();
      
      if (result.code === 200) {
        setPlayerConfig(newConfig);
        setToast({ message: '保存成功', type: 'success' });
      } else {
        setToast({ message: result.message || '保存失败', type: 'error' });
      }
    } catch (error) {
      console.error('保存播放器配置失败:', error);
      setToast({ message: '保存失败', type: 'error' });
    }
  };
  
  const handlePlayerModeChange = (mode: 'iframe' | 'local' | 'auto') => {
    if (playerConfig) {
      handleSavePlayerConfig({ ...playerConfig, mode });
    }
  };
  
  const handleToggleProxy = (enabled: boolean) => {
    if (playerConfig) {
      handleSavePlayerConfig({ ...playerConfig, enableProxy: enabled });
    }
  };
  
  const handleAddPlayer = () => {
    setIsAddingPlayer(true);
    setEditingPlayer(null);
    setPlayerFormData({
      id: `player${Date.now()}`,
      name: '',
      url: '',
      priority: playerConfig ? playerConfig.iframePlayers.length + 1 : 1,
      timeout: 10000,
      enabled: true,
    });
  };
  
  const handleEditPlayer = (player: IframePlayer) => {
    setIsAddingPlayer(false);
    setEditingPlayer(player);
    setPlayerFormData({ ...player });
  };
  
  const handleDeletePlayer = (playerId: string) => {
    if (!playerConfig) return;
    
    const playerToDelete = playerConfig.iframePlayers.find(p => p.id === playerId);
    setConfirm({
      title: '删除播放器',
      message: `确定要删除「${playerToDelete?.name}」吗？`,
      onConfirm: () => {
        const newPlayers = playerConfig.iframePlayers.filter(p => p.id !== playerId);
        handleSavePlayerConfig({ ...playerConfig, iframePlayers: newPlayers });
        setConfirm(null);
      },
      danger: true
    });
  };
  
  const handleSavePlayer = () => {
    if (!playerConfig) return;
    if (!playerFormData.name || !playerFormData.url) {
      setToast({ message: '请填写完整信息', type: 'warning' });
      return;
    }
    
    let newPlayers: IframePlayer[];
    
    if (isAddingPlayer) {
      newPlayers = [...playerConfig.iframePlayers, playerFormData];
    } else {
      newPlayers = playerConfig.iframePlayers.map(p => 
        p.id === editingPlayer?.id ? playerFormData : p
      );
    }
    
    handleSavePlayerConfig({ ...playerConfig, iframePlayers: newPlayers });
    setIsAddingPlayer(false);
    setEditingPlayer(null);
  };
  
  const handleCancelPlayerEdit = () => {
    setIsAddingPlayer(false);
    setEditingPlayer(null);
  };
  
  const handleTogglePlayerEnabled = (playerId: string, enabled: boolean) => {
    if (!playerConfig) return;
    const newPlayers = playerConfig.iframePlayers.map(p => 
      p.id === playerId ? { ...p, enabled } : p
    );
    handleSavePlayerConfig({ ...playerConfig, iframePlayers: newPlayers });
  };
  
  const handleLocalPlayerSettingChange = (key: keyof PlayerConfig['localPlayerSettings'], value: boolean | number | string) => {
    if (!playerConfig) return;
    handleSavePlayerConfig({
      ...playerConfig,
      localPlayerSettings: {
        ...playerConfig.localPlayerSettings,
        [key]: value
      }
    });
  };

  const tabs = [
    { id: 'sources' as TabType, name: '视频源管理', icon: '📺' },
    { id: 'player' as TabType, name: '播放器设置', icon: '▶️' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">系统设置</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            退出登录
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-slate-800/30 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium transition-all relative ${
                  activeTab === tab.id
                    ? 'text-white bg-slate-800/50'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/20'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 视频源管理标签 */}
        {activeTab === 'sources' && (
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleAdd}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
              >
                + 添加视频源
              </button>
              <button
                onClick={handleImportPreset}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
              >
                📥 导入预设配置
              </button>
            </div>

            {/* Edit/Add Form */}
            {(editingSource || isAddMode) && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-blue-500">
                <h2 className="text-xl font-bold text-white mb-4">
                  {isAddMode ? '添加视频源' : '编辑视频源'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Key (唯一标识)
                    </label>
                    <input
                      type="text"
                      value={formData.key}
                      onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                      disabled={!isAddMode}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: rycjapi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      名称
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: 如意资源站"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      API地址
                    </label>
                    <input
                      type="text"
                      value={formData.api}
                      onChange={(e) => setFormData({ ...formData, api: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      播放地址
                    </label>
                    <input
                      type="text"
                      value={formData.playUrl}
                      onChange={(e) => setFormData({ ...formData, playUrl: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      类型
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'json' | 'xml' })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* Sources List */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-4">已配置的视频源</h2>
              <div className="space-y-3">
                {sources.map((source) => (
                  <div
                    key={source.key}
                    className={`p-4 rounded-lg border transition ${
                      selectedKey === source.key
                        ? 'bg-blue-500/10 border-blue-500'
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{source.name}</h3>
                          <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
                            {source.key}
                          </span>
                          {selectedKey === source.key && (
                            <span className="text-xs px-2 py-1 bg-blue-500 text-white rounded">
                              当前使用
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400 space-y-1">
                          <p>API: {source.api}</p>
                          <p>播放: {source.playUrl}</p>
                          <p>类型: {source.type.toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {selectedKey !== source.key && (
                          <button
                            onClick={() => handleSelectSource(source.key)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                          >
                            设为当前
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(source)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(source.key)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {sources.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-lg mb-2">⚠️ 暂无视频源配置</p>
                    <p className="text-sm">请点击上方「添加视频源」手动添加，或点击「导入预设配置」快速配置</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 播放器设置标签 */}
        {activeTab === 'player' && (
          <div className="space-y-6">
            {playerConfig && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-6">播放器配置</h2>
                
                {/* 播放器模式选择 */}
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-3">播放器模式</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => handlePlayerModeChange('iframe')}
                      className={`p-4 rounded-lg border-2 transition ${
                        playerConfig.mode === 'iframe'
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-white font-medium mb-1">iframe模式</div>
                      <div className="text-xs text-slate-400">兼容性好，多播放器切换</div>
                    </button>
                    <button
                      onClick={() => handlePlayerModeChange('local')}
                      className={`p-4 rounded-lg border-2 transition ${
                        playerConfig.mode === 'local'
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-white font-medium mb-1">本地HLS播放器</div>
                      <div className="text-xs text-slate-400">完全控制，进度记忆</div>
                    </button>
                    <button
                      onClick={() => handlePlayerModeChange('auto')}
                      className={`p-4 rounded-lg border-2 transition ${
                        playerConfig.mode === 'auto'
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-white font-medium mb-1">自动模式</div>
                      <div className="text-xs text-slate-400">智能选择最佳播放器</div>
                    </button>
                  </div>
                </div>

                {/* 代理设置 */}
                <div className="mb-6 flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <h3 className="text-white font-medium mb-1">启用视频代理</h3>
                    <p className="text-xs text-slate-400">本地播放器需要启用代理（推荐）</p>
                  </div>
                  <button
                    onClick={() => handleToggleProxy(!playerConfig.enableProxy)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      playerConfig.enableProxy ? 'bg-blue-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        playerConfig.enableProxy ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* iframe播放器列表 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-medium">iframe播放器列表</h3>
                    <button
                      onClick={handleAddPlayer}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
                    >
                      + 添加播放器
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {playerConfig.iframePlayers.map((player) => (
                      <div
                        key={player.id}
                        className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-white font-medium">{player.name}</span>
                              <span className="text-xs px-2 py-1 bg-slate-600 rounded text-slate-300">
                                优先级: {player.priority}
                              </span>
                              <span className="text-xs px-2 py-1 bg-slate-600 rounded text-slate-300">
                                超时: {player.timeout}ms
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 break-all">{player.url}</div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleTogglePlayerEnabled(player.id, !player.enabled)}
                              className={`px-3 py-1 text-xs rounded transition ${
                                player.enabled
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                              }`}
                            >
                              {player.enabled ? '已启用' : '已禁用'}
                            </button>
                            <button
                              onClick={() => handleEditPlayer(player)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeletePlayer(player.id)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 本地播放器设置 */}
                <div>
                  <h3 className="text-white font-medium mb-4">本地播放器设置</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div>
                        <span className="text-white text-sm">广告过滤</span>
                        <p className="text-xs text-slate-400 mt-1">过滤m3u8中的广告内容</p>
                      </div>
                      <button
                        onClick={() => handleLocalPlayerSettingChange('enableAdFilter', !playerConfig.localPlayerSettings.enableAdFilter)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          playerConfig.localPlayerSettings.enableAdFilter ? 'bg-blue-600' : 'bg-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            playerConfig.localPlayerSettings.enableAdFilter ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div>
                        <span className="text-white text-sm">自动保存进度</span>
                        <p className="text-xs text-slate-400 mt-1">记住上次播放位置</p>
                      </div>
                      <button
                        onClick={() => handleLocalPlayerSettingChange('autoSaveProgress', !playerConfig.localPlayerSettings.autoSaveProgress)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          playerConfig.localPlayerSettings.autoSaveProgress ? 'bg-blue-600' : 'bg-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            playerConfig.localPlayerSettings.autoSaveProgress ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="p-3 bg-slate-700/30 rounded-lg">
                      <label className="text-white text-sm block mb-2">
                        进度保存间隔（秒）
                      </label>
                      <input
                        type="number"
                        value={playerConfig.localPlayerSettings.progressSaveInterval}
                        onChange={(e) => handleLocalPlayerSettingChange('progressSaveInterval', parseInt(e.target.value) || 5)}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="60"
                      />
                    </div>
                    
                    <div className="p-3 bg-slate-700/30 rounded-lg">
                      <label className="text-white text-sm block mb-2">
                        主题颜色
                      </label>
                      <input
                        type="color"
                        value={playerConfig.localPlayerSettings.theme}
                        onChange={(e) => handleLocalPlayerSettingChange('theme', e.target.value)}
                        className="w-20 h-10 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 播放器编辑表单 */}
            {(editingPlayer || isAddingPlayer) && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-blue-500">
                <h2 className="text-xl font-bold text-white mb-4">
                  {isAddingPlayer ? '添加iframe播放器' : '编辑iframe播放器'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      播放器名称
                    </label>
                    <input
                      type="text"
                      value={playerFormData.name}
                      onChange={(e) => setPlayerFormData({ ...playerFormData, name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: 备用播放器1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      播放器URL
                    </label>
                    <input
                      type="text"
                      value={playerFormData.url}
                      onChange={(e) => setPlayerFormData({ ...playerFormData, url: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://jx.example.com/?url="
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      优先级（数字越小越优先）
                    </label>
                    <input
                      type="number"
                      value={playerFormData.priority}
                      onChange={(e) => setPlayerFormData({ ...playerFormData, priority: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      超时时间（毫秒）
                    </label>
                    <input
                      type="number"
                      value={playerFormData.timeout}
                      onChange={(e) => setPlayerFormData({ ...playerFormData, timeout: parseInt(e.target.value) || 10000 })}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1000"
                      step="1000"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSavePlayer}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancelPlayerEdit}
                    className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition font-medium"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast 通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* 确认对话框 */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          danger={confirm.danger}
        />
      )}
    </div>
  );
}
