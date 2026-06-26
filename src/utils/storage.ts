const PREFIX = 'moskit:'

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`${PREFIX}${key}`)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value))
    } catch {
      // localStorage cheio ou desabilitado — silencioso
    }
  },

  remove(key: string): void {
    localStorage.removeItem(`${PREFIX}${key}`)
  },

  clear(): void {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  },
}
