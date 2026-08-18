import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'

const GOING_TO_CAMP_SUBPROVIDERS = [
    { label: "Parks Canada", value: "ParksCanada" },
    { label: "Washington State Parks", value: "WashingtonStateParks" },
    { label: "Wisconsin State Parks", value: "WisconsinStateParks" },
    { label: "Michigan State Parks", value: "MichiganStateParks" },
    { label: "BC Parks", value: "BCParks" },
    { label: "Maryland State Parks", value: "MarylandStateParks" },
    { label: "Nova Scotia Parks", value: "NovaScotiaParks" },
    { label: "Manitoba Parks", value: "ManitobaParks" },
]

export default function SearchForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const isEdit = Boolean(id)

    const [providers, setProviders] = useState([])
    const [notifMethods, setNotifMethods] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [form, setForm] = useState({
        name: '',
        provider: 'RecreationDotGov',
        recreation_area_ids: '',
        campground_ids: '',
        campsite_ids: '',
        start_date: '',
        end_date: '',
        days: [],
        weekends: false,
        nights: 1,
        equipment: '',
        polling_interval: 10,
        notifications: 'silent',
        enabled: true,
    })

    useEffect(() => {
        api.getProviders().then(setProviders).catch(console.error)
        api.getNotificationMethods().then(setNotifMethods).catch(console.error)

        if (isEdit) {
            setLoading(true)
            api.getSearch(id).then(data => {
                setForm({
                    name: data.name,
                    provider: data.provider,
                    recreation_area_ids: (data.recreation_area_ids || []).join(', '),
                    campground_ids: (data.campground_ids || []).join(', '),
                    campsite_ids: (data.campsite_ids || []).join(', '),
                    start_date: data.start_date,
                    end_date: data.end_date,
                    days: data.days || [],
                    weekends: data.weekends,
                    nights: data.nights,
                    equipment: (data.equipment || []).map(e => `${e[0]}:${e[1]}`).join(', '),
                    polling_interval: data.polling_interval,
                    notifications: data.notifications,
                    enabled: data.enabled,
                })
            }).catch(err => setError(err.message))
                .finally(() => setLoading(false))
        }
    }, [id, isEdit])

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const parseIdList = (str) => {
        if (!str.trim()) return []
        return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
            const n = parseInt(s)
            return isNaN(n) ? s : n
        })
    }

    const parseEquipment = (str) => {
        if (!str.trim()) return []
        return str.split(',').map(s => {
            const [type, len] = s.trim().split(':')
            return [type?.trim() || '', parseInt(len) || 0]
        }).filter(e => e[0])
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError(null)

        const data = {
            name: form.name,
            provider: form.provider,
            recreation_area_ids: parseIdList(form.recreation_area_ids),
            campground_ids: parseIdList(form.campground_ids),
            campsite_ids: parseIdList(form.campsite_ids),
            start_date: form.start_date,
            end_date: form.end_date,
            days: form.days,
            weekends: form.weekends,
            nights: form.nights,
            equipment: parseEquipment(form.equipment),
            polling_interval: Math.max(form.polling_interval, 5),
            notifications: form.notifications,
            enabled: form.enabled,
        }

        try {
            if (isEdit) {
                await api.updateSearch(id, data)
            } else {
                await api.createSearch(data)
            }
            navigate('/')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    const toggleDay = (day) => {
        setForm(prev => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day],
        }))
    }

    if (loading) {
        return <div className="loading-container"><div className="spinner" /></div>
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{isEdit ? 'Edit Search' : 'New Search'}</h1>
                    <p className="page-subtitle">Configure your campsite availability search</p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: '700px' }}>
                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{
                            background: 'var(--accent-rose-glow)',
                            border: '1px solid rgba(244,63,94,0.3)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.75rem 1rem',
                            color: 'var(--accent-rose)',
                            fontSize: '0.875rem',
                            marginBottom: '1.5rem',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="form-group">
                        <label className="form-label">Search Name</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="e.g. Yosemite Summer Weekend"
                            value={form.name}
                            onChange={e => handleChange('name', e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Provider</label>
                        <select
                            className="form-select"
                            value={form.provider}
                            onChange={e => handleChange('provider', e.target.value)}
                        >
                            {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name} — {p.description}</option>
                            ))}
                        </select>
                    </div>

                    {/* Location */}
                    <div className="form-section">
                        <h3 className="form-section-title">Location</h3>
                        <p className="form-hint" style={{ marginBottom: '1rem', marginTop: '-0.75rem' }}>
                            Enter IDs separated by commas. Use camply CLI to look up IDs: <code style={{ color: 'var(--accent-sky)', background: 'rgba(56,189,248,0.1)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>camply recreation-areas --search "Park Name"</code>
                        </p>

                        <div className="form-group">
                            <label className="form-label">Recreation Area IDs</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="e.g. 2725, 2991"
                                value={form.recreation_area_ids}
                                onChange={e => handleChange('recreation_area_ids', e.target.value)}
                            />
                            <div className="form-hint">Leave blank if using campground or campsite IDs</div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Campground IDs</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="e.g. 232447"
                                value={form.campground_ids}
                                onChange={e => handleChange('campground_ids', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Campsite IDs</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="e.g. 61391, 61392"
                                value={form.campsite_ids}
                                onChange={e => handleChange('campsite_ids', e.target.value)}
                            />
                            <div className="form-hint">Overrides campground / recreation area if specified</div>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="form-section">
                        <h3 className="form-section-title">Date Range</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Start Date (Arrival)</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={form.start_date}
                                    onChange={e => handleChange('start_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">End Date (Checkout)</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={form.end_date}
                                    onChange={e => handleChange('end_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="form-section">
                        <h3 className="form-section-title">Filters</h3>

                        <div className="form-group">
                            <label className="form-label">Days of Week</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {WEEKDAYS.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        className={`btn btn-sm ${form.days.includes(day) ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => toggleDay(day)}
                                    >
                                        {day.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                            <div className="form-hint">Leave unselected to search all days</div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={form.weekends}
                                        onChange={e => handleChange('weekends', e.target.checked)}
                                    />
                                    <span>Weekends only (Fri/Sat)</span>
                                </label>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Consecutive Nights</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="1"
                                    value={form.nights}
                                    onChange={e => handleChange('nights', parseInt(e.target.value) || 1)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Equipment</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="e.g. Tent:0, RV:25"
                                value={form.equipment}
                                onChange={e => handleChange('equipment', e.target.value)}
                            />
                            <div className="form-hint">Format: Type:Length — use 0 for no length filter. Types: Tent, RV, Trailer, Vehicle</div>
                        </div>
                    </div>

                    {/* Execution */}
                    <div className="form-section">
                        <h3 className="form-section-title">Execution</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Polling Interval (minutes)</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="5"
                                    value={form.polling_interval}
                                    onChange={e => handleChange('polling_interval', parseInt(e.target.value) || 10)}
                                />
                                <div className="form-hint">Minimum 5 minutes</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notification Method</label>
                                <select
                                    className="form-select"
                                    value={form.notifications}
                                    onChange={e => handleChange('notifications', e.target.value)}
                                >
                                    {notifMethods.map(n => (
                                        <option key={n.id} value={n.id}>{n.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-checkbox">
                                <input
                                    type="checkbox"
                                    checked={form.enabled}
                                    onChange={e => handleChange('enabled', e.target.checked)}
                                />
                                <span>Enable automatic polling</span>
                            </label>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="modal-footer" style={{ borderTop: 'none', paddingTop: '0.5rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/')}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <div className="spinner" style={{ width: '1rem', height: '1rem' }} />
                                    Saving…
                                </>
                            ) : (
                                isEdit ? 'Save Changes' : 'Create Search'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
