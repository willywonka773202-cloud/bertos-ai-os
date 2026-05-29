import { getPublicReadiness } from '@/lib/bertos/coding/storage'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const readiness = await getPublicReadiness()
    return ok({ readiness })
  } catch (error) {
    return codingError(error)
  }
}
