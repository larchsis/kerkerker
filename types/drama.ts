export interface Drama {
  id: string | number;
  name: string;
  subName?: string;
  pic: string;
  remarks?: string;
  note?: string;
  type?: string;
  time?: string;
  playFrom?: string;
  actor?: string;
  director?: string;
  area?: string;
  year?: string;
  score?: string;
  total?: number;
  blurb?: string;
  tags?: string[];
  vod_class?: string;
}

export interface Episode {
  name: string;
  url: string;
}

export interface DramaDetail extends Drama {
  episodes: Episode[];
}

export interface Category {
  id: string | number;
  name: string;
  icon?: string;
  count?: number;
  children?: Category[];
}

export interface VodSource {
  key: string;
  name: string;
  api: string;
  playUrl: string;
  type: 'json' | 'xml';
}

export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

export interface DramaListData {
  list: Drama[];
  page: number;
  pagecount: number;
  limit: number;
  total: number;
}
