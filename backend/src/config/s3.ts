import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

const credentials = {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
};

const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

export const s3Public = new S3Client({
    endpoint: env.S3_PUBLIC_ENDPOINT,
    region: env.S3_REGION,
    credentials,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
});

export default s3;
