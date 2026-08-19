import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

function formatDateTime(dateStr) {
    if (!dateStr) return '—'
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr += 'Z'
    return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    })
}

function formatDate(dateStr) {
    if (!dateStr) return '—'
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr += 'Z'
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    })
}

export default function SearchDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [search, setSearch] = useState(null)
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [logs, setLogs] = useState('')

    const loadSearch = async () => {
        try {
            const data = await api.getSearch(id)
            setSearch(data)
            try {
                const logsData = await api.getSearchLogs(id)
                setLogs(logsData.logs)
            } catch (err) {
                // Ignore log fetching errors (e.g. 404 if no logs yet)
            }
        } catch (err) {
            console.error('Failed to load search:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSearch()
        const interval = setInterval(loadSearch, 10000)
        return () => clearInterval(interval)
    }, [id])

    const handleRun = async () => {
        setRunning(true)
        try {
            await api.runSearch(id)
            await loadSearch()
        } catch (err) {
            console.error('Run failed:', err)
        } finally {
            setRunning(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm(`Delete "${search.name}"?`)) return
        try {
            await api.deleteSearch(id)
            navigate('/')
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const handleToggle = async () => {
        try {
            await api.updateSearch(id, { enabled: !search.enabled })
            await loadSearch()
        } catch (err) {
            console.error('Toggle failed:', err)
        }
    }

    if (loading) {
        return <div className="loading-container"><div className="spinner" /></div>
    }

    if (!search) {
        return (
            <div className="empty-state">
                <div className="empty-state-title">Search not found</div>
                <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Dashboard</Link>
            </div>
        )
    }

    const statusClass = search.alert_count > 0 && search.status !== 'running' ? 'status-found' :
        search.status === 'running' ? 'status-running' :
            search.status === 'error' ? 'status-error' : 'status-idle'

    const statusText = search.alert_count > 0 && search.status !== 'running'
        ? `${search.alert_count} found`
        : search.status === 'running' ? 'Running'
            : search.status === 'error' ? 'Error'
                : 'Idle'

    return (
        <div>
            <Link to="/" className="detail-back">← Back to Dashboard</Link>

            <div className="page-header" style={{ marginTop: '1rem' }}>
                <div>
                    <h1 className="page-title">{search.name}</h1>
                    <p className="page-subtitle">{search.provider}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleRun}
                        disabled={search.status === 'running' || running}
                    >
                        ▶ Run Now
                    </button>
                    <Link to={`/searches/${id}/edit`} className="btn btn-secondary">
                        ✎ Edit
                    </Link>
                    <button className="btn btn-danger" onClick={handleDelete}>
                        ✕ Delete
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="detail-stats">
                <div className="stat-card">
                    <div className="stat-value">
                        <span className={`status-badge ${statusClass}`}>{statusText}</span>
                    </div>
                    <div className="stat-label">Status</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{search.alert_count}</div>
                    <div className="stat-label">Campsites Found</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ fontSize: '1rem' }}>{formatDateTime(search.last_run_at)}</div>
                    <div className="stat-label">Last Checked</div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                        <div className="stat-value" style={{ fontSize: '1rem' }}>
                            {search.enabled ? 'Enabled' : 'Disabled'}
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={search.enabled} onChange={handleToggle} />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                    <div className="stat-label">Auto-polling ({search.polling_interval}m)</div>
                </div>
            </div>

            {/* Search Config Summary */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    Search Configuration
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem' }}>
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>Date Range: </span>
                        <span>{formatDate(search.start_date)} → {formatDate(search.end_date)}</span>
                    </div>
                    {(search.recreation_area_ids?.length > 0) && (
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Rec Areas: </span>
                            <span>{search.recreation_area_ids.join(', ')}</span>
                        </div>
                    )}
                    {(search.campground_ids?.length > 0) && (
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Campgrounds: </span>
                            <span>{search.campground_ids.join(', ')}</span>
                        </div>
                    )}
                    {(search.campsite_ids?.length > 0) && (
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Campsites: </span>
                            <span>{search.campsite_ids.join(', ')}</span>
                        </div>
                    )}
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>Nights: </span>
                        <span>{search.nights}</span>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>Notifications: </span>
                        <span>{search.notifications}</span>
                    </div>
                    {search.weekends && (
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Weekends only</span>
                        </div>
                    )}
                    {(search.days?.length > 0) && (
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Days: </span>
                            <span>{search.days.join(', ')}</span>
                        </div>
                    )}
                </div>

                {search.last_error && (
                    <div style={{
                        marginTop: '1rem',
                        background: 'var(--accent-rose-glow)',
                        border: '1px solid rgba(244,63,94,0.2)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem 1rem',
                        fontSize: '0.8125rem',
                        color: 'var(--accent-rose)',
                    }}>
                        <strong>Last Error:</strong> {search.last_error}
                    </div>
                )}
            </div>

            {/* Alert History */}
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                Alert History
            </h2>

            {(!search.alerts || search.alerts.length === 0) ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                        No campsites found yet. The search will keep checking automatically.
                    </div>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Campsite</th>
                                <th>Campground</th>
                                <th>Date</th>
                                <th>Found</th>
                                <th>Book</th>
                            </tr>
                        </thead>
                        <tbody>
                            {search.alerts.map(alert => (
                                <tr key={alert.id}>
                                    <td>
                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                            {alert.campsite_name || 'Unknown'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            ID: {alert.campsite_id}
                                        </div>
                                    </td>
                                    <td>{alert.campground || alert.recreation_area || '—'}</td>
                                    <td>{formatDate(alert.booking_date)}</td>
                                    <td>{formatDateTime(alert.found_at)}</td>
                                    <td>
                                        {alert.booking_url ? (
                                            <a
                                                href={alert.booking_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-primary"
                                            >
                                                Book →
                                            </a>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Logs */}
            {logs && (
                <div style={{ marginTop: '2rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                        Process Logs
                    </h2>
                    <pre style={{
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: '1rem',
                        borderRadius: '6px',
                        overflowX: 'auto',
                        maxHeight: '400px',
                        fontSize: '0.8125rem',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {logs}
                    </pre>
                </div>
            )}
        </div>
    )
}
