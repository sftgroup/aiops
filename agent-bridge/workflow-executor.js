// ---------------------------------------------------------------------------
// AIOps Agent Bridge — YAML/JSON Workflow Executor (CJS)
// ---------------------------------------------------------------------------
// Parses declarative workflow definitions and executes steps sequentially.
//
// Workflow JSON:
// {
//   "name": "My Workflow",
//   "steps": [
//     { "id": "step1", "tool": "aiops_content_generate", "params": { "topic": "..." } },
//     { "id": "step2", "tool": "aiops_tts_synthesize", "params": { "text": "{{ steps.step1.body }}" } }
//   ]
// }
//
// Variable interpolation: {{ steps.<id>.<field> }}, {{ inputs.<field> }}
// Condition: skip step if resolved condition is falsy
// ---------------------------------------------------------------------------

const INTERP_REGEX = /\{\{\s*steps\.(\w+)\.(\S+?)\s*\}\}/g
const INPUT_REGEX = /\{\{\s*inputs\.(\w+)\s*\}\}/g

function resolveDotPath(obj, path) {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = current[part]
    } else {
      return undefined
    }
  }
  return current
}

function interpolate(template, stepOutputs, inputs) {
  let result = template

  result = result.replace(INTERP_REGEX, (_, stepId, path) => {
    const obj = stepOutputs[stepId]
    if (!obj || typeof obj !== 'object') return ''
    const val = resolveDotPath(obj, path)
    if (val === undefined) return ''
    if (typeof val === 'string') return val
    return JSON.stringify(val)
  })

  result = result.replace(INPUT_REGEX, (_, key) => {
    const val = inputs?.[key]
    if (val === undefined || val === null) return ''
    return String(val)
  })

  return result
}

function isFalsy(val) {
  const trimmed = val.trim()
  return trimmed === '' || trimmed === 'false' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '0'
}

// ── AIOps Skill registry ──

function createAIOpsSkills(baseUrl, apiKey, accessToken) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['X-API-Key'] = apiKey
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const skills = new Map()

  skills.set('aiops_content_generate', {
    name: 'aiops_content_generate',
    description: 'Generate social media content for 7 platforms with 6 styles',
    async execute(input) {
      const res = await fetch(`${baseUrl}/api/content/generate`, { method: 'POST', headers, body: JSON.stringify(input) })
      return res.json()
    },
  })

  skills.set('aiops_tts_synthesize', {
    name: 'aiops_tts_synthesize',
    description: 'Convert text to speech (14 languages, 80+ voices)',
    async execute(input) {
      const res = await fetch(`${baseUrl}/api/tts/synthesize`, { method: 'POST', headers, body: JSON.stringify(input) })
      return res.json()
    },
  })

  skills.set('aiops_tts_list_voices', {
    name: 'aiops_tts_list_voices',
    description: 'List available TTS voices',
    async execute(input) {
      const qs = input?.language ? `?language=${input.language}` : ''
      const res = await fetch(`${baseUrl}/api/tts/voices${qs}`, { headers })
      return res.json()
    },
  })

  skills.set('aiops_quota_check', {
    name: 'aiops_quota_check',
    description: 'Check remaining API quotas',
    async execute() {
      const res = await fetch(`${baseUrl}/api/quota/summary`, { headers })
      return res.json()
    },
  })

  skills.set('aiops_content_platforms', {
    name: 'aiops_content_platforms',
    description: 'Get supported content platforms',
    async execute() {
      const res = await fetch(`${baseUrl}/api/content/platforms`, { headers })
      return res.json()
    },
  })

  skills.set('aiops_content_styles', {
    name: 'aiops_content_styles',
    description: 'Get supported content styles',
    async execute() {
      const res = await fetch(`${baseUrl}/api/content/styles`, { headers })
      return res.json()
    },
  })

  skills.set('aiops_dashboard_overview', {
    name: 'aiops_dashboard_overview',
    description: 'Get today usage statistics',
    async execute() {
      const res = await fetch(`${baseUrl}/api/dashboard/overview`, { headers })
      return res.json()
    },
  })

  return skills
}

// ── Main: runWorkflow ────────────────────────────────────────────────────

