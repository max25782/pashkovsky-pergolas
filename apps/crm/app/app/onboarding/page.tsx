'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Loader2 } from 'lucide-react'

interface OnboardingStep {
  id: string
  title: string
  description: string
  completed: boolean
  isRequired: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    loadOnboardingTasks()
  }, [])

  async function loadOnboardingTasks() {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/onboarding/tasks', {
        headers: { 'x-admin-token': token || '' }
      })
      
      if (!res.ok) throw new Error('Failed to load onboarding tasks')
      
      const data = await res.json()
      setSteps(data.tasks || [])
      
      // Find first incomplete step
      const firstIncomplete = data.tasks.findIndex((t: OnboardingStep) => !t.completed)
      setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : 0)
    } catch (error) {
      console.error('Failed to load onboarding:', error)
    } finally {
      setLoading(false)
    }
  }

  async function completeStep(taskId: string) {
    try {
      const token = localStorage.getItem('admin_token')
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token || '',
        },
        body: JSON.stringify({ task_id: taskId }),
      })
      
      await loadOnboardingTasks()
    } catch (error) {
      console.error('Failed to complete step:', error)
    }
  }

  function skipOnboarding() {
    router.push(`/${'he'}/admin`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  const completedCount = steps.filter(s => s.completed).length
  const progress = (completedCount / steps.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {'he' === 'he' ? 'ברוך הבא' : 'Добро пожаловать'}
          </h1>
          <p className="text-xl text-white/70">
            {'he' === 'he' 
              ? 'בואו נתחיל - כמה צעדים פשוטים' 
              : 'Давайте начнем - несколько простых шагов'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/70">
              {completedCount} / {steps.length} {'he' === 'he' ? 'הושלמו' : 'завершено'}
            </span>
            <span className="text-sm text-white/70">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`
                relative p-6 rounded-xl border transition-all
                ${step.completed 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : currentStep === index
                    ? 'bg-blue-500/10 border-blue-500/30 scale-105'
                    : 'bg-white/5 border-white/10'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                  ${step.completed ? 'bg-green-500' : 'bg-blue-500'}
                `}>
                  {step.completed ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="font-bold">{index + 1}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    {step.isRequired && (
                      <span className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded">
                        {'he' === 'he' ? 'חובה' : 'Обязательно'}
                      </span>
                    )}
                  </div>
                  <p className="text-white/70 text-sm mb-4">{step.description}</p>

                  {!step.completed && currentStep === index && (
                    <button
                      onClick={() => completeStep(step.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <span>{'he' === 'he' ? 'סיים שלב זה' : 'Завершить этап'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={skipOnboarding}
            className="px-6 py-3 text-white/70 hover:text-white transition-colors"
          >
            {'he' === 'he' ? 'דלג' : 'Пропустить'}
          </button>

          {completedCount === steps.length && (
            <button
              onClick={() => router.push(`/${'he'}/admin`)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold transition-all"
            >
              {'he' === 'he' ? 'התחל להשתמש' : 'Начать работу'} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}



