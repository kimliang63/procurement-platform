import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// HRAS SDK 接入：等待壳子上下文就绪后渲染
async function bootstrap() {
  // 从 URL 提取 token（壳子通过 ?token=xxx 传入，SDK 未加载时兜底）
  const urlParams = new URLSearchParams(window.location.search)
  const urlToken = urlParams.get('token')
  if (urlToken) {
    localStorage.setItem('feishu_token', urlToken)
  }

  // 如果 SDK 已加载，等待就绪
  if (window.__HRAS__) {
    try {
      await window.__HRAS__.ready()
      const user = window.__HRAS__.getUser()
      const token = window.__HRAS__.getToken()
      console.log('[HRAS] 用户信息:', user)
      // SDK 也提供 token 时优先使用（覆盖 URL token）
      if (token) {
        localStorage.setItem('feishu_token', token)
      }
    } catch (e) {
      console.warn('[HRAS] SDK ready 失败，独立运行:', e.message)
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap()
