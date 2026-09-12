import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function env(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

export function getR2Config() {
  const accountId = env('R2_ACCOUNT_ID')
  const accessKeyId = env('R2_ACCESS_KEY_ID')
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
  const bucket = env('R2_BUCKET_NAME')
  return {
    bucket,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  }
}

export async function createR2UploadUrl({ key, contentType, expiresIn = 600 }) {
  const { client, bucket } = getR2Config()
  return getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  }), { expiresIn })
}

export async function createR2ReadUrl({ key, expiresIn = 900 }) {
  const { client, bucket } = getR2Config()
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn })
}

export async function r2ObjectExists(key) {
  const { client, bucket } = getR2Config()
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false
    throw error
  }
}
