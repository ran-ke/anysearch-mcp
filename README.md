# AnySearch MCP Server

搜索引擎 MCP 服务，部署在 Cloudflare Workers 上。

## 功能

- `search` — 通用/垂直搜索
- `batch_search` — 批量并行搜索
- `extract` — 网页内容提取
- `get_sub_domains` — 垂直领域目录查询

## 部署

### 方式一：Cloudflare Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages → Create → Connect to Git
3. 选择此仓库 `ran-ke/anysearch-mcp`
4. Build command: `npm install`
5. Deploy
6.（可选）Settings → Variables → 添加 `ANYSEARCH_API_KEY`

### 方式二：Wrangler CLI

```bash
npm install
npx wrangler deploy
# 可选：设置 API Key
npx wrangler secret put ANYSEARCH_API_KEY
```

## 接入 Kelivo

MCP 端点：`https://anysearch-mcp.<你的子域名>.workers.dev/mcp`

类型选 HTTP，填入上面的 URL 即可。

## API Key（可选）

不配也能用（匿名模式，限速较低）。想要更高限额：

1. 去 https://anysearch.com/console/api-keys 注册
2. 在 Cloudflare Dashboard → Settings → Variables 里加 `ANYSEARCH_API_KEY`
