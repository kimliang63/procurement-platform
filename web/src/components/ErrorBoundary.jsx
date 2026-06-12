import { Component } from 'react'
import { Button, Result } from 'antd'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面出错了"
          subTitle="请刷新页面重试"
          extra={<Button type="primary" onClick={() => window.location.reload()}>刷新页面</Button>}
        />
      )
    }
    return this.props.children
  }
}
