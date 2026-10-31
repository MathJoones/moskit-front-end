import { api } from './api'
import type { DashboardStats } from '@/types/dashboard.types'

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await api.get<DashboardStats>('/dashboard/stats')
    return data
  },
}
