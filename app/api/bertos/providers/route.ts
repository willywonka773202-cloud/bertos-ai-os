import { listProviderHub } from '@/lib/bertos/coding/provider-hub'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const providers = await listProviderHub()
    return ok({
      providers,
      online: providers.filter(p => p.online).length,
      total: providers.length,
    })
  } catch (error) {
    return codingError(error)
  }
}
