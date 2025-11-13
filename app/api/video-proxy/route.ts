import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 智能视频代理 v2
 * 支持 m3u8 播放列表重写
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const videoUrl = searchParams.get('url');
    
    if (!videoUrl) {
      return NextResponse.json(
        { code: 400, message: '缺少视频地址参数' },
        { status: 400 }
      );
    }

    console.log(`🎬 代理视频请求: ${videoUrl}`);

    // 发起视频请求
    const fetchHeaders: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': '*/*',
    };
    
    // 添加 Referer（如果 URL 有效）
    try {
      const urlObj = new URL(videoUrl);
      fetchHeaders['Referer'] = urlObj.origin;
    } catch {
      console.warn('无效的 URL，跳过 Referer');
    }
    
    // 添加 Range 头（如果存在）
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }
    
    const videoResponse = await fetch(videoUrl, {
      headers: fetchHeaders,
      signal: AbortSignal.timeout(30000)
    });

    if (!videoResponse.ok) {
      console.error(`视频请求失败: ${videoResponse.status}`);
      return NextResponse.json(
        { code: videoResponse.status, message: '视频请求失败' },
        { status: videoResponse.status }
      );
    }

    const contentType = videoResponse.headers.get('content-type') || '';

    // 检查是否是 m3u8 播放列表
    if (contentType.includes('application/vnd.apple.mpegurl') || 
        contentType.includes('application/x-mpegURL') ||
        videoUrl.endsWith('.m3u8')) {
      
      console.log('📝 检测到 m3u8 文件，重写内部 URL...');
      
      // 读取 m3u8 内容
      const m3u8Content = await videoResponse.text();
      
      // 重写 m3u8 内容
      const rewrittenContent = rewriteM3U8(m3u8Content, videoUrl, request.nextUrl.origin);
      
      // 返回重写后的 m3u8
      return new NextResponse(rewrittenContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Expose-Headers': 'Content-Length',
          'Cache-Control': 'no-cache',
        }
      });
    }

    // 非 m3u8 文件，直接转发
    const headers = new Headers();
    
    const headersToClone = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ];

    headersToClone.forEach(header => {
      const value = videoResponse.headers.get(header);
      if (value) headers.set(header, value);
    });

    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    return new NextResponse(videoResponse.body, {
      status: videoResponse.status,
      headers
    });

  } catch (error) {
    console.error('视频代理失败:', error);
    return NextResponse.json(
      { code: 500, message: error instanceof Error ? error.message : '视频代理失败' },
      { status: 500 }
    );
  }
}

/**
 * 重写 m3u8 文件内容
 * 将所有资源 URL 替换为代理 URL
 */
function rewriteM3U8(content: string, baseUrl: string, proxyOrigin: string): string {
  const lines = content.split('\n');
  const baseUrlObj = new URL(baseUrl);
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  
  const rewrittenLines = lines.map(line => {
    // 跳过注释行和空行
    if (line.startsWith('#') || line.trim() === '') {
      return line;
    }
    
    // 处理资源 URL
    let resourceUrl = line.trim();
    
    // 如果是相对路径，转换为绝对路径
    if (!resourceUrl.startsWith('http://') && !resourceUrl.startsWith('https://')) {
      if (resourceUrl.startsWith('/')) {
        // 绝对路径（相对于域名根目录）
        resourceUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${resourceUrl}`;
      } else {
        // 相对路径（相对于当前目录）
        resourceUrl = baseDir + resourceUrl;
      }
    }
    
    // 将资源 URL 替换为代理 URL
    const proxiedUrl = `${proxyOrigin}/api/video-proxy?url=${encodeURIComponent(resourceUrl)}`;
    
    return proxiedUrl;
  });
  
  return rewrittenLines.join('\n');
}

export async function OPTIONS() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  
  return new NextResponse(null, {
    status: 204,
    headers
  });
}
