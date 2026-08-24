import { apiRequest } from './client'
import type { AttendanceSummary } from '../types/workout'

export async function listAttendanceDatesForMonth(year: number, month: number): Promise<string[]> {
  const mm = String(month).padStart(2, '0')
  const { dates } = await apiRequest<{ dates: string[] }>(`/api/attendance/month?year=${year}&month=${mm}`)
  return dates
}

export async function getAttendanceSummary(year: number): Promise<AttendanceSummary> {
  return apiRequest<AttendanceSummary>(`/api/attendance/summary/${year}`)
}

export async function getAttendance(date: string): Promise<boolean> {
  const { checked } = await apiRequest<{ checked: boolean }>(`/api/attendance/${date}`)
  return checked
}

export async function setAttendance(date: string, checked: boolean): Promise<boolean> {
  const response = await apiRequest<{ checked: boolean }>(`/api/attendance/${date}`, {
    method: 'PUT',
    body: { checked },
  })
  return response.checked
}
