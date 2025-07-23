import { cn } from './utils'

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('class1', 'class2')
    expect(result).toBe('class1 class2')
  })

  it('should handle conditional classes', () => {
    const condition = true
    const result = cn('class1', condition ? 'class2' : '')
    expect(result).toBe('class1 class2')
  })

  it('should handle empty classes', () => {
    const result = cn('class1', '', undefined, null, false)
    expect(result).toBe('class1')
  })
})
