// ---------------------------------------------------------------------------
// AIOps Agent Bridge — YAML/JSON Workflow Executor
// ---------------------------------------------------------------------------
// Parses declarative workflow definitions and executes steps sequentially.
//
// Workflow syntax (JSON):
// {
//   "name": "My Workflow",
//   "steps": [
//     { "id": "step1", "tool": "aiops_content_generate", "params": { "topic": "...", "platform": "twitter" } },
//     { "id": "step2", "tool": "aiops_tts_synthesize", "params": { "text": "{{ steps.step1.body }}" } },
//     { "id": "step3", "tool": "aiops_quota_check", "condition": "{{ steps.step2.audioPath }}" }
//   ]
// }
//
// Variable interpolation: {{ steps.<id>.<field> }}, {{ inputs.<field> }}
// Condition: truthy/falsy string (if condition evaluates to falsy, skip step)
// ---------------------------------------------------------------------------

import { createAIOpsSkills, type RunnableSkill } from './tools/aiops-tools'

export interface WorkflowDefinition {
  name: string
  description?: string
  steps: WorkflowStep[]
}

export interface WorkflowStep {
  id: string
  tool: string
  params?: Record<string, unknown>
  condition?: string
  timeoutMs?: number
}

export interface WorkflowInput {
  baseUrl: string
  apiKey: string
  variables?: Record<string, unknown>
}

export interface WorkflowStepResult {
  stepId: string
  tool: string
  status: 'completed' | 'skipped' | 'failed'
  durationMs: number
  output?: unknown
  error?: string
}

export interface WorkflowRunResult {
  name: string
  status: 'success' | 'partial' | 'failed'
  totalDurationMs: number
  steps: Record<string, unknown>
  stepResults: WorkflowStepResult[]
}

const INTERP_REGEX = /\{\{\s*steps\.(\w+)\.(\S+?)\s*\}\}/g
const INPUT_REGEX = /\{\{\s*inputs\.(\w+)\s*\}\}/g

