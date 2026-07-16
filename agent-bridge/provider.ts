// ---------------------------------------------------------------------------
// AIOps Agent Bridge — LLM Gateway Provider
// ---------------------------------------------------------------------------
// Wraps the AIOps DeepSeek chat endpoint as an AgentX-compatible LLMProvider.
// Supports streaming (SSE), function-calling (tools), and AbortSignal.
// ---------------------------------------------------------------------------

/**
 * OpenAI-compatible chat request.
 */
export interface ChatRequest {
  model: string
  messages: LLMMessage[]
  tools?: OpenAIToolDef[]
  temperature?: number
  maxTokens?: number
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  tool_call_id?: string
  tool_calls?: LLMToolCall[]
}

export interface LLMToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface OpenAIToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ChatStreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call_start'; callId: string; name: string }
  | { type: 'tool_call_delta'; callId: string; arguments: string }
  | { type: 'done'; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: 'error'; error: Error }

export interface LLMProvider {
  chatStream(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent>
}

export function createAIOpsLLMProvider(config: {
  gatewayUrl: string
  accessToken: string
}): LLMProvider {
  return {
    async *chatStream(request, signal) {
      const res = await fetch(`${config.gatewayUrl}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
          model: request.model || 'deepseek-chat',
          messages: request.messages,
          tools: request.tools && request.tools.length > 0 ? request.tools : undefined,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
          stream: true,
        }),
        signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        yield { type: 'error', error: new Error(`LLM gateway error (${res.status}): ${text.slice(0, 200)}`) }
        return
      }

      if (!res.body) {
        yield { type: 'error', error: new Error('No response body from LLM gateway') }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      const toolCallsInProgress = new Map<string, { name: string }>()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue

            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') {
              yield { type: 'done', usage }
              return
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta

              if (delta?.content) {
                yield { type: 'text_delta', content: delta.content }
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.id && tc.function?.name) {
                    toolCallsInProgress.set(tc.id, { name: tc.function.name })
                    yield { type: 'tool_call_start', callId: tc.id, name: tc.function.name }
                  }
                  if (!tc.id && tc.function?.arguments) {
                    for (const [id] of toolCallsInProgress) {
                      yield { type: 'tool_call_delta', callId: id, arguments: tc.function.arguments }
                    }
                  }
                }
              }

              if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0,
                }
              }
            } catch {
              // skip malformed SSE chunks
            }
          }
        }

        yield { type: 'done', usage }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          yield { type: 'done', usage }
        } else {
          yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
        }
      }
    },
  }
}
