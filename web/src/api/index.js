import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('feishu_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // 绕过 ngrok 免费层浏览器保护
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})

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
