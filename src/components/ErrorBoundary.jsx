import { Component } from 'react'
import { isModuleLoadError, reloadPage } from '../utils/moduleLoadError.js'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, repairing: false }
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
            {moduleError ? 'Repair the cached app files and reload. Your saved data will be kept.' : this.state.error.message}
          </p>
          {moduleError && <details style={{ fontSize: '0.75rem', overflowWrap: 'anywhere', marginBottom: '1rem' }}><summary>Error details</summary>{this.state.error.message}</details>}
          <button
            disabled={this.state.repairing}
            onClick={() => {
              if (moduleError) { this.setState({ repairing: true }); void reloadPage() }
              else this.setState({ error: null })
            }}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            {this.state.repairing ? 'Repairing…' : moduleError ? 'Repair and reload' : 'Try again'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
