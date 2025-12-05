#!/bin/bash

# 豆瓣API代理 - 多账号部署脚本
# 将 Cloudflare Worker 代理部署到多个账号

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==================== 账号配置 ====================
# 格式: "账号名:Account_ID:API_Token"
# 请替换为你的实际账号信息
accounts=(
    "ahagwybwqs:9fae3be270dc475cb9477a044c0f7c62:74078e98dc64451a92abf68345f858a8:68668fd9a675b7ce1ba8cb2928c40668:yTANe9wTLHCZmQgfY3Rk2Ct-ewUqEtbo12t03qzE"
    "hwyybsb:ce3f147128f742d38309d8f5abc6202c:ad7eaf6b97cb40e89f9a409a7bd48005:2070201ded0c4b0f1e7a3ff949b10c4f:T2-4R34bvZle7y8o1B41bTjq_k-v7sADXYz8iGLy"
    "xuliulei666:cf2e371f5da446919237b4068a45bdc6:4d378e35f66d406cad58dee363300931:daf67596a471764edb3728d118176be8:FkOgtG-8U0Ao065f8ZV4RLLu2mdeCsATMPt53NjV"
    "eduproduct:a00ba13ca5464cd099e3cd55af3afb12:f9ac8122b0224763a13cc8007c14c44d:ae53c985981c1149f7fc4e157a1dc24f:aibkMkUA1SQJk3x34o7xTWDyLTWH-L5sTGL88HJg"
)

# 获取账号配置
# 格式: "账号名:kv_id:kv_preview_id:acc_id:acc_token"
get_account_field() {
    local config="$1"
    local field="$2"
    case "$field" in
        "name") echo "$config" | cut -d':' -f1 ;;
        "acc_id") echo "$config" | cut -d':' -f4 ;;
        "acc_token") echo "$config" | cut -d':' -f5 ;;
    esac
}

# Worker 名称
WORKER_NAME="douban-proxy"

# 创建临时目录
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 生成 Worker 代码
generate_worker_code() {
    cat > "$TEMP_DIR/index.js" << 'EOF'
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 允许的豆瓣API路径及其对应的域名
    const routeMap = {
      '/j/search_subjects': 'https://movie.douban.com',
      '/j/subject_abstract': 'https://movie.douban.com',
      '/j/subject_suggest': 'https://movie.douban.com',
      '/j/new_search_subjects': 'https://movie.douban.com',
      '/v2/movie/subject/': 'https://api.douban.com',
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
EOF
}

# 生成 wrangler.toml
generate_wrangler_config() {
    local account_name=$1
    cat > "$TEMP_DIR/wrangler.toml" << EOF
name = "${WORKER_NAME}"
main = "index.js"
compatibility_date = "2024-01-01"
EOF
}

# 部署到单个账号
deploy_to_account() {
    local config=$1
    local name=$(get_account_field "$config" "name")
    local acc_id=$(get_account_field "$config" "acc_id")
    local acc_token=$(get_account_field "$config" "acc_token")
    
    if [[ -z "$acc_id" || -z "$acc_token" ]]; then
        log_error "账号 ${name} 配置不完整"
        return 1
    fi
    
    log_info "部署到账号: ${name}"
    
    export CLOUDFLARE_ACCOUNT_ID="${acc_id}"
    export CLOUDFLARE_API_TOKEN="${acc_token}"
    
    generate_wrangler_config "$name"
    
    cd "$TEMP_DIR"
    local output=$(npx wrangler deploy 2>&1)
    local exit_code=$?
    cd - > /dev/null
    
    if [ $exit_code -eq 0 ]; then
        local worker_url=$(echo "$output" | grep -o 'https://[^[:space:]]*\.workers\.dev' | head -1)
        if [[ -n "$worker_url" ]]; then
            log_success "部署成功: $worker_url"
            echo "$worker_url"
        else
            log_success "部署成功: https://${WORKER_NAME}.${name}.workers.dev"
            echo "https://${WORKER_NAME}.${name}.workers.dev"
        fi
        return 0
    else
        log_error "部署失败: $output"
        return 1
    fi
}

# 显示帮助
show_help() {
    cat << EOF
豆瓣API代理 - 多账号部署脚本

用法: $0 [选项]

选项:
  -h, --help     显示帮助信息
  --dry-run      模拟运行

配置方法:
  编辑脚本中的 accounts 数组，添加你的账号信息:
  accounts=(
      "account1:ACCOUNT_ID:API_TOKEN"
      "account2:ACCOUNT_ID:API_TOKEN"
  )

获取账号信息:
  1. 登录 https://dash.cloudflare.com/
  2. Account ID: 在任意页面URL中或Workers页面右侧
  3. API Token: My Profile -> API Tokens -> Create Token
     选择 "Edit Cloudflare Workers" 模板

EOF
}

# 主函数
main() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help; exit 0 ;;
            --dry-run)
                log_info "模拟运行模式"
                log_info "配置的账号数: ${#accounts[@]}"
                exit 0
                ;;
            *) log_error "未知选项: $1"; show_help; exit 1 ;;
        esac
    done
    
    if [ ${#accounts[@]} -eq 0 ]; then
        log_error "未配置任何账号"
        log_info "请编辑脚本，在 accounts 数组中添加账号信息"
        log_info "使用 --help 查看配置说明"
        exit 1
    fi
    
    if ! command -v npx &> /dev/null; then
        log_error "npx 未安装，请先安装 Node.js"
        exit 1
    fi
    
    log_info "开始多账号部署"
    log_info "账号数量: ${#accounts[@]}"
    
    # 生成 Worker 代码
    generate_worker_code
    
    local success_count=0
    local total_count=${#accounts[@]}
    local deployed_urls=()
    
    for config in "${accounts[@]}"; do
        local name=$(get_account_field "$config" "name")
        echo
        log_info "======================================"
        log_info "处理账号: ${name}"
        log_info "======================================"
        
        local url=$(deploy_to_account "$config")
        if [ $? -eq 0 ]; then
            ((success_count++))
            deployed_urls+=("$url")
        fi
        
        sleep 1
    done
    
    # 输出结果
    echo
    log_info "======================================"
    log_info "部署完成"
    log_info "======================================"
    log_success "成功: ${success_count}/${total_count}"
    
    if [ ${#deployed_urls[@]} -gt 0 ]; then
        echo
        log_info "部署的 Worker URLs:"
        for url in "${deployed_urls[@]}"; do
            log_success "  $url"
        done
        
        # 保存到项目配置
        echo
        log_info "在 .env 中配置其中一个 URL:"
        log_info "  DOUBAN_API_PROXY=${deployed_urls[0]}"
    fi
    
    [ $success_count -eq $total_count ] && exit 0 || exit 1
}

main "$@"
