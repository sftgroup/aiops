// ---------------------------------------------------------------------------
// AIOps Agent Bridge — Agent Runner
// ---------------------------------------------------------------------------
// One-liner: runAIOpsAgent({ prompt, skills, userMessage }) → AgentLoop result.
//
// Uses @agentxv2/sdk's AgentLoop engine with AIOps tools + LLM provider.
// Falls back to a minimal inline AgentLoop if @agentxv2/sdk is not installed.
// ---------------------------------------------------------------------------

import { createAIOpsSkills, type RunnableSkill } from './tools/aiops-tools'
import { createAIOpsLLMProvider, type LLMProvider, type LLMMessage, type OpenAIToolDef, type LLMToolCall } from './provider'

export interface AgentRunInput {
  agentDef: {
    name: string
    prompt: string
    skillNames: string[]
  }
  userMessage: string
  baseUrl: string
  apiKey: string
  jwtToken: string
  maxIterations?: number
  timeoutMs?: number
  onTextDelta?: (delta: string) => void
  onToolCall?: (call: { name: string; arguments: Record<string, unknown> }) => void
  onToolResult?: (result: { name: string; result: unknown; error?: string; durationMs: number }) => void
  onThinking?: (message: string) => void
  onComplete?: (result: AgentRunResult) => void
  onError?: (error: Error) => void
}

export interface AgentRunResult {
  finalText: string
  toolCalls: ToolCallRecord[]
  totalIterations: number
  totalDuration: number
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export interface ToolCallRecord {
  callId: string
  name: string
  arguments: Record<string, unknown>
  result: unknown
  error?: string
  durationMs: number
}

const DEFAULT_MAX_ITERATIONS = 8
const DEFAULT_TIMEOUT_MS = 180_000

export async function runAIOpsAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const allSkills = createAIOpsSkills(input.baseUrl, input.apiKey)
  const enabledSkills = allSkills.filter(s => input.agentDef.skillNames.length === 0 || input.agentDef.skillNames.includes(s.name))
  const llmProvider = createAIOpsLLMProvider({ gatewayUrl: input.baseUrl, accessToken: input.jwtToken })

  return runAgentLoop({
    prompt: input.agentDef.prompt,
    skills: enabledSkills,
    llmProvider,
    userMessage: input.userMessage,
    maxIterations: input.maxIterations ?? DEFAULT_MAX_ITERATIONS,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    onTextDelta: input.onTextDelta,
    onToolCall: input.onToolCall,
    onToolResult: input.onToolResult,
    onThinking: input.onThinking,
    onComplete: input.onComplete,
    onError: input.onError,
  })
}

// ── Inline Minimal AgentLoop (no dependency on @agentxv2/sdk) ──────────

interface AgentLoopConfig {
  prompt: string
  skills: RunnableSkill[]
  llmProvider: LLMProvider
  userMessage: string
  maxIterations: number
  timeoutMs: number
  onTextDelta?: (delta: string) => void
  onToolCall?: (call: { name: string; arguments: Record<string, unknown> }) => void
  onToolResult?: (result: { name: string; result: unknown; error?: string; durationMs: number }) => void
  onThinking?: (message: string) => void
  onComplete?: (result: AgentRunResult) => void
  onError?: (error: Error) => void
}

function buildTools(skills: RunnableSkill[]): OpenAIToolDef[] {
  return skills.map(s => ({
    type: 'function' as const,
    function: {
      name: s.name,
      description: s.description,
      parameters: {
        type: 'object',
        properties: (s.inputSchema.properties as Record<string, Record<string, unknown>>) || {},
        required: (s.inputSchema.required as string[]) || [],
      },
    },
  }))
}

function buildSystemPrompt(prompt: string, skills: RunnableSkill[]): string {
  const skillList = skills.map(s => `- **${s.name}**: ${s.description}`).join('\n')
  return `${prompt}\n\n## Available Tools\nYou have access to these tools. Use them when appropriate:\n${skillList}`
}

