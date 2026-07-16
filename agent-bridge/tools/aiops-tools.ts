// ---------------------------------------------------------------------------
// AIOps Agent Bridge — Tool Registry
// ---------------------------------------------------------------------------
// Wraps AIOps REST APIs as AgentX RunnableSkill[] so AgentLoop can call them
// via LLM function-calling (OpenAI-compatible tool definitions).
// ---------------------------------------------------------------------------

export interface RunnableSkill {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  mode: 'open' | 'mcp' | 'a2a'
  execute(input: Record<string, unknown>): Promise<unknown>
}

export function createAIOpsSkills(baseUrl: string, apiKey: string): RunnableSkill[] {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  }

  return [
    {
      name: 'aiops_content_generate',
      description:
        'Generate social media content for 7 platforms (twitter/instagram/xiaohongshu/linkedin/facebook/tiktok/poster) with 6 styles (professional/casual/humorous/inspirational/technical/minimal). Use this when the user asks you to write a post, tweet, or social media copy.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The topic or subject of the content. Be specific and descriptive.',
          },
          platform: {
            type: 'string',
            enum: ['twitter', 'instagram', 'xiaohongshu', 'linkedin', 'facebook', 'tiktok', 'poster'],
            description: 'Target social platform',
          },
          style: {
            type: 'string',
            enum: ['professional', 'casual', 'humorous', 'inspirational', 'technical', 'minimal'],
            description: 'Writing tone and style',
          },
          length: {
            type: 'string',
            enum: ['short', 'medium', 'long'],
            description: 'Desired content length',
          },
          language: { type: 'string', description: 'Output language code, e.g. zh-CN, en-US, ja-JP' },
        },
        required: ['topic'],
      },
      mode: 'open',
      async execute(input) {
        const res = await fetch(`${baseUrl}/api/content/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(input),
        })
        return res.json()
      },
    },

    {
      name: 'aiops_tts_synthesize',
      description:
        'Convert text to natural-sounding speech using Microsoft Edge TTS. Supports 14 languages and 80+ neural voices. Use aiops_tts_list_voices first if you need to discover available voices. Returns an audio file path.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to convert to speech' },
          voice: {
            type: 'string',
            description: 'Voice ID. Use aiops_tts_list_voices to discover options. Examples: en-US-JennyNeural, zh-CN-XiaoxiaoNeural',
            default: 'zh-CN-XiaoxiaoNeural',
          },
          speed: { type: 'string', description: 'Speech speed, e.g. +10% or -20%', default: '+0%' },
          skipTranslation: {
            type: 'boolean',
            description: 'Set to true if the text is already in the target voice language',
            default: false,
          },
        },
        required: ['text'],
      },
      mode: 'open',
      async execute(input) {
        const res = await fetch(`${baseUrl}/api/tts/synthesize`, {
          method: 'POST',
          headers,
          body: JSON.stringify(input),
        })
        return res.json()
      },
    },

    {
      name: 'aiops_tts_list_voices',
      description:
        'List all available TTS voices with their language, gender, and personality tags. Call this BEFORE aiops_tts_synthesize to discover which voices are available for a given language.',
      inputSchema: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            description: 'Filter by language code, e.g. zh-CN, en-US, ja-JP. Omit to list all.',
          },
        },
      },
      mode: 'open',
      async execute(input) {
        const params = input?.language ? `?language=${input.language}` : ''
        const res = await fetch(`${baseUrl}/api/tts/voices${params}`, { headers })
        return res.json()
      },
    },

    {
      name: 'aiops_quota_check',
      description:
        'Check remaining API quotas for content generation, TTS synthesis, and video generation. Call this before starting a large batch operation to ensure sufficient quota. Returns plan name, limits, used counts, and remaining counts.',
      inputSchema: { type: 'object', properties: {} },
      mode: 'open',
      async execute() {
        const res = await fetch(`${baseUrl}/api/quota/summary`, { headers })
        return res.json()
      },
    },

    {
      name: 'aiops_content_platforms',
      description:
        'Get the list of all supported social media platforms that content can be generated for. Currently supports: twitter, instagram, xiaohongshu, linkedin, facebook, tiktok, poster.',
      inputSchema: { type: 'object', properties: {} },
      mode: 'open',
      async execute() {
        const res = await fetch(`${baseUrl}/api/content/platforms`, { headers })
        return res.json()
      },
    },

    {
      name: 'aiops_content_styles',
      description:
        'Get the list of all supported content writing styles. Currently supports: professional, casual, humorous, inspirational, technical, minimal.',
      inputSchema: { type: 'object', properties: {} },
      mode: 'open',
      async execute() {
        const res = await fetch(`${baseUrl}/api/content/styles`, { headers })
        return res.json()
      },
    },

    {
      name: 'aiops_dashboard_overview',
      description:
        'Get today\'s usage statistics and summary totals for the current tenant. Includes call counts, token usage, and content generated counts.',
      inputSchema: { type: 'object', properties: {} },
      mode: 'open',
      async execute() {
        const res = await fetch(`${baseUrl}/api/dashboard/overview`, { headers })
        return res.json()
      },
    },
  ]
}
