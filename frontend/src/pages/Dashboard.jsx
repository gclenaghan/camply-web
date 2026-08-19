import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

function formatDate(dateStr) {
    if (!dateStr) return '—'
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr += 'Z'
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    })
}

function timeAgo(dateStr) {
    if (!dateStr) return 'Never'
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr += 'Z'
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now - d
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

function StatusBadge({ status, alertCount, enabled }) {
    if (enabled === false) {
        return <span className="status-badge" style={{ background: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}>⏸ Inactive</span>
    }
    if (alertCount > 0 && status !== 'running') {
        return <span className="status-badge status-found">✓ {alertCount} found</span>
    }
    switch (status) {
        case 'running':
            return <span className="status-badge status-running">● Running</span>
        case 'error':
            return <span className="status-badge status-error">✕ Error</span>
        default:
            return <span className="status-badge status-idle">○ Idle</span>
    }
}

function SearchCard({ search, onDelete, onToggle, onRun }) {
    const isInactive = !search.enabled;
    return (
        <div className="card search-card" style={{ opacity: isInactive ? 0.75 : 1 }} onClick={() => { }}>
            <Link to={`/searches/${search.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="search-card-header">
                    <div>
                        <div className="search-card-name">{search.name}</div>
                        <div className="search-card-provider">{search.provider}</div>
                    </div>
                    <StatusBadge status={search.status} alertCount={search.alert_count} enabled={search.enabled} />
                </div>

                <div className="search-card-meta">
                    <div className="meta-item">
                        <span className="icon">📅</span>
                        {formatDate(search.start_date)} → {formatDate(search.end_date)}
                    </div>
                    <div className="meta-item">
                        <span className="icon">🔄</span>
                        Every {search.polling_interval}m
                    </div>
                    <div className="meta-item">
                        <span className="icon">🔔</span>
                        {search.notifications}
                    </div>
                </div>
            </Link>

            <div className="search-card-footer">
                <div className="meta-item" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Last checked: {timeAgo(search.last_run_at)}
                </div>
                <div className="search-card-actions">
                    <label className="toggle" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={search.enabled}
                            onChange={() => onToggle(search)}
                        />
                        <span className="toggle-slider" />
                    </label>
                    <button
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Run now"
                        disabled={search.status === 'running'}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRun(search); }}
                    >
                        ▶
                    </button>
                    <button
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(search); }}
                        style={{ color: 'var(--accent-rose)' }}
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function Dashboard() {
    const [searches, setSearches] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    const loadSearches = async () => {
        try {
            const data = await api.getSearches()
            setSearches(data)
        } catch (err) {
            console.error('Failed to load searches:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSearches()
        const interval = setInterval(loadSearches, 10000)
        return () => clearInterval(interval)
    }, [])

    const handleDelete = async (search) => {
        if (!confirm(`Delete "${search.name}"?`)) return
        try {
            await api.deleteSearch(search.id)
            setSearches(searches.filter(s => s.id !== search.id))
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const handleToggle = async (search) => {
        try {
            await api.updateSearch(search.id, { enabled: !search.enabled })
            loadSearches()
        } catch (err) {
            console.error('Toggle failed:', err)
        }
    }

    const handleRun = async (search) => {
        try {
            await api.runSearch(search.id)
            loadSearches()
        } catch (err) {
            console.error('Run failed:', err)
        }
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        )
    }

    const activeSearches = searches.filter(s => s.enabled)
    const inactiveSearches = searches.filter(s => !s.enabled)

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Saved Searches</h1>
                    <p className="page-subtitle">
                        {searches.length === 0
                            ? 'No searches yet — create one to get started'
                            : `${searches.length} search${searches.length !== 1 ? 'es' : ''} configured`}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/searches/new')}>
                    + New Search
                </button>
            </div>

            {searches.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🏕️</div>
                    <div className="empty-state-title">No saved searches</div>
                    <div className="empty-state-text">
                        Create a search to start monitoring campsite availability.
                    </div>
                    <button className="btn btn-primary" onClick={() => navigate('/searches/new')}>
                        + Create Your First Search
                    </button>
                </div>
            ) : (
                <>
                    {activeSearches.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Active Searches</h2>
                            <div className="search-grid">
                                {activeSearches.map(search => (
                                    <SearchCard
                                        key={search.id}
                                        search={search}
                                        onDelete={handleDelete}
                                        onToggle={handleToggle}
                                        onRun={handleRun}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {inactiveSearches.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-muted)' }}>Inactive / Completed Searches</h2>
                            <div className="search-grid">
                                {inactiveSearches.map(search => (
                                    <SearchCard
                                        key={search.id}
                                        search={search}
                                        onDelete={handleDelete}
                                        onToggle={handleToggle}
                                        onRun={handleRun}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
