/**
 * Feature Toggle
 * Per-company feature flags. Checked before route executes.
 * Company model gets a `features` object: { ai, whatsapp, sync, ... }
 */
const Company = require('../models/Company');
const logger = require('../utils/logger');

// Cache features per company (60s) to avoid DB hit on every request
const featureCache = new Map();
const CACHE_TTL = 60 * 1000;

const getCompanyFeatures = async (companyId) => {
    const cached = featureCache.get(companyId.toString());
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.features;
    }

    const company = await Company.findById(companyId).select('features');
    const features = company?.features || {};

    featureCache.set(companyId.toString(), {
        features,
        timestamp: Date.now()
    });

    return features;
};

// ============================================================
// requireFeature('ai') — blocks route if feature disabled
// ============================================================
const requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, error: 'Not authenticated' });
            }

            const features = await getCompanyFeatures(req.user.company);

            if (!features[featureName]) {
                logger.warn('[Feature Toggle] Feature disabled', {
                    feature: featureName,
                    company: req.user.company.toString(),
                    path: req.originalUrl
                });
                return res.status(403).json({
                    success: false,
                    error: `Feature '${featureName}' is not enabled for your company`
                });
            }
            next();
        } catch (err) {
            logger.error('[Feature Toggle] Error:', err.message);
            return res.status(500).json({ success: false, error: 'Feature check failed' });
        }
    };
};

// ============================================================
// Invalidate cache (call when employer updates features)
// ============================================================
const invalidateFeatureCache = (companyId) => {
    featureCache.delete(companyId.toString());
};

module.exports = { requireFeature, getCompanyFeatures, invalidateFeatureCache };