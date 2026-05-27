import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

export const getProjects = (params) => api.get('/projects', { params })
export const getProject = (id) => api.get(`/projects/${id}`)
export const createProject = (data) => api.post('/projects', data)
export const updateProject = (id, data) => api.put(`/projects/${id}`, data)
export const deleteProject = (id) => api.delete(`/projects/${id}`)

export const getProjectNodes = (projectId) => api.get(`/nodes/${projectId}`)
export const advanceNode = (projectId, stageKey, status) =>
  api.post(`/nodes/${projectId}/${stageKey}/advance`, { status })
export const markNodeAbnormal = (projectId, stageKey, reason) =>
  api.post(`/nodes/${projectId}/${stageKey}/abnormal`, { reason })

export const getIssues = (params) => api.get('/issues', { params })
export const createIssue = (data) => api.post('/issues', data)
export const updateIssue = (id, data) => api.put(`/issues/${id}`, data)

export default api
