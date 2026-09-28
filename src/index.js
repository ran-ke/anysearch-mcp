const API_BASE = 'https://api.anysearch.com';

const TOOLS = [
  {
    name: 'search',
    description: '搜索引擎：通用网页搜索或垂直领域搜索（金融、学术、法律、医疗、代码等）',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        domain: { type: 'string', description: '垂直领域（可选）：finance, academic, legal, health, code, travel, film, gaming, business, security, social_media 等' },
        sub_domain: { type: 'string', description: '子领域路由（可选），如 finance.quote' },
        sub_domain_params: { type: 'string', description: '子领域参数（可选），格式 key=value,key2=value2 或 JSON' },
        max_results: { type: 'number', description: '最大结果数 1-10，默认 5' },
        language: { type: 'string', description: '结果语言偏好，如 zh-CN 或 en' }
      },
      required: ['query']
    }
  },
  {
    name: 'batch_search',
    description: '批量并行搜索，1-5个查询同时执行，支持混合通用+垂直搜索',
    inputSchema: {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          description: '查询数组，每项包含 query(必填)、domain、sub_domain、sub_domain_params、max_results',
          items: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              domain: { type: 'string' },
              sub_domain: { type: 'string' },
              sub_domain_params: { type: 'string' },
              max_results: { type: 'number' }
            },
            required: ['query']
          }
        }
      },
      required: ['queries']
    }
  },
  {
    name: 'extract',
    description: '提取网页完整内容，返回 Markdown 格式。支持 HTML/纯文本/JSON',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '目标网页 URL' }
      },
      required: ['url']
    }
  },
  {
    name: 'get_sub_domains',
    description: '查询垂直领域目录，了解可用的子领域和参数。垂直搜索前必须先调用此工具',
    inputSchema: {
      type: 'object',
      properties: {
        domains: { type: 'string', description: '要查询的领域，逗号分隔，如 finance,health。可选值：finance, academic, legal, health, code, travel, film, gaming, business, security, social_media, resource, ip, energy, environment, agriculture' }
      },
      required: ['domains']
    }
  }
];

function getApiKey(env) {
  return env.ANYSEARCH_API_KEY || '';
}

function buildHeaders(apiKey) {
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
  return h;
}

async function handleSearch(args, apiKey) {
  const body = { query: args.query };
  if (args.domain) body.domain = args.domain;
  if (args.sub_domain) body.sub_domain = args.sub_domain;
  if (args.sub_domain_params) {
    if (args.sub_domain_params.startsWith('{')) {
      body.sub_domain_params = JSON.parse(args.sub_domain_params);
    } else {
      const params = {};
      args.sub_domain_params.split(',').forEach(pair => {
        const [k, ...v] = pair.split('=');
        params[k.trim()] = v.join('=').trim();
      });
      body.sub_domain_params = params;
    }
  }
  if (args.max_results) body.max_results = args.max_results;
  if (args.language) body.language = args.language;

  const res = await fetch(`${API_BASE}/v1/search`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body)
  });
  return await res.json();
}

async function handleBatchSearch(args, apiKey) {
  const queries = args.queries || [];
  const results = await Promise.all(
    queries.map(q => handleSearch(q, apiKey))
  );
  return results;
}

async function handleExtract(args, apiKey) {
  const res = await fetch(`${API_BASE}/v1/extract`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ url: args.url })
  });
  return await res.json();
}

async function handleGetSubDomains(args, apiKey) {
  const domains = encodeURIComponent(args.domains);
  const res = await fetch(`${API_BASE}/v1/sub-domains?domains=${domains}`, {
    headers: buildHeaders(apiKey)
  });
  return await res.json();
}

async function callTool(name, args, apiKey) {
  switch (name) {
    case 'search': return await handleSearch(args, apiKey);
    case 'batch_search': return await handleBatchSearch(args, apiKey);
    case 'extract': return await handleExtract(args, apiKey);
    case 'get_sub_domains': return await handleGetSubDomains(args, apiKey);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // Health check
    if (path === '/' || path === '/health') {
      return jsonResponse({ status: 'ok', service: 'anysearch-mcp' });
    }

    // MCP endpoint
    if (path === '/mcp' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { method, params, id } = body;
        const apiKey = getApiKey(env);

        // initialize
        if (method === 'initialize') {
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'anysearch-mcp', version: '1.0.0' }
            }
          });
        }

        // list tools
        if (method === 'tools/list') {
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: { tools: TOOLS }
          });
        }

        // call tool
        if (method === 'tools/call') {
          const { name, arguments: args } = params;
          try {
            const result = await callTool(name, args, apiKey);
            return jsonResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }]
              }
            });
          } catch (e) {
            return jsonResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: `Error: ${e.message}` }],
                isError: true
              }
            });
          }
        }

        // notifications (ping, initialized, etc)
        if (method === 'notifications/initialized' || method === 'ping') {
          return jsonResponse({ jsonrpc: '2.0', id, result: {} });
        }

        return jsonResponse({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });

      } catch (e) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: `Parse error: ${e.message}` }
        }, 400);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};
