import axios from 'axios'
import { message } from 'antd'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('feishu_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('feishu_token')
      localStorage.removeItem('feishu_user')
      window.location.href = '/login'
      return Promise.reject(err)
    }
    const msg = err.response?.data?.error || err.message || '请求失败'
    message.error(msg)
    return Promise.reject(err)
  }
)

export const getProjects = (params) => api.get('/projects', { params })
export const getProject = (id) => api.get(`/projects/${id}`)
export const createProject = (data) => api.post('/projects', data)
export const updateProject = (id, data) => api.put(`/projects/${id}`, data)
export const deleteProject = (id) => api.delete(`/projects/${id}`)

export const getProjectNodes = (projectId) => api.get(`/nodes/${projectId}`)
export const advanceNode = (projectId, stageKey, actualDate) =>
  api.post(`/nodes/${projectId}/${stageKey}/advance`, { actualDate })
export const markNodeAbnormal = (projectId, stageKey, reason) =>
  api.post(`/nodes/${projectId}/${stageKey}/abnormal`, { reason })
export const updateNode = (projectId, stageKey, data) =>
  api.put(`/nodes/${projectId}/${stageKey}`, data)

export const getIssues = (params) => api.get('/issues', { params })
export const createIssue = (data) => api.post('/issues', data)
export const updateIssue = (id, data) => api.put(`/issues/${id}`, data)
export const deleteIssue = (id) => api.delete(`/issues/${id}`)

export const getUsers = () => api.get('/auth/users')

export default api
