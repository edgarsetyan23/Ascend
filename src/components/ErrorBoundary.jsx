import { Component } from 'react'
import { isModuleLoadError, reloadPage } from '../utils/moduleLoadError.js'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const moduleError = isModuleLoadError(this.state.error)
      return (
        <div style={{ padding: this.props.compact ? '1rem' : '2rem', maxWidth: this.props.compact ? 260 : undefined, pointerEvents: 'auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <h2 style={{ marginBottom: '0.5rem', fontSize: this.props.compact ? '1rem' : undefined }}>
            {this.props.compact ? 'Mini Edgar is unavailable' : moduleError ? 'This part of the page could not load' : 'Something went wrong'}
          </h2>
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            {moduleError ? 'Check your connection, then reload the page to try again.' : this.state.error.message}
          </p>
          <button
            onClick={() => moduleError ? reloadPage() : this.setState({ error: null })}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            {moduleError ? 'Reload page' : 'Try again'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
