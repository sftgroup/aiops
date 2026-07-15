import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function createApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function apiRequest(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = createApiUrl(baseUrl, path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export function registerTools(server: McpServer, baseUrl: string, apiKey: string) {
  server.tool(
    "generate_content",
    "使用 AIOps 生成社交媒体文案。支持多种平台和风格。",
    {
      topic: z.string().describe("文案主题"),
      platform: z
        .string()
        .optional()
        .describe("目标平台 (twitter/instagram/facebook/linkedin/tiktok/xiaohongshu/poster)"),
      style: z
        .string()
        .optional()
        .describe("文案风格 (professional/casual/humorous/inspirational/technical/minimal)"),
      length: z.string().optional().describe("文案长度"),
      language: z.string().optional().describe("目标语言，默认 zh-CN"),
    },
    async ({ topic, platform, style, length, language }) => {
      const result = await apiRequest(baseUrl, apiKey, "POST", "/api/content/generate", {
        topic,
        platform,
        style,
        length,
        language: language || "zh-CN",
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "synthesize_tts",
    "使用 AIOps 进行文本转语音合成，生成 MP3 音频。",
    {
      text: z.string().describe("要合成的文本"),
      voice: z
        .string()
        .optional()
        .describe("语音角色ID，默认 zh-CN-XiaoxiaoNeural"),
      speed: z.string().optional().describe("语速，如 +10% 或 -10%"),
      skipTranslation: z.boolean().optional().describe("是否跳过翻译"),
    },
    async ({ text, voice, speed, skipTranslation }) => {
      const result = await apiRequest(baseUrl, apiKey, "POST", "/api/tts/synthesize", {
        text,
        voice: voice || "zh-CN-XiaoxiaoNeural",
        speed,
        skipTranslation,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "list_tts_voices",
    "查询 AIOps 可用的语音合成角色列表。",
    {
      language: z.string().optional().describe("筛选语言，如 zh-CN, en-US, ja-JP"),
    },
    async ({ language }) => {
      let path = "/api/tts/voices";
      if (language) {
        path += `?language=${encodeURIComponent(language)}`;
      }
      const result = await apiRequest(baseUrl, apiKey, "GET", path);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "check_quota",
    "查询当前账户的 AIOps 配额使用情况，包括内容生成、TTS、视频的用量和上限。",
    {},
    async () => {
      const result = await apiRequest(baseUrl, apiKey, "GET", "/api/quota/summary");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