async function runAgentLoop(config: AgentLoopConfig): Promise<AgentRunResult> {
  const startTime = Date.now()
  const toolRecords: ToolCallRecord[] = []
  let finalText = ''
  let iterations = 0
  const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  const tools = buildTools(config.skills)
  const systemPrompt = buildSystemPrompt(config.prompt, config.skills)

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: config.userMessage },
  ]

  const skillMap = new Map<string, RunnableSkill>()
  for (const s of config.skills) {
    skillMap.set(s.name, s)
  }

  try {
    while (iterations < config.maxIterations) {
      iterations++

      if (iterations > 1 && config.onThinking) {
        config.onThinking(`Thinking... (round ${iterations}/${config.maxIterations})`)
      }

      const stream = config.llmProvider.chatStream({
        model: 'deepseek-chat',
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: 0.7,
        maxTokens: 4096,
      })

      let text = ''
      const toolCallsAccum = new Map<string, { name: string; arguments: string }>()

      for await (const event of stream) {
        switch (event.type) {
          case 'text_delta':
            text += event.content
            if (config.onTextDelta) config.onTextDelta(event.content)
            break
          case 'tool_call_start':
            toolCallsAccum.set(event.callId, { name: event.name, arguments: '' })
            break
          case 'tool_call_delta': {
            const tc = toolCallsAccum.get(event.callId)
            if (tc) tc.arguments += event.arguments
            break
          }
          case 'done':
            totalUsage.promptTokens += event.usage.promptTokens
            totalUsage.completionTokens += event.usage.completionTokens
            totalUsage.totalTokens += event.usage.totalTokens
            break
          case 'error':
            throw event.error
        }
      }

      finalText += text

      const parsedToolCalls: { callId: string; name: string; arguments: Record<string, unknown> }[] = []
      for (const [callId, tc] of toolCallsAccum) {
        let parsedArgs: Record<string, unknown> = {}
        try {
          parsedArgs = tc.arguments ? JSON.parse(tc.arguments) : {}
        } catch {
          parsedArgs = { raw: tc.arguments }
        }
        parsedToolCalls.push({ callId, name: tc.name, arguments: parsedArgs })
      }

      if (parsedToolCalls.length === 0) break

      const assistantMsg: LLMMessage = {
        role: 'assistant',
        content: text || null,
      }
      if (parsedToolCalls.length > 0) {
        assistantMsg.tool_calls = parsedToolCalls.map(tc => ({
          id: tc.callId,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
      }
      messages.push(assistantMsg)

      for (const tc of parsedToolCalls) {
        if (config.onToolCall) config.onToolCall({ name: tc.name, arguments: tc.arguments })

        const tStart = Date.now()
        const skill = skillMap.get(tc.name)
        let record: ToolCallRecord

        if (!skill) {
          record = {
            callId: tc.callId,
            name: tc.name,
            arguments: tc.arguments,
            result: null,
            error: `Unknown tool: ${tc.name}`,
            durationMs: Date.now() - tStart,
          }
        } else {
          try {
            const result = await skill.execute(tc.arguments)
            record = {
              callId: tc.callId,
              name: tc.name,
              arguments: tc.arguments,
              result,
              durationMs: Date.now() - tStart,
            }
          } catch (err) {
            record = {
              callId: tc.callId,
              name: tc.name,
              arguments: tc.arguments,
              result: null,
              error: err instanceof Error ? err.message : String(err),
              durationMs: Date.now() - tStart,
            }
          }
        }

        if (config.onToolResult) config.onToolResult({ name: record.name, result: record.result, error: record.error, durationMs: record.durationMs })
        toolRecords.push(record)

        messages.push({
          role: 'tool',
          content: record.error ? `Error: ${record.error}` : typeof record.result === 'string' ? record.result : JSON.stringify(record.result),
          tool_call_id: tc.callId,
        })
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    if (config.onError) config.onError(error)
    if (finalText === '' && toolRecords.length === 0) {
      finalText = `Agent execution error: ${error.message}`
    }
  }

  const result: AgentRunResult = {
    finalText: finalText || 'No response generated.',
    toolCalls: toolRecords,
    totalIterations: iterations,
    totalDuration: Date.now() - startTime,
    usage: totalUsage,
  }

  if (config.onComplete) config.onComplete(result)
  return result
}

export { createAIOpsSkills, createAIOpsLLMProvider }
