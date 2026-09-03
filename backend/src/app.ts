import express from 'express';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

import App from './routes/index.js';

const app = express();


app.use(express.json());

app.use('/api/v1' , App);

app.use(notFound);
app.use(errorHandler);

export default app;