import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { r2ObjectExists } from './_r2.js'

function clean(value, max = 240) {
  return String(value || '').trim().slice(0, max)
}

function cleanList(value, maxItems = 30, maxLength = 100) {
  return (Array.isArray(value) ? value : [])
    .map((item) => clean(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function safeCheckoutUrl(value) {
  const raw = clean(value, 700)
  if (!raw) return null
  let url
  try { url = new URL(raw) } catch { throw Object.assign(new Error('Enter a valid checkout URL.'), { statusCode: 400 }) }
  if (url.protocol !== 'https:') throw Object.assign(new Error('Checkout links must use HTTPS.'), { statusCode: 400 })
  const hostname = url.hostname.toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
    throw Object.assign(new Error('That checkout destination is not allowed.'), { statusCode: 400 })
  }
  url.hash = ''
  return url.toString()
}

async function verifiedKybPath(submitted, existing, userId, label) {
  const value = clean(submitted, 500) || existing || null
  if (!submitted) return value
  if (!value.startsWith(`kyb/${userId}/`)) throw Object.assign(new Error(`Invalid ${label} document.`), { statusCode: 400 })
  if (!await r2ObjectExists(value)) throw Object.assign(new Error(`${label} upload could not be verified.`), { statusCode: 400 })
  return value
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const ref = adminDb.collection('providers').doc(user.uid)
    const existingSnap = await ref.get()
    const existing = existingSnap.exists ? existingSnap.data() : {}

    const businessName = clean(req.body?.businessName, 160)
    const phone = clean(req.body?.phone, 40)
    const whatsapp = clean(req.body?.whatsapp, 40) || null
    const categories = cleanList(req.body?.categories, 20, 80)
    const areas = cleanList(req.body?.areas, 30, 120)

    if (!businessName || !phone || categories.length === 0) {
      return res.status(400).json({ error: 'Business name, phone and at least one service are required.' })
    }

    const legalBusinessName = clean(req.body?.legalBusinessName, 180) || null
    const tradeLicenseNumber = clean(req.body?.tradeLicenseNumber, 100) || null
    const licensingAuthority = clean(req.body?.licensingAuthority, 140) || null
    const licenseExpiry = clean(req.body?.licenseExpiry, 30) || null
    const representativeName = clean(req.body?.representativeName, 160) || null
    const representativeConfirmed = req.body?.representativeConfirmed === true

    const tradeLicensePath = await verifiedKybPath(req.body?.tradeLicensePath, existing?.tradeLicensePath, user.uid, 'trade licence')
    const emiratesIdFrontPath = await verifiedKybPath(req.body?.emiratesIdFrontPath, existing?.emiratesIdFrontPath, user.uid, 'Emirates ID front')
    const emiratesIdBackPath = await verifiedKybPath(req.body?.emiratesIdBackPath, existing?.emiratesIdBackPath, user.uid, 'Emirates ID back')

    const checkoutUrl = safeCheckoutUrl(req.body?.checkoutUrl)
    const checkoutProvider = clean(req.body?.checkoutProvider, 80) || null
    const previousCheckoutUrl = existing?.checkoutUrl ? String(existing.checkoutUrl) : null
    const checkoutChanged = checkoutUrl !== previousCheckoutUrl
    const paymentLinkStatus = checkoutUrl
      ? (checkoutChanged ? 'pending_review' : String(existing?.paymentLinkStatus || 'pending_review'))
      : 'none'

    const kybComplete = Boolean(
      legalBusinessName && tradeLicenseNumber && licensingAuthority && licenseExpiry &&
      representativeName && representativeConfirmed && tradeLicensePath && emiratesIdFrontPath && emiratesIdBackPath
    )
    const kybCriticalChanged = existingSnap.exists && [
      ['legalBusinessName', legalBusinessName],
      ['tradeLicenseNumber', tradeLicenseNumber],
      ['licensingAuthority', licensingAuthority],
      ['licenseExpiry', licenseExpiry],
      ['representativeName', representativeName],
      ['tradeLicensePath', tradeLicensePath],
      ['emiratesIdFrontPath', emiratesIdFrontPath],
      ['emiratesIdBackPath', emiratesIdBackPath],
    ].some(([key, value]) => (existing?.[key] ?? null) !== value)

    let kybStatus = String(existing?.kybStatus || 'not_started')
    let approved = existing?.approved === true
    if (!kybComplete) {
      kybStatus = 'not_started'
      approved = false
    } else if (!existingSnap.exists || kybCriticalChanged || kybStatus === 'not_started' || kybStatus === 'rejected') {
      kybStatus = 'pending'
      approved = false
    }

    await ref.set({
      ownerUid: user.uid,
      businessName,
      phone,
      whatsapp,
      categories,
      areas,
      availableNow: existing?.availableNow === true,
      approved,
      legalBusinessName,
      tradeLicenseNumber,
      licensingAuthority,
      licenseExpiry,
      representativeName,
      representativeConfirmed,
      tradeLicensePath,
      emiratesIdFrontPath,
      emiratesIdBackPath,
      kybStatus,
      kybSubmittedAt: kybComplete && kybStatus === 'pending' ? FieldValue.serverTimestamp() : existing?.kybSubmittedAt || null,
      checkoutUrl,
      checkoutProvider,
      checkoutHost: checkoutUrl ? new URL(checkoutUrl).hostname.toLowerCase() : null,
      paymentLinkStatus,
      createdAt: existingSnap.exists ? existing?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return res.status(200).json({ ok: true, kybStatus, approved, paymentLinkStatus })
  } catch (error) {
    return sendError(res, error)
  }
}
