const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Track event
router.post('/track', async (req, res) => {
  try {
    const { event_type, user_id, session_id, timestamp, event_data } = req.body;
    const event = new Event({
      event_type,
      user_id,
      session_id,
      timestamp: new Date(timestamp),
      event_data,
    });
    await event.save();
    res.status(201).json({ message: 'Event tracked' });
  } catch (err) {
    console.error('Error tracking event:', err);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// Get metrics for dashboard
router.get('/metrics', async (req, res) => {
  try {
    // Calculate metrics
    const uniqueVisitors = await Event.distinct('user_id').countDocuments();
    const pageViews = await Event.countDocuments({ event_type: 'page_view' });
    const sessions = await Event.distinct('session_id').countDocuments();

    // Traffic sources
    const trafficSources = await Event.aggregate([
      { $match: { event_type: 'traffic_source' } },
      { $group: { _id: '$event_data.referrer', count: { $sum: 1 } } },
    ]).then((results) =>
      results.reduce((acc, { _id, count }) => ({ ...acc, [_id || 'direct']: count }), {})
    );

    // Bounce rate
    const bouncedSessions = await Event.countDocuments({
      event_type: 'session_end',
      'event_data.bounced': true,
    });
    const bounceRate = sessions ? ((bouncedSessions / sessions) * 100).toFixed(2) : 0;

    // Average session duration
    const sessionDurations = await Event.aggregate([
      { $match: { event_type: 'session_end' } },
      { $group: { _id: null, avgDuration: { $avg: '$event_data.duration' } } },
    ]);
    const avgSessionDuration = sessionDurations[0]?.avgDuration?.toFixed(2) || 0;

    // Pages per session
    const pagesPerSession = await Event.aggregate([
      { $match: { event_type: 'session_end' } },
      { $group: { _id: null, avgPages: { $avg: '$event_data.pages' } } },
    ]);
    const avgPagesPerSession = pagesPerSession[0]?.avgPages?.toFixed(2) || 0;

    // Interaction events
    const interactionEvents = await Event.countDocuments({ event_type: 'click' });

    // Conversion rate
    const conversions = await Event.countDocuments({ event_type: 'conversion' });
    const conversionRate = pageViews ? ((conversions / pageViews) * 100).toFixed(2) : 0;

    // Funnel drop-off
    const funnelDropOff = await Event.aggregate([
      { $match: { event_type: 'funnel_step' } },
      { $group: { _id: '$event_data.step', count: { $sum: 1 } } },
    ]).then((results) => {
      const total = results.find((r) => r._id === 'view_form')?.count || 1;
      return results.reduce((acc, { _id, count }) => ({
        ...acc,
        [_id]: ((count / total) * 100).toFixed(2),
      }), {});
    });

    // Form abandonment
    const formAbandonments = await Event.countDocuments({ event_type: 'form_abandonment' });
    const formViews = await Event.countDocuments({ event_type: 'funnel_step', 'event_data.step': 'view_form' });
    const formAbandonmentRate = formViews ? ((formAbandonments / formViews) * 100).toFixed(2) : 0;

    // CTA click-through rate
    const ctaClicks = await Event.countDocuments({ event_type: 'cta_click' });
    const ctaCtr = pageViews ? ((ctaClicks / pageViews) * 100).toFixed(2) : 0;

    // Retention rate
    const returningUsers = await Event.countDocuments({ event_type: 'user_type', 'event_data.returning': true });
    const retentionRate = uniqueVisitors ? ((returningUsers / uniqueVisitors) * 100).toFixed(2) : 0;

    // Technical performance
    const technicalPerformance = await Event.aggregate([
      { $match: { event_type: 'performance' } },
      {
        $group: {
          _id: null,
          load_time: { $avg: '$event_data.load_time' },
          dom_content_loaded: { $avg: '$event_data.dom_content_loaded' },
        },
      },
    ]).then((results) => ({
      load_time: results[0]?.load_time?.toFixed(2) + 's' || '0s',
      dom_content_loaded: results[0]?.dom_content_loaded?.toFixed(2) + 's' || '0s',
    }));

    // Page views over time (e.g., by week)
    const pageViewsData = await Event.aggregate([
      { $match: { event_type: 'page_view' } },
      {
        $group: {
          _id: { $week: '$timestamp' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]).then((results) => ({
      labels: results.map((r) => `Week ${r._id}`),
      data: results.map((r) => r.count),
    }));

    res.json({
      unique_visitors: uniqueVisitors,
      page_views: pageViews,
      sessions,
      traffic_sources: trafficSources,
      bounce_rate: bounceRate,
      avg_session_duration: avgSessionDuration,
      pages_per_session: avgPagesPerSession,
      interaction_events: interactionEvents,
      conversion_rate: conversionRate,
      funnel_drop_off: funnelDropOff,
      form_abandonment: formAbandonmentRate,
      cta_ctr: ctaCtr,
      retention_rate: retentionRate,
      csat_score: 'N/A', // Add CSAT logic if available
      technical_performance: technicalPerformance,
      page_views_labels: pageViewsData.labels,
      page_views_data: pageViewsData.data,
    });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

module.exports = router;