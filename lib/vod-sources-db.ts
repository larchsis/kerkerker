import { getDatabase } from './db';
import { VodSource } from '@/types/drama';

export interface VodSourceRow {
  id: number;
  key: string;
  name: string;
  api: string;
  play_url: string;
  type: string;
  enabled: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

// 将数据库行转换为 VodSource 类型
function rowToVodSource(row: VodSourceRow): VodSource {
  return {
    key: row.key,
    name: row.name,
    api: row.api,
    playUrl: row.play_url,
    type: row.type as 'json' | 'xml',
  };
}

// 获取所有启用的视频源
export function getVodSourcesFromDB(): VodSource[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM vod_sources 
    WHERE enabled = 1 
    ORDER BY sort_order ASC, id ASC
  `).all() as VodSourceRow[];
  
  return rows.map(rowToVodSource);
}

// 获取所有视频源（包括禁用的）
export function getAllVodSourcesFromDB(): VodSourceRow[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM vod_sources 
    ORDER BY sort_order ASC, id ASC
  `).all() as VodSourceRow[];
  
  return rows;
}

// 添加或更新视频源
export function saveVodSourceToDB(source: VodSource & { enabled?: boolean; sortOrder?: number }) {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  
  const stmt = db.prepare(`
    INSERT INTO vod_sources (key, name, api, play_url, type, enabled, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name,
      api = excluded.api,
      play_url = excluded.play_url,
      type = excluded.type,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);
  
  stmt.run(
    source.key,
    source.name,
    source.api,
    source.playUrl,
    source.type,
    source.enabled !== undefined ? (source.enabled ? 1 : 0) : 1,
    source.sortOrder || 0,
    now,
    now
  );
}

// 批量保存视频源
export function saveVodSourcesToDB(sources: VodSource[]) {
  const db = getDatabase();
  const transaction = db.transaction((sources: VodSource[]) => {
    // 先清空现有数据
    db.prepare('DELETE FROM vod_sources').run();
    
    // 插入新数据
    const stmt = db.prepare(`
      INSERT INTO vod_sources (key, name, api, play_url, type, enabled, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    
    const now = Math.floor(Date.now() / 1000);
    sources.forEach((source, index) => {
      stmt.run(
        source.key,
        source.name,
        source.api,
        source.playUrl,
        source.type,
        index,
        now,
        now
      );
    });
  });
  
  transaction(sources);
}

// 删除视频源
export function deleteVodSourceFromDB(key: string) {
  const db = getDatabase();
  db.prepare('DELETE FROM vod_sources WHERE key = ?').run(key);
}

// 启用/禁用视频源
export function toggleVodSourceEnabled(key: string, enabled: boolean) {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE vod_sources SET enabled = ?, updated_at = ? WHERE key = ?')
    .run(enabled ? 1 : 0, now, key);
}

// 获取选中的视频源
export function getSelectedVodSourceFromDB(): VodSource | null {
  const db = getDatabase();
  
  // 获取选中的 key
  const selection = db.prepare('SELECT selected_key FROM vod_source_selection WHERE id = 1').get() as { selected_key: string } | undefined;
  
  if (selection?.selected_key) {
    const row = db.prepare('SELECT * FROM vod_sources WHERE key = ? AND enabled = 1').get(selection.selected_key) as VodSourceRow | undefined;
    if (row) {
      return rowToVodSource(row);
    }
  }
  
  // 如果没有选中的或选中的源不存在，返回第一个启用的源
  const firstRow = db.prepare('SELECT * FROM vod_sources WHERE enabled = 1 ORDER BY sort_order ASC, id ASC LIMIT 1').get() as VodSourceRow | undefined;
  
  return firstRow ? rowToVodSource(firstRow) : null;
}

// 保存选中的视频源
export function saveSelectedVodSourceToDB(key: string) {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  
  db.prepare(`
    INSERT INTO vod_source_selection (id, selected_key, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      selected_key = excluded.selected_key,
      updated_at = excluded.updated_at
  `).run(key, now);
}
