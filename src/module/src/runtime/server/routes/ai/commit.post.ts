import { streamText } from 'ai'
import { eventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getCommitSystem } from '../../utils/ai/generate'
import { resolveAIModel } from '../../utils/ai/gateway'
import { requireStudioAuth } from '../../utils/auth'

export default eventHandler(async (event) => {
  await requireStudioAuth(event)

  const config = useRuntimeConfig(event)

  const aiConfig = config.studio?.ai
  const apiKey = aiConfig?.apiKey
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'AI features are not enabled. Please set NUXT_STUDIO_AI_API_KEY environment variable.',
    })
  }

  const { changes } = await readBody<{ changes: string }>(event)

  if (!changes) {
    throw createError({
      statusCode: 400,
      statusMessage: 'changes is required',
    })
  }

  const messagePrefix = config.public.studio?.git?.commit?.messagePrefix || undefined

  return streamText({
    model: resolveAIModel(aiConfig, 'commit'),
    system: getCommitSystem(messagePrefix),
    prompt: changes,
    maxOutputTokens: 60,
    temperature: 0.3,
  }).toTextStreamResponse()
})