async function runWorkflow(workflow, input) {
  const startTime = Date.now()
  const skills = createAIOpsSkills(input.baseUrl, input.apiKey, input.accessToken)
  const stepOutputs = {}
  const stepResults = []
  let status = 'success'

  for (const step of workflow.steps) {
    const tStart = Date.now()

    // Check condition
    if (step.condition) {
      const resolved = interpolate(step.condition, stepOutputs, input.variables)
      if (isFalsy(resolved)) {
        stepResults.push({ stepId: step.id, tool: step.tool, status: 'skipped', durationMs: 0 })
        continue
      }
    }

    // Resolve params
    const resolvedParams = {}
    if (step.params) {
      for (const [key, raw] of Object.entries(step.params)) {
        if (typeof raw === 'string') {
          resolvedParams[key] = interpolate(raw, stepOutputs, input.variables)
        } else {
          resolvedParams[key] = raw
        }
      }
    }

    const skill = skills.get(step.tool)
    if (!skill) {
      stepResults.push({ stepId: step.id, tool: step.tool, status: 'failed', error: `Unknown tool: ${step.tool}`, durationMs: Date.now() - tStart })
      status = 'partial'
      continue
    }

    try {
      const output = await skill.execute(resolvedParams)
      stepOutputs[step.id] = output
      stepResults.push({ stepId: step.id, tool: step.tool, status: 'completed', output, durationMs: Date.now() - tStart })
    } catch (err) {
      stepResults.push({ stepId: step.id, tool: step.tool, status: 'failed', error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - tStart })
      status = 'partial'
    }
  }

  return { name: workflow.name, status, totalDurationMs: Date.now() - startTime, steps: stepOutputs, stepResults }
}

// ── Preset Workflow Templates ────────────────────────────────────────────

const PRESET_WORKFLOWS = {
  'twitter-auto-post': {
    name: 'Twitter Auto Poster',
    description: 'Research trends → generate 3 variants → pick best → check quota',
    steps: [
      { id: 'platforms', tool: 'aiops_content_platforms' },
      { id: 'variant1', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'professional', language: 'en-US' } },
      { id: 'variant2', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'casual', language: 'en-US' } },
      { id: 'variant3', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'humorous', language: 'en-US' } },
      { id: 'quota', tool: 'aiops_quota_check', condition: '{{ steps.variant1.id }}' },
    ],
  },

  'multi-platform-post': {
    name: 'Multi-Platform Content',
    description: 'Generate one post for each major platform',
    steps: [
      { id: 'platforms', tool: 'aiops_content_platforms' },
      { id: 'styles', tool: 'aiops_content_styles' },
      { id: 'twitter_post', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'casual' } },
      { id: 'linkedin_post', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'linkedin', style: 'professional' } },
      { id: 'xiaohongshu_post', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'xiaohongshu', style: 'casual' } },
      { id: 'instagram_post', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'instagram', style: 'minimal' } },
    ],
  },

  'text-to-speech-pipeline': {
    name: 'Text to Speech Pipeline',
    description: 'Generate content → list voices → synthesize speech',
    steps: [
      { id: 'content', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'professional' } },
      { id: 'voices', tool: 'aiops_tts_list_voices', params: { language: '{{ inputs.language }}' } },
      { id: 'audio', tool: 'aiops_tts_synthesize', params: { text: '{{ steps.content.body }}', voice: '{{ inputs.voice }}', skipTranslation: true }, condition: '{{ steps.content.id }}' },
    ],
  },

  'daily-report': {
    name: 'Daily Content Report',
    description: 'Check usage → generate summary → recommend actions',
    steps: [
      { id: 'quota', tool: 'aiops_quota_check' },
      { id: 'dashboard', tool: 'aiops_dashboard_overview' },
      { id: 'summary', tool: 'aiops_content_generate', params: { topic: 'Daily usage: content remaining {{ steps.quota.content.remaining }}, TTS remaining {{ steps.quota.tts.remaining }}', platform: 'twitter', style: 'professional' }, condition: '{{ steps.quota.content.limit }}' },
    ],
  },
}

const EMPTY_WORKFLOW_TEMPLATE = {
  name: 'My Workflow',
  description: 'Describe what this workflow does',
  steps: [
    { id: 'step1', tool: 'aiops_content_generate', params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'professional' } },
    { id: 'step2', tool: 'aiops_quota_check' },
  ],
}

module.exports = { runWorkflow, PRESET_WORKFLOWS, EMPTY_WORKFLOW_TEMPLATE }
