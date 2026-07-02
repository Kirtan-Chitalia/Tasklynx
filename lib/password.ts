export interface PasswordStrength {
  score: number       // 0-4
  label: string
  errors: string[]
  color: string
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const errors: string[] = []

  if (password.length < 8)         errors.push('At least 8 characters')
  if (!/[A-Z]/.test(password))     errors.push('One uppercase letter')
  if (!/[a-z]/.test(password))     errors.push('One lowercase letter')
  if (!/[0-9]/.test(password))     errors.push('One number')
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
                                   errors.push('One special character')

  const score = Math.max(0, 4 - errors.length)
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']

  return { score, label: labels[score], errors, color: colors[score] }
}
