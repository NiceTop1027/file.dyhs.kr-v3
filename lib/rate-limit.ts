/**
 * 간단한 메모리 기반 속도 제한 구현
 * 프로덕션 환경에서는 Redis 사용 권장
 */

interface RateLimitEntry {
    count: number
    resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// 5분마다 오래된 항목 정리
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitMap.entries()) {
        if (now > entry.resetTime) {
            rateLimitMap.delete(key)
        }
    }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
    /**
     * 시간 윈도우 (밀리초)
     * @default 60000 (1분)
     */
    windowMs?: number
    /**
     * 시간 윈도우 내 최대 요청 수
     * @default 50
     */
    max?: number
}

export interface RateLimitResult {
    success: boolean
    limit: number
    remaining: number
    reset: number
}

/**
 * IP 주소 기반 속도 제한 체크
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig = {}
): RateLimitResult {
    const windowMs = config.windowMs ?? 60000 // 기본 1분
    const max = config.max ?? 50 // 기본 50 요청

    const now = Date.now()
    const entry = rateLimitMap.get(identifier)

    if (!entry || now > entry.resetTime) {
        // 새로운 윈도우 시작
        const resetTime = now + windowMs
        rateLimitMap.set(identifier, {
            count: 1,
            resetTime,
        })

        return {
            success: true,
            limit: max,
            remaining: max - 1,
            reset: resetTime,
        }
    }

    // 기존 윈도우 내
    if (entry.count >= max) {
        return {
            success: false,
            limit: max,
            remaining: 0,
            reset: entry.resetTime,
        }
    }

    entry.count++
    rateLimitMap.set(identifier, entry)

    return {
        success: true,
        limit: max,
        remaining: max - entry.count,
        reset: entry.resetTime,
    }
}

/**
 * Next.js request에서 클라이언트 IP 추출
 */
export function getClientIp(request: Request): string {
    // Vercel이나 다른 프록시를 통한 경우
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }

    const realIp = request.headers.get('x-real-ip')
    if (realIp) {
        return realIp
    }

    // 기본값
    return 'unknown'
}
