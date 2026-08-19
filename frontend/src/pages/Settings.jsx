import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Settings() {
    const [notifMethods, setNotifMethods] = useState([])
    const [settings, setSettings] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState(null)

    useEffect(() => {
        Promise.all([
            api.getNotificationMethods(),
            api.getSettings(),
        ]).then(([methods, settingsData]) => {
            setNotifMethods(methods)
            setSettings(settingsData.settings || {})
        }).catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await api.updateSettings(settings)
            setToast({ type: 'success', message: 'Settings saved successfully' })
            setTimeout(() => setToast(null), 3000)
        } catch (err) {
            setToast({ type: 'error', message: `Failed to save: ${err.message}` })
            setTimeout(() => setToast(null), 5000)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="loading-container"><div className="spinner" /></div>
    }

    // Group notification methods that have env vars
    const configurable = notifMethods.filter(m => m.env_vars && m.env_vars.length > 0)

    const ENV_VAR_LABELS = {
        EMAIL_TO_ADDRESS: 'Recipient Email',
        EMAIL_USERNAME: 'SMTP Username',
        EMAIL_PASSWORD: 'SMTP Password',
        EMAIL_SMTP_SERVER: 'SMTP Server',
        EMAIL_SMTP_PORT: 'SMTP Port',
        EMAIL_FROM_ADDRESS: 'From Address (Optional)',
        EMAIL_SUBJECT_LINE: 'Subject Line (Optional)',
        PUSHOVER_PUSH_TOKEN: 'Pushover App Token',
        PUSHOVER_PUSH_USER: 'Pushover User Key',
        PUSHBULLET_API_TOKEN: 'Pushbullet API Token',
        TELEGRAM_BOT_TOKEN: 'Telegram Bot Token',
        TELEGRAM_CHAT_ID: 'Telegram Chat ID',
        SLACK_WEBHOOK: 'Slack Webhook URL',
        TWILIO_ACCOUNT_SID: 'Twilio Account SID',
        TWILIO_AUTH_TOKEN: 'Twilio Auth Token',
        TWILIO_SOURCE_NUMBER: 'Twilio From Number',
        TWILIO_DEST_NUMBER: 'Twilio To Number',
        NTFY_TOPIC: 'ntfy Topic',
        APPRISE_URL: 'Apprise URL',
        WEBHOOK_URL: 'Webhook URL',
    }

    const isSecret = (key) => {
        return key.includes('PASSWORD') || key.includes('TOKEN') || key.includes('AUTH') || key.includes('SID')
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Configure notification providers for your campsite alerts</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <div className="spinner" style={{ width: '1rem', height: '1rem' }} />
                            Saving…
                        </>
                    ) : 'Save Settings'}
                </button>
            </div>

            <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '700px' }}>
                {configurable.map(method => (
                    <div key={method.id} className="card">
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1.25rem',
                        }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {method.name}
                                </h3>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                    Select "{method.id}" as notification method in your searches
                                </p>
                            </div>
                            {method.env_vars.some(k => settings[k]) && (
                                <span className="status-badge status-found" style={{ fontSize: '0.6875rem' }}>
                                    Configured
                                </span>
                            )}
                        </div>

                        <div className="settings-grid">
                            {method.env_vars.map(envVar => (
                                <div key={envVar} className="form-group" style={{ marginBottom: '0.75rem' }}>
                                    <label className="form-label">{ENV_VAR_LABELS[envVar] || envVar}</label>
                                    <input
                                        className="form-input"
                                        type={isSecret(envVar) ? 'password' : 'text'}
                                        placeholder={envVar}
                                        value={settings[envVar] || ''}
                                        onChange={e => handleChange(envVar, e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Info card */}
            <div className="card" style={{ maxWidth: '700px', marginTop: '1.5rem', borderLeft: '3px solid var(--accent-sky)' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-sky)' }}>
                    💡 How Notifications Work
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Configure your notification credentials here, then select the corresponding notification
                    method when creating a search. When camply finds available campsites, it will send
                    notifications using the configured provider. You can also pass notification credentials
                    via environment variables when running the Docker container.
                </p>
            </div>

            {/* Toast */}
            {toast && (
                <div className="toast-container">
                    <div className={`toast toast-${toast.type}`}>
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    )
}
