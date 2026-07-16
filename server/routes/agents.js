// ---------------------------------------------------------------------------
// AIOps Agent Routes — CRUD + Run + Marketplace API
// ---------------------------------------------------------------------------

const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { agentChatProxy } = require('../services/agent-gateway')
const store = require('../lib/agent-store')

// All agent routes require authentication
router.use(authenticate)

// ── LLM Gateway (used by AgentLoop) ──────────────────────────────────
router.post('/chat', agentChatProxy)

// ── Agent CRUD ───────────────────────────────────────────────────────

/**
 * GET /api/agents — List my agents
 */
router.get('/', async (req, res) => {
  try {
    const { page, pageSize, status } = req.query
    const result = await store.listAgents(req.user.tenantId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      status,
    })
    res.json(result)
  } catch (err) {
    console.error('[agents] list error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/agents — Create new agent
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, prompt, skillNames, tags, pricing } = req.body
    if (!name || !prompt) {
      return res.status(400).json({ error: 'name and prompt are required' })
    }

    const agent = await store.createAgent(req.user.tenantId, {
      name,
      description,
      prompt,
      skillNames,
      tags,
      pricing,
    })
    res.status(201).json(agent)
  } catch (err) {
    console.error('[agents] create error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/agents/:id — Get agent detail
 */
router.get('/:id', async (req, res) => {
  try {
    const agent = await store.getAgent(req.user.tenantId, req.params.id)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    res.json(agent)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * PUT /api/agents/:id — Update agent
 */
router.put('/:id', async (req, res) => {
  try {
    const agent = await store.updateAgent(req.user.tenantId, req.params.id, req.body)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    res.json(agent)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * DELETE /api/agents/:id — Delete agent
 */
router.delete('/:id', async (req, res) => {
  try {
    const agent = await store.deleteAgent(req.user.tenantId, req.params.id)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Agent Execution ───────────────────────────────────────────────────

/**
 * POST /api/agents/:id/run — Execute an agent (non-streaming, returns full result)
 *
 * This endpoint loads the agent definition, wraps AIOps tools, and runs
 * the AgentLoop (ReAct-style: Think → Call Tools → Observe → Repeat).
 *
 * For streaming, use the WebSocket or SSE endpoint instead.
 */
router.post('/:id/run', async (req, res) => {
  try {
    const agent = await store.getAgent(req.user.tenantId, req.params.id)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const { message, skillNames } = req.body
    if (!message) return res.status(400).json({ error: 'message is required' })

    // Dynamically import the agent-bridge runner
    const { runAIOpsAgent } = require('../../agent-bridge/runner')

    const result = await runAIOpsAgent({
      agentDef: {
        name: agent.name,
        prompt: agent.prompt,
        skillNames: skillNames || [],
      },
      userMessage: message,
      baseUrl: `${req.protocol}://${req.get('host')}`,
      apiKey: req.headers['x-api-key'] || '',
      jwtToken: req.headers.authorization?.replace('Bearer ', '') || '',
    })

    // Record execution
    await store.recordExecution(agent.id, req.user.userId, {
      input: { message },
      output: result,
      iterations: result.totalIterations,
      durationMs: result.totalDuration,
      tokensUsed: result.usage.totalTokens,
    }).catch(() => {})

    res.json(result)
  } catch (err) {
    console.error('[agents] run error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/agents/:id/executions — Get execution history
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const { page, pageSize } = req.query
    const result = await store.listExecutions(req.params.id, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Agent Publishing ──────────────────────────────────────────────────

/**
 * POST /api/agents/:id/publish — Publish to marketplace
 */
router.post('/:id/publish', async (req, res) => {
  try {
    const { category, price } = req.body
    const pub = await store.publishAgent(req.user.tenantId, req.params.id, { category, price })
    if (!pub) return res.status(404).json({ error: 'Agent not found' })
    res.json(pub)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/agents/:id/clone — Clone a marketplace agent to my workspace
 */
router.post('/:id/clone', async (req, res) => {
  try {
    const agent = await store.cloneAgent(req.user.tenantId, req.params.id)
    if (!agent) return res.status(404).json({ error: 'Agent not found or not published' })
    res.status(201).json(agent)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Marketplace (public search — uses tenant scope via agent's tenantId) ──

/**
 * GET /api/agents/marketplace/search — Search published agents
 */
router.get('/marketplace/search', async (req, res) => {
  try {
    const { keyword, category, page, pageSize, sortBy } = req.query
    const result = await store.searchMarketplace({
      keyword,
      category,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      sortBy,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
