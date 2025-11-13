// 视频代理API - 处理CORS和代理视频流
import { NextRequest, NextResponse } from 'next/server';

// 使用Node.js Runtime以支持完整的URL处理
export const runtime = 'nodejs';

// 阻止的主机名（防止SSRF攻击）
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS元数据服务
  'metadata.google.internal', // GCP元数据服务
];

// 阻止的IP前缀
const BLOCKED_IP_PREFIXES = [
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> }
) {
  try {
    // Next.js 15+ params 是 Promise，需要 await
    const resolvedParams = await params;
    
    // 重建目标URL
    const targetUrl = decodeURIComponent(resolvedParams.segments.join('/'));
    
    console.log('🔄 代理请求 segments:', resolvedParams.segments);
    console.log('🔄 代理请求 targetUrl:', targetUrl);

    // 安全验证
    if (!isValidUrl(targetUrl)) {
      return NextResponse.json(
        { error: '无效的URL' },
        { status: 400 }
      );
    }

    // 获取客户端的Range header
    const rangeHeader = request.headers.get('Range');
    
    // 转发请求
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': new URL(targetUrl).origin,
        ...(rangeHeader && { 'Range': rangeHeader }),
      },
      // 不跟随重定向，手动处理
      redirect: 'manual',
    });

    // 处理重定向
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        // 返回重定向地址
        return NextResponse.redirect(location);
      }
    }

    // 检查响应状态
    if (!response.ok && response.status !== 206) {
      console.error('代理请求失败:', response.status, response.statusText);
      return NextResponse.json(
        { error: `代理请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    // 获取响应内容类型
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    
    console.log('📌 Content-Type:', contentType);
    console.log('📌 targetUrl:', targetUrl);
    console.log('📌 是否m3u8:', targetUrl.endsWith('.m3u8'));
    
    // 先处理m3u8文件（优先级最高）
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || targetUrl.endsWith('.m3u8')) {
      console.log('✅ 开始处理m3u8文件');
      const text = await response.text();
      console.log('📄 原始m3u8内容 (前200字符):', text.substring(0, 200));
      
      // 处理m3u8中的相对路径
      const processedM3u8 = processM3u8Content(text, targetUrl);
      console.log('📄 处理后m3u8内容 (前200字符):', processedM3u8.substring(0, 200));
      
      return new NextResponse(processedM3u8, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 对于视频流和其他内容，直接转发（支持Range请求）
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        ...(response.headers.get('Content-Range') && {
          'Content-Range': response.headers.get('Content-Range') || '',
        }),
        ...(response.headers.get('Content-Length') && {
          'Content-Length': response.headers.get('Content-Length') || '',
        }),
        ...(response.headers.get('Accept-Ranges') && {
          'Accept-Ranges': response.headers.get('Accept-Ranges') || '',
        }),
      },
    });

  } catch (error) {
    console.error('代理错误:', error);
    return NextResponse.json(
      { error: '代理请求失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// OPTIONS请求处理（CORS预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// URL安全验证
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // 只允许HTTP和HTTPS协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      console.warn('不允许的协议:', url.protocol);
      return false;
    }
    
    // 检查阻止的主机名
    if (BLOCKED_HOSTS.includes(url.hostname)) {
      console.warn('阻止的主机名:', url.hostname);
      return false;
    }
    
    // 检查阻止的IP前缀
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (url.hostname.startsWith(prefix)) {
        console.warn('阻止的IP前缀:', url.hostname);
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

// 处理m3u8内容，转换相对路径为代理路径
function processM3u8Content(content: string, baseUrl: string): string {
  const lines = content.split('\n');
  const base = new URL(baseUrl);
  
  console.log('📝 processM3u8Content baseUrl:', baseUrl);
  console.log('📝 processM3u8Content base.href:', base.href);
  
  const processedLines = lines.map(line => {
    // 跳过注释行和空行
    if (line.startsWith('#') || !line.trim()) {
      return line;
    }
    
    // 处理URI
    try {
      let url: URL;
      
      // 判断是否为绝对URL
      if (line.startsWith('http://') || line.startsWith('https://')) {
        url = new URL(line);
      } else {
        // 相对URL，基于baseUrl解析
        url = new URL(line.trim(), base.href);
        console.log(`📝 相对路径: "${line.trim()}" => "${url.href}"`);
      }
      
      // 返回代理后的URL
      const proxiedUrl = `/api/video-proxy/${encodeURIComponent(url.href)}`;
      console.log(`📝 代理URL: ${proxiedUrl}`);
      return proxiedUrl;
    } catch (e) {
      // 解析失败，返回原始行
      console.error(`❌ URL解析失败: "${line}"`, e);
      return line;
    }
  });
  
  return processedLines.join('\n');
}
