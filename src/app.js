// src/app.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import identity from './modules/platform/identity/index.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));  

identity.register(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;