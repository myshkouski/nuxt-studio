/**
 * AI provider factory
 *
 * Builds the AI client from the studio AI runtime config.
 * `vercel` (Vercel AI Gateway) is the default, `openai` targets the official
 * OpenAI API or any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, OpenRouter, proxies).
 *
 * Clients and models are memoized: `createOpenAICompatible` performs async
 * metadata fetching on construction, so rebuilding one per request would be wasteful.
 */

import { createGateway } from '@ai-sdk/gateway'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

export type AIModelRole = 'complete' | 'transform' | 'commit'

/**
 * Model roles that can be configured. `default` applies to every role that has
 * no explicit model, overriding the built-in provider fallback.
 */
export type AIModelKey = AIModelRole | 'default'

type AIProvider = 'openai' | 'vercel'

type AIClient = ReturnType<typeof createGateway> | ReturnType<typeof createOpenAICompatible>

/**
 * Default base URL per provider. An empty value means the client SDK's own
 * default is used.
 */
const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  vercel: '',
}

const FALLBACK_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  vercel: 'anthropic/claude-haiku-4.5',
}

export type StudioAIConfig = {
  provider?: string
  apiKey?: string
  baseUrl?: string
  headers?: Record<string, string>
  models?: Partial<Record<AIModelKey, string>>
} | undefined

/** Cached instances, keyed by the config values that affect them. */
const clients = new Map<string, AIClient>()
const models = new Map<string, LanguageModel>()

/**
 * Return the cached value for `key`, creating it on first use.
 */
function useCached<T>(cache: Map<string, T>, key: string, create: () => T): T {
  let value = cache.get(key)
  if (!value) {
    value = create()
    cache.set(key, value)
  }
  return value
}

function resolveProvider(aiConfig: StudioAIConfig): AIProvider {
  return aiConfig?.provider === 'openai' ? 'openai' : 'vercel'
}

function resolveBaseUrl(aiConfig: StudioAIConfig, provider: AIProvider): string {
  return aiConfig?.baseUrl?.replace(/\/+$/, '') || DEFAULT_BASE_URLS[provider]
}

function resolveModelId(aiConfig: StudioAIConfig, provider: AIProvider, role: AIModelRole): string {
  return aiConfig?.models?.[role] || aiConfig?.models?.default || FALLBACK_MODELS[provider]
}

/**
 * Key covering everything that identifies a client. `headers` is sorted so
 * key order does not fragment the cache.
 */
function clientKey(aiConfig: StudioAIConfig, provider: AIProvider, baseUrl: string): string {
  const headers = aiConfig?.headers
    ? Object.entries(aiConfig.headers).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('|')
    : ''
  return `${provider}|${baseUrl}|${aiConfig?.apiKey || ''}|${headers}`
}

function createClient(aiConfig: StudioAIConfig, provider: AIProvider, baseUrl: string): AIClient {
  const apiKey = aiConfig?.apiKey
  const headers = aiConfig?.headers
  const auth = { ...(apiKey ? { apiKey } : {}), ...(headers ? { headers } : {}) }

  return provider === 'vercel'
    ? createGateway({ ...auth, ...(baseUrl ? { baseURL: baseUrl } : {}) })
    : createOpenAICompatible({ ...auth, baseURL: baseUrl, name: 'openai' })
}

/**
 * Get the provider client for the config, reusing the cached instance.
 */
function useClient(aiConfig: StudioAIConfig, key: string, provider: AIProvider, baseUrl: string): AIClient {
  return useCached(clients, key, () => createClient(aiConfig, provider, baseUrl))
}

/**
 * Resolve the language model for a role from the studio AI runtime config.
 * Resolution order: `models[role]`, then `models.default`, then the
 * provider default as a last-resort fallback.
 */
export function resolveAIModel(aiConfig: StudioAIConfig, role: AIModelRole): LanguageModel {
  const provider = resolveProvider(aiConfig)
  const baseUrl = resolveBaseUrl(aiConfig, provider)
  const key = clientKey(aiConfig, provider, baseUrl)
  const modelId = resolveModelId(aiConfig, provider, role)

  return useCached(models, `${key}|${modelId}`, () => {
    return useClient(aiConfig, key, provider, baseUrl).languageModel(modelId) as LanguageModel
  })
}
