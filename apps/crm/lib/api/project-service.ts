import { authFetch } from '@/lib/api/auth-fetch'
import type { PergolaProject, DeleteProjectResult } from '@/lib/types/gallery'

export class ProjectService {
  async fetchProjects(): Promise<PergolaProject[]> {
    const res = await authFetch('/admin-api/pergola-projects')
    if (!res.ok) throw new Error('Failed to fetch projects')
    const data = await res.json()
    return data.projects ?? []
  }

  async createProject(payload: {
    title_he: string
    desc_he?: string | null
    images: string[]
  }): Promise<PergolaProject> {
    const res = await authFetch('/admin-api/pergola-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? 'Failed to create project')
    }
    const data = await res.json()
    return data.project
  }

  async deleteProject(projectId: string, deleteS3: boolean): Promise<DeleteProjectResult> {
    const url = `/admin-api/pergola-projects?id=${encodeURIComponent(projectId)}${deleteS3 ? '&delete_s3=1' : ''}`
    const res = await authFetch(url, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to delete project')
    return data as DeleteProjectResult
  }
}

export const projectService = new ProjectService()
