// ---------------------------------------------------------------------------
// AIOps Agent Gateway — DeepSeek SSE Proxy for AgentLoop
// ---------------------------------------------------------------------------
// Receives OpenAI-compatible chat completion requests from AgentLoop,
// forwards them to DeepSeek API with SSE streaming, and records token usage.
// ---------------------------------------------------------------------------

const { chatCompletion } = require('./deepseek')
const { recordUsage } = require('./quota-service')

async function agentChatProxy(req, res) {
  try {
    const { model, messages, tools, temperature, max_tokens, stream } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' })
    }

    if (stream !== false) {
      // SSE streaming mode
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY
      if (!apiKey || apiKey === 'sk-placeholder') {
        res.write(`data: ${JSON.stringify({
          choices: [{ delta: { content: '[Agent] AI provider key not configured. Set DEEPSEEK_API_KEY in server environment.' }, index: 0, finish_reason: 'stop' }],
        })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
        return
      }

      try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            messages,
            tools: tools && tools.length > 0 ? tools : undefined,
            temperature: temperature ?? 0.7,
            max_tokens: max_tokens ?? 4096,
            stream: true,
          }),
        })

        if (!response.ok) {
          const errText = await response.text().catch(() => '')
          res.write(`data: ${JSON.stringify({ error: { message: `DeepSeek ${response.status}: ${errText.slice(0, 200)}` } })}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let promptTokens = 0
        let completionTokens = 0
        let totalTokens = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.usage) {
                promptTokens = parsed.usage.prompt_tokens || 0
                completionTokens = parsed.usage.completion_tokens || 0
                totalTokens = parsed.usage.total_tokens || 0
              }
            } catch { /* skip */ }

            res.write(`${line}\n\n`)
          }
        }

        // Record usage
        if (req.user?.tenantId && totalTokens > 0) {
          recordUsage(req.user.tenantId, req.user.userId || null, 'agent:chat', 1, totalTokens).catch(() => {})
        }

        res.write('data: [DONE]\n\n')

        // Send final usage in a separate event
        res.write(`data: ${JSON.stringify({
          usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens },
        })}\n\n`)

        res.end()
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    } else {
      // Non-streaming mode
      const result = await chatCompletion({
        model: model || 'deepseek-chat',
        messages,
        maxTokens: max_tokens ?? 4096,
        temperature: temperature ?? 0.7,
      })

      if (req.user?.tenantId && result?.usage) {
        recordUsage(
          req.user.tenantId,
          req.user.userId || null,
          'agent:chat',
          1,
          result.usage.total_tokens || 0,
        ).catch(() => {})
      }

      res.json(result)
    }
  } catch (err) {
    console.error('[agent-gateway] error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { agentChatProxy }
