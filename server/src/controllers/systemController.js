import { Brand } from '../models/Brand.js';
import { OfficialAsset } from '../models/OfficialAsset.js';
import { Candidate } from '../models/Candidate.js';
import { Detection } from '../models/Detection.js';
import { Scan } from '../models/Scan.js';
import { SourceHealth } from '../models/SourceHealth.js';
import { DetectionClient } from '../services/detectionClient.js';
import { SampleDataAdapter } from '../adapters/sampleDataAdapter.js';
import { CsvJsonImportAdapter } from '../adapters/csvJsonImportAdapter.js';
import { ExternalPlatformAdapter } from '../adapters/externalMockAdapter.js';

export class SystemController {
  static async getHealth(req, res) {
    const detectionHealth = await DetectionClient.checkServiceHealth();

    res.json({
      status: 'healthy',
      app: 'BRANDTRACE API Server',
      version: '1.0.0',
      timestamp: new Date(),
      services: {
        database: 'connected',
        detectionService: detectionHealth.status
      }
    });
  }

  static async getSourceHealth(req, res, next) {
    try {
      const sampleAdapter = new SampleDataAdapter();
      const importAdapter = new CsvJsonImportAdapter();
      const twitterAdapter = new ExternalPlatformAdapter(
        'twitter_monitor',
        'Twitter/X Public Stream Adapter',
        'Twitter/X',
        'TWITTER_BEARER_TOKEN'
      );
      const playAdapter = new ExternalPlatformAdapter(
        'google_play_monitor',
        'Google Play Store Listing Adapter',
        'Google Play',
        'GOOGLE_PLAY_API_KEY'
      );
      const appStoreAdapter = new ExternalPlatformAdapter(
        'apple_store_monitor',
        'Apple App Store Catalog Adapter',
        'Apple App Store',
        'APPLE_DEVELOPER_KEY'
      );

      const detectionHealth = await DetectionClient.checkServiceHealth();

      const sources = [
        await sampleAdapter.checkHealth(),
        await importAdapter.checkHealth(),
        {
          sourceKey: 'python_detection_service',
          name: 'Python RapidFuzz & ImageHash Detection Microservice',
          sourceType: 'internal_adapter',
          status: detectionHealth.status,
          lastChecked: new Date(),
          details: detectionHealth.details
        },
        await twitterAdapter.checkHealth(),
        await playAdapter.checkHealth(),
        await appStoreAdapter.checkHealth()
      ];

      res.json({
        success: true,
        sources
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDashboardStats(req, res, next) {
    try {
      const organization = req.user.organization;
      const { brandId } = req.query;

      const baseFilter = { organization };
      if (brandId) baseFilter.brandId = brandId;

      // 1. Basic Counts calculated from MongoDB
      const [
        totalBrands,
        totalAssets,
        totalCandidates,
        socialFindings,
        appFindings,
        highAndCritical,
        awaitingReview,
        falsePositives,
        resolvedCount
      ] = await Promise.all([
        Brand.countDocuments({ organization, isArchived: false }),
        OfficialAsset.countDocuments(baseFilter),
        Candidate.countDocuments(baseFilter),
        Detection.countDocuments({ ...baseFilter, candidateType: 'social', status: { $in: ['New', 'Under Review', 'Suspected Impersonation'] } }),
        Detection.countDocuments({ ...baseFilter, candidateType: 'app', status: { $in: ['New', 'Under Review', 'Suspected Impersonation'] } }),
        Detection.countDocuments({ ...baseFilter, riskCategory: { $in: ['High', 'Critical'] }, status: { $in: ['New', 'Under Review', 'Suspected Impersonation'] } }),
        Detection.countDocuments({ ...baseFilter, status: { $in: ['New', 'Under Review'] } }),
        Detection.countDocuments({ ...baseFilter, status: 'False Positive' }),
        Detection.countDocuments({ ...baseFilter, status: 'Resolved' })
      ]);

      // 2. Risk Distribution Chart
      const riskDistribution = [
        { name: 'Low', count: await Detection.countDocuments({ ...baseFilter, riskCategory: 'Low' }), color: '#10b981' },
        { name: 'Medium', count: await Detection.countDocuments({ ...baseFilter, riskCategory: 'Medium' }), color: '#f59e0b' },
        { name: 'High', count: await Detection.countDocuments({ ...baseFilter, riskCategory: 'High' }), color: '#f97316' },
        { name: 'Critical', count: await Detection.countDocuments({ ...baseFilter, riskCategory: 'Critical' }), color: '#ef4444' }
      ];

      // 3. Category Comparison Chart
      const typeComparison = [
        { name: 'Social Profiles', activeThreats: socialFindings },
        { name: 'Mobile Apps', activeThreats: appFindings }
      ];

      // 4. Recent Detections (last 10)
      const recentDetections = await Detection.find(baseFilter)
        .populate('brandId', 'name logoUrl')
        .populate('candidateId')
        .sort({ createdAt: -1 })
        .limit(10);

      // 5. Recent Scans (last 5)
      const recentScans = await Scan.find(baseFilter)
        .populate('brandId', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

      const failedScans = await Scan.countDocuments({ ...baseFilter, status: 'Failed' });

      // 6. Platform / Surface Distribution
      const platformCandidates = await Candidate.find(baseFilter).select('platformOrStore candidateType');
      const platformMap = {};
      platformCandidates.forEach(c => {
        const p = c.platformOrStore || (c.candidateType === 'app' ? 'Google Play' : 'Web');
        platformMap[p] = (platformMap[p] || 0) + 1;
      });
      const platformDistribution = Object.entries(platformMap).map(([name, count]) => ({
        platform: name,
        candidates: count
      })).sort((a, b) => b.candidates - a.candidates);

      // 7. Risk Trends Over Time (last 7 days)
      const now = new Date();
      const trendMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        trendMap[key] = { date: key.slice(5), highRisk: 0, totalDetected: 0 };
      }

      const allDetections = await Detection.find(baseFilter).select('createdAt riskCategory');
      allDetections.forEach(d => {
        const key = new Date(d.createdAt).toISOString().split('T')[0];
        if (trendMap[key]) {
          trendMap[key].totalDetected++;
          if (['High', 'Critical'].includes(d.riskCategory)) {
            trendMap[key].highRisk++;
          }
        }
      });
      const riskTrends = Object.values(trendMap);

      res.json({
        success: true,
        stats: {
          totalBrands,
          totalAssets,
          totalCandidates,
          socialFindings,
          appFindings,
          highAndCritical,
          awaitingReview,
          falsePositives,
          resolvedCount,
          failedScans,
          riskDistribution,
          typeComparison,
          platformDistribution,
          riskTrends,
          recentDetections,
          recentScans
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
