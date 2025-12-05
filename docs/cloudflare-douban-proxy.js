/**
 * Cloudflare Workers - 豆瓣API代理
 * 
 * 部署方式:
 * 方式1: 运行 scripts/deploy-douban-proxy.sh 自动部署
 * 方式2: 手动部署到 Cloudflare Dashboard
 *   1. 登录 https://dash.cloudflare.com/
 *   2. 进入 Workers & Pages -> Create Application -> Create Worker
 *   3. 粘贴此代码并部署
 *   4. 在 .env 中设置: DOUBAN_API_PROXY=https://douban-proxy.xxx.workers.dev
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 允许的豆瓣API路径及其对应的域名
    const routeMap = {
      '/j/search_subjects': 'https://movie.douban.com',
      '/j/subject_abstract': 'https://movie.douban.com',
      '/j/subject_suggest': 'https://movie.douban.com',  // 搜索建议（含封面）
      '/j/new_search_subjects': 'https://movie.douban.com',
      '/v2/movie/subject/': 'https://api.douban.com',  // 官方v2 API（需授权）
      '/v2/movie/search': 'https://api.douban.com',
      '/v2/movie/in_theaters': 'https://api.douban.com',
    };
    
    // 查找匹配的路由
    let targetDomain = null;
    for (const [prefix, domain] of Object.entries(routeMap)) {
      if (path.startsWith(prefix)) {
        targetDomain = domain;
        break;
      }
    }
    
    if (!targetDomain) {
      return new Response(JSON.stringify({ error: 'Path not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    const doubanUrl = targetDomain + path + url.search;
    
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    ];
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    try {
      const resp = await fetch(doubanUrl, {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          'Referer': 'https://movie.douban.com/',
          'Accept': 'application/json',
        },
      });
      
      const text = await resp.text();
      
      return new Response(text, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  },
};
