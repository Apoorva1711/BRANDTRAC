import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import candidateRoutes from './routes/candidateRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import detectionRoutes from './routes/detectionRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Render reverse proxy warning raakunda:
app.set('trust proxy', 1);

// Security & Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Root Health Route
app.get('/', (req, res) => {
  res.json({
    app: 'BRANDTRACE API',
    tagline: 'Follow the Identity. Find the Risk.',
    status: 'online',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/detections', detectionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', systemRoutes);

// Error Handling
app.use(errorHandler);

export default app;