import { VodSource } from '@/types/drama';

// 可导入的预设VOD源配置（纯数据，客户端安全）
export const presetVodSources: VodSource[] = [
  {
    key: 'rycjapi',
    name: '如意资源站',
    api: 'https://cj.rycjapi.com/api.php/provide/vod',
    playUrl: 'https://ryplayer.com?url=',
    type: 'json'
  },
  {
    key: 'maotaizy',
    name: '茅台资源',
    api: 'https://caiji.maotaizy.cc/api.php/provide/vod/from/mtm3u8/at/josn/',
    playUrl: 'https://www.mtjiexi.cc:966/?url=',
    type: 'json'
  },
  {
    key: 'ukuapi88',
    name: 'U酷资源网',
    api: 'https://api.ukuapi88.com/api.php/provide/vod',
    playUrl: 'https://api.ukubf.com/m3u8/?url=',
    type: 'json'
  },
  {
    key: 'baofengziyuan',
    name: '暴风资源',
    api: 'https://bfzyapi.com/api.php/provide/vod',
    playUrl: 'https://vip.vipuuvip.com/?url=',
    type: 'json'
  },
  {
    key: '360zy',
    name: '360资源',
    api: 'https://360zy.com/api.php/provide/vod',
    playUrl: 'https://www.360jiexi.com/player/?url=',
    type: 'json'
  },
  {
    key: 'wolongzy',
    name: '卧龙资源',
    api: 'https://collect.wolongzy.cc/api.php/provide/vod/',
    playUrl: 'https://jx.wolongzywcdn.com:65/m3u8.php?url=',
    type: 'json'
  },
  {
    key: 'moduzy',
    name: '魔都资源网',
    api: 'https://caiji.moduapi.cc/api.php/provide/vod',
    playUrl: 'https://jiexi.modujx01.com/?url=',
    type: 'json'
  },
  {
    key: 'ikunzyapi',
    name: 'iKun资源',
    api: 'https://ikunzyapi.com/api.php/provide/vod',
    playUrl: 'https://www.ikdmjx.com/?url=',
    type: 'json'
  },
  {
    key: 'jszyapi',
    name: '极速资源',
    api: 'https://jszyapi.com/api.php/provide/vod/from/jsm3u8/at/json',
    playUrl: 'https://jsjiexi.com/play/?url=',
    type: 'json'
  }
];
