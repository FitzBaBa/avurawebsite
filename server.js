
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/avura_analytics', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema for Analytics Events
const eventSchema = new mongoose.Schema({
    event_type: String,
    user_id: String,
    session_id: String,
    timestamp: Date,
    event_data: Object
});
const Event = mongoose.model('Event', eventSchema);

// Track Event Endpoint
app.post('/api/track', async (req, res) => {
    try {
        const { event_type, user_id, session_id, timestamp, event_data } = req.body;
        const event = new Event({
            event_type,
            user_id,
            session_id,
            timestamp: new Date(timestamp),
            event_data
        });
        await event.save();
        res.status(200).send({ status: 'Event tracked' });
    } catch (err) {
        console.error('Error tracking event:', err);
        res.status(500).send({ error: 'Failed to track event' });
    }
});

// Metrics Endpoint
app.get('/api/metrics', async (req, res) => {
    try {
        const uniqueVisitors = await Event.distinct('user_id').count();
        const pageViews = await Event.countDocuments({ event_type: 'page_view' });
        const sessions = await Event.distinct('session_id').count();
        const trafficSources = await Event.aggregate([
            { $match: { event_type: 'traffic_source' } },
            { $group: { _id: '$event_data.referrer', count: { $sum: 1 } } }
        ]);
        const bounceRate = await Event.aggregate([
            { $match: { event_type: 'session_end', 'event_data.bounced': true } },
            { $count: 'bounced' },
            { $project: { rate: { $multiply: [{ $divide: ['$bounced', sessions] }, 100] } } }
        ]);
        const avgSessionDuration = await Event.aggregate([
            { $match: { event_type: 'session_end' } },
            { $group: { _id: null, avgDuration: { $avg: '$event_data.duration' } } }
        ]);
        const pagesPerSession = await Event.aggregate([
            { $match: { event_type: 'session_end' } },
            { $group: { _id: null, avgPages: { $avg: '$event_data.pages' } } }
        ]);
        const interactionEvents = await Event.countDocuments({ event_type: 'click' });
        const conversions = await Event.countDocuments({ event_type: 'conversion' });
        const conversionRate = (conversions / pageViews) * 100;
        const funnelDropOff = await Event.aggregate([
            { $match: { event_type: 'funnel_step' } },
            { $group: { _id: '$event_data.step', count: { $sum: 1 } } }
        ]);
        const formAbandonment = await Event.countDocuments({ event_type: 'form_abandonment' });
        const formAbandonmentRate = (formAbandonment / await Event.countDocuments({ event_type: 'funnel_step', 'event_data.step': 'start_form' })) * 100;
        const ctaClicks = await Event.countDocuments({ event_type: 'cta_click' });
        const ctaCtr = (ctaClicks / pageViews) * 100;
        const retentionRate = await Event.aggregate([
            { $match: { event_type: 'user_type', 'event_data.returning': true } },
            { $count: 'returning' },
            { $project: { rate: { $multiply: [{ $divide: ['$returning', uniqueVisitors] }, 100] } } }
        ]);
        const technicalPerformance = await Event.aggregate([
            { $match: { event_type: 'performance' } },
            { $group: {
                _id: null,
                load_time: { $avg: '$event_data.load_time' },
                dom_content_loaded: { $avg: '$event_data.dom_content_loaded' }
            } }
        ]);
        const pageViewsData = await Event.aggregate([
            { $match: { event_type: 'page_view' } },
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                count: { $sum: 1 }
            } },
            { $sort: { '_id': 1 } },
            { $limit: 7 } // Last 7 days
        ]);

        res.json({
            unique_visitors: uniqueVisitors,
            page_views: pageViews,
            sessions: sessions,
            traffic_sources: trafficSources.reduce((acc, curr) => ({ ...acc, [curr._id || 'direct']: curr.count }), {}),
            bounce_rate: bounceRate[0]?.rate || 0,
            avg_session_duration: avgSessionDuration[0]?.avgDuration || 0,
            pages_per_session: pagesPerSession[0]?.avgPages || 0,
            interaction_events: interactionEvents,
            conversion_rate: conversionRate || 0,
            funnel_drop_off: funnelDropOff.reduce((acc, curr) => ({ ...acc, [curr._id]: (curr.count / pageViews) * 100 }), {}),
            form_abandonment: formAbandonmentRate || 0,
            cta_ctr: ctaCtr || 0,
            retention_rate: retentionRate[0]?.rate || 0,
            csat_score: 'N/A', // Requires survey implementation
            technical_performance: technicalPerformance[0] || {},
            page_views_labels: pageViewsData.map(d => d._id),
            page_views_data: pageViewsData.map(d => d.count)
        });
    } catch (err) {
        console.error('Error fetching metrics:', err);
        res.status(500).send({ error: 'Failed to fetch metrics' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