export async function runWorkflow(
  workflow: WorkflowDefinition,
  input: WorkflowInput,
): Promise<WorkflowRunResult> {
  const startTime = Date.now()
  const allSkills = createAIOpsSkills(input.baseUrl, input.apiKey)
  const skillMap = new Map<string, RunnableSkill>()
  for (const s of allSkills) { skillMap.set(s.name, s) }

  const stepOutputs: Record<string, unknown> = {}
  const stepResults: WorkflowStepResult[] = []
  let status: WorkflowRunResult['status'] = 'success'

  for (const step of workflow.steps) {
    const tStart = Date.now()

    // Check condition
    if (step.condition) {
      const resolvedCondition = interpolate(step.condition, stepOutputs, input.variables)
      if (isFalsy(resolvedCondition)) {
        stepResults.push({ stepId: step.id, tool: step.tool, status: 'skipped', durationMs: 0 })
        continue
      }
    }

    // Resolve params
    const resolvedParams: Record<string, unknown> = {}
    if (step.params) {
      for (const [key, raw] of Object.entries(step.params)) {
        if (typeof raw === 'string') {
          resolvedParams[key] = interpolate(raw, stepOutputs, input.variables)
        } else {
          resolvedParams[key] = raw
        }
      }
    }

    // Execute tool
    const skill = skillMap.get(step.tool)
    if (!skill) {
      stepResults.push({
        stepId: step.id, tool: step.tool, status: 'failed',
        error: `Unknown tool: ${step.tool}`, durationMs: Date.now() - tStart,
      })
      status = 'partial'
      continue
    }

    try {
      const output = await skill.execute(resolvedParams)
      stepOutputs[step.id] = output
      stepResults.push({
        stepId: step.id, tool: step.tool, status: 'completed',
        output, durationMs: Date.now() - tStart,
      })
    } catch (err) {
      stepResults.push({
        stepId: step.id, tool: step.tool, status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - tStart,
      })
      status = 'partial'
    }
  }

  return {
    name: workflow.name,
    status,
    totalDurationMs: Date.now() - startTime,
    steps: stepOutputs,
    stepResults,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function interpolate(
  template: string,
  stepOutputs: Record<string, unknown>,
  inputs?: Record<string, unknown>,
): string {
  let result = template

  // {{ steps.stepId.field }} — with dot notation
  result = result.replace(INTERP_REGEX, (_, stepId: string, path: string) => {
    const obj = stepOutputs[stepId]
    if (!obj || typeof obj !== 'object') return ''
    const val = resolveDotPath(obj as Record<string, unknown>, path)
    if (val === undefined) return ''
    if (typeof val === 'string') return val
    return JSON.stringify(val)
  })

  // {{ inputs.field }}
  result = result.replace(INPUT_REGEX, (_, key: string) => {
    const val = inputs?.[key]
    if (val === undefined || val === null) return ''
    return String(val)
  })

  return result
}

function resolveDotPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

function isFalsy(val: string): boolean {
  const trimmed = val.trim()
  return trimmed === '' || trimmed === 'false' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '0'
}

// ── Preset Workflow Templates ────────────────────────────────────────────

export const PRESET_WORKFLOWS: Record<string, WorkflowDefinition> = {
  'twitter-auto-post': {
    name: 'Twitter Auto Poster',
    description: 'Research trends → generate 3 variants → pick best → ready to post',
    steps: [
      { id: 'platforms', tool: 'aiops_content_platforms' },
      {
        id: 'variant1', tool: 'aiops_content_generate',
        params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'professional', language: 'en-US' },
      },
      {
        id: 'variant2', tool: 'aiops_content_generate',
        params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'casual', language: 'en-US' },
      },
      {
        id: 'variant3', tool: 'aiops_content_generate',
        params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'humorous', language: 'en-US' },
      },
      {
        id: 'quota', tool: 'aiops_quota_check',
        condition: '{{ steps.variant1.id }}',
      },
    ],
  },

  'multi-platform-post': {
    name: 'Multi-Platform Content',
    description: 'Generate one post for each major platform with platform-optimized style',
    steps: [
      { id: 'platforms', tool: 'aiops_content_platforms' },
      { id: 'styles', tool: 'aiops_content_styles' },
      {
        id: 'twitter_post', tool: 'aiops_content_generate',
        params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'casual' },
      },
      {
        id: 'linkedin_post', tool: 'aiops_content_generate',
        params: { topic: '{{ inputs.topic }}', platform: 'linkedin', style: 'professional' },
      },
      {
        id: 'xiaohongshu_post', tool: 'aiops_content_generate',
        params: { topic: '{{ inputs.topic }}', platform: 'xiaohongshu', style: 'casual' },
      },
      {
        id: 'instagram_post', tool: 'aiops_content_generate',
        params: { topic: '{{ inputs.topic }}', platform: 'instagram', style: 'minimal' },
      },
    ],
  },

  'text-to-speech-pipeline': {
    name: 'Text to Speech Pipeline',
    description: 'Generate content → translate → optimize → synthesize speech',
    steps: [
      {
        id: 'content', tool: 'aiops_content_generate',
        params: { topic: '{{ inputs.topic }}', platform: 'twitter', style: 'professional' },
      },
      {
        id: 'voices', tool: 'aiops_tts_list_voices',
        params: { language: '{{ inputs.language }}' },
      },
      {
        id: 'audio', tool: 'aiops_tts_synthesize',
        params: {
          text: '{{ steps.content.body }}',
          voice: '{{ inputs.voice }}',
          skipTranslation: true,
        },
        condition: '{{ steps.content.id }}',
      },
    ],
  },

  'daily-report': {
    name: 'Daily Content Report',
    description: 'Check usage → generate summary content → recommend next actions',
    steps: [
      { id: 'quota', tool: 'aiops_quota_check' },
      { id: 'dashboard', tool: 'aiops_dashboard_overview' },
      {
        id: 'summary', tool: 'aiops_content_generate',
        params: {
          topic: 'Daily usage report summary based on: content remaining {{ steps.quota.content.remaining }}, TTS remaining {{ steps.quota.tts.remaining }}',
          platform: 'twitter',
          style: 'professional',
        },
        condition: '{{ steps.quota.content.limit }}',
      },
    ],
  },
}

// ── Template for empty workflow ──────────────────────────────────────────

export const EMPTY_WORKFLOW_TEMPLATE: WorkflowDefinition = {
  name: 'My Workflow',
  description: 'Describe what this workflow does',
  steps: [
    {
      id: 'step1',
      tool: 'aiops_content_generate',
      params: {
        topic: '{{ inputs.topic }}',
        platform: 'twitter',
        style: 'professional',
      },
    },
    {
      id: 'step2',
      tool: 'aiops_quota_check',
    },
  ],
}
