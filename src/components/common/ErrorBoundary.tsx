import { Component, ReactNode, ErrorInfo } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <Alert variant="error" title="Algo deu errado">
            {this.state.error?.message ?? 'Erro desconhecido'}
          </Alert>
          <Button variant="secondary" size="sm" onClick={this.reset}>
            Tentar novamente
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
