import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/**
 * 비밀번호를 해시화합니다
 */
export async function hashPassword(password: string): Promise<string> {
    if (!password) {
        throw new Error('Password is required')
    }
    return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * 비밀번호를 검증합니다
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
        return false
    }
    try {
        return await bcrypt.compare(password, hash)
    } catch {
        return false
    }
}

/**
 * 평문 비밀번호인지 확인 (마이그레이션용)
 */
export function isPlaintextPassword(value: string): boolean {
    // bcrypt 해시는 항상 $2a$, $2b$, $2y$ 등으로 시작
    return !value.startsWith('$2')
}
