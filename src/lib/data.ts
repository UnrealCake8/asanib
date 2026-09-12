import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db, firebaseConfigured } from './firebase'
import { beginNotificationPermissionRequest, syncPushRegistration } from './notifications'
import type {
  Booking,
  ParsedRequest,
  ProviderProfile,
  Quote,
  Review,
  ServiceRequest,
} from '../types'

function requireFirebase() {
  if (!firebaseConfigured || !auth || !db) {
    throw new Error('Firebase is not configured. Add the Firebase web app values to .env.local.')
  }
  return { auth, db }
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { auth } = requireFirebase()
  const user = auth.currentUser
  if (!user) throw new Error('Sign in is required.')
  const token = await user.getIdToken()
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(payload.error || 'Asanib could not complete that action.')
  return payload
}

export function watchAuth(callback: (user: User | null) => void): Unsubscribe {
  if (!firebaseConfigured || !auth) {
    callback(null)
    return () => undefined
  }
  return onAuthStateChanged(auth, callback)
}

export async function ensureCustomerUser(): Promise<User> {
  const { auth } = requireFirebase()
  if (auth.currentUser) return auth.currentUser
  const result = await signInAnonymously(auth)
  await ensureUserDocument(result.user, 'customer')
  return result.user
}

export async function customerSignIn(email: string, password: string): Promise<User> {
  const { auth } = requireFirebase()
  if (auth.currentUser?.isAnonymous) await signOut(auth)
  const result = await signInWithEmailAndPassword(auth, email, password)
  await ensureUserDocument(result.user, 'customer')
  void syncPushRegistration()
  return result.user
}

export async function customerCreateAccount(email: string, password: string): Promise<User> {
  const { auth, db } = requireFirebase()
  if (auth.currentUser?.isAnonymous) {
    const credential = EmailAuthProvider.credential(email, password)
    const result = await linkWithCredential(auth.currentUser, credential)
    await updateDoc(doc(db, 'users', result.user.uid), { email: result.user.email ?? email, updatedAt: serverTimestamp() })
    void syncPushRegistration()
    return result.user
  }
  const result = await createUserWithEmailAndPassword(auth, email, password)
  await ensureUserDocument(result.user, 'customer')
  void syncPushRegistration()
  return result.user
}

export async function providerSignUp(email: string, password: string): Promise<User> {
  const { auth } = requireFirebase()
  const result = await createUserWithEmailAndPassword(auth, email, password)
  await ensureUserDocument(result.user, 'provider')
  return result.user
}

export async function providerSignIn(email: string, password: string): Promise<User> {
  const { auth } = requireFirebase()
  const result = await signInWithEmailAndPassword(auth, email, password)
  await ensureUserDocument(result.user, 'provider')
  void syncPushRegistration()
  return result.user
}

export async function logOut() {
  const { auth } = requireFirebase()
  await signOut(auth)
}

async function ensureUserDocument(user: User, role: 'customer' | 'provider') {
  const { db } = requireFirebase()
  const ref = doc(db, 'users', user.uid)
  const existing = await getDoc(ref)
  if (!existing.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      role,
      email: user.email ?? null,
      createdAt: serverTimestamp(),
    })
  }
}

export async function createServiceRequest(parsed: ParsedRequest): Promise<string> {
  const permissionPromise = beginNotificationPermissionRequest()
  await ensureCustomerUser()
  void syncPushRegistration(permissionPromise)
  const result = await apiPost<{ id: string; matchCount: number }>('/api/create-request', {
    query: parsed.query,
    location: parsed.location,
    budget: parsed.budget ?? null,
    urgency: parsed.urgency,
    scheduledFor: parsed.scheduledFor ?? null,
    category: parsed.category,
    summary: parsed.summary,
  })
  return result.id
}

function requestFromDoc(snapshot: { id: string; data: () => Record<string, unknown> }): ServiceRequest {
  return { id: snapshot.id, ...(snapshot.data() as Omit<ServiceRequest, 'id'>) }
}

function quoteFromDoc(snapshot: { id: string; data: () => Record<string, unknown> }): Quote {
  return { id: snapshot.id, ...(snapshot.data() as Omit<Quote, 'id'>) }
}

function bookingFromDoc(snapshot: { id: string; data: () => Record<string, unknown> }): Booking {
  return { id: snapshot.id, ...(snapshot.data() as Omit<Booking, 'id'>) }
}

function reviewFromDoc(snapshot: { id: string; data: () => Record<string, unknown> }): Review {
  return { id: snapshot.id, ...(snapshot.data() as Omit<Review, 'id'>) }
}

export function watchRequest(requestId: string, callback: (value: ServiceRequest | null) => void): Unsubscribe {
  const { db } = requireFirebase()
  return onSnapshot(doc(db, 'requests', requestId), (snapshot) => {
    callback(snapshot.exists() ? requestFromDoc(snapshot) : null)
  })
}

export function watchMyRequests(customerId: string, callback: (items: ServiceRequest[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'requests'), where('customerId', '==', customerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(requestFromDoc)))
}

export function watchQuotesForRequest(requestId: string, callback: (items: Quote[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'quotes'), where('requestId', '==', requestId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(quoteFromDoc)))
}

export async function saveProviderProfile(input: Omit<ProviderProfile, 'id' | 'ownerUid' | 'approved'>) {
  const { auth, db } = requireFirebase()
  const user = auth.currentUser
  if (!user || user.isAnonymous) throw new Error('Provider sign-in required.')
  const ref = doc(db, 'providers', user.uid)
  const existing = await getDoc(ref)
  const approved = existing.exists() ? Boolean(existing.data().approved) : false
  await setDoc(ref, {
    ownerUid: user.uid,
    businessName: input.businessName.trim(),
    phone: input.phone.trim(),
    whatsapp: input.whatsapp?.trim() || null,
    categories: input.categories,
    areas: input.areas.map((area) => area.trim()).filter(Boolean),
    availableNow: input.availableNow,
    approved,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function watchProviderProfile(uid: string, callback: (profile: ProviderProfile | null) => void): Unsubscribe {
  const { db } = requireFirebase()
  return onSnapshot(doc(db, 'providers', uid), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<ProviderProfile, 'id'>) } : null)
  })
}

export async function setProviderAvailability(uid: string, availableNow: boolean) {
  const permissionPromise = availableNow ? beginNotificationPermissionRequest() : null
  const { db } = requireFirebase()
  await updateDoc(doc(db, 'providers', uid), { availableNow, updatedAt: serverTimestamp() })
  if (availableNow) void syncPushRegistration(permissionPromise)
}

export function watchOpenRequests(callback: (items: ServiceRequest[]) => void): () => undefined {
  const { auth, db } = requireFirebase()
  const providerId = auth.currentUser?.uid
  if (!providerId) {
    callback([])
    return () => undefined
  }
  const q = query(collection(db, 'providerMatches', providerId, 'requests'), orderBy('createdAt', 'desc'))
  const stop = onSnapshot(q, (snapshot) => callback(snapshot.docs.map((snapshot) => {
    const data = snapshot.data() as Record<string, unknown>
    return { id: String(data.requestId || snapshot.id), ...(data as Omit<ServiceRequest, 'id'>) }
  })))
  return () => { stop(); return undefined }
}

export function matchingRequests(_profile: ProviderProfile, requests: ServiceRequest[]) {
  return requests.filter((request) => request.status === 'open')
}

export async function submitQuote(input: {
  requestId: string
  provider: ProviderProfile
  amount: number
  etaMinutes?: number
  message?: string
}) {
  if (!input.provider.approved) throw new Error('Your provider account must be approved before quoting.')
  void syncPushRegistration()
  await apiPost<{ id: string }>('/api/submit-quote', {
    requestId: input.requestId,
    amount: input.amount,
    etaMinutes: input.etaMinutes ?? null,
    message: input.message ?? '',
  })
}

export function watchMyProviderQuotes(providerId: string, callback: (items: Quote[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'quotes'), where('providerId', '==', providerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(quoteFromDoc)))
}

export async function acceptQuote(request: ServiceRequest, quote: Quote) {
  if (quote.requestId !== request.id) throw new Error('Quote does not belong to this request.')
  const result = await apiPost<{ bookingId: string }>('/api/accept-quote', { requestId: request.id, quoteId: quote.id })
  return result.bookingId
}

export async function cancelRequest(request: ServiceRequest) {
  await apiPost<{ ok: true }>('/api/cancel-request', { requestId: request.id })
}

export function watchCustomerBookings(customerId: string, callback: (items: Booking[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'bookings'), where('customerId', '==', customerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(bookingFromDoc)))
}

export function watchProviderBookings(providerId: string, callback: (items: Booking[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'bookings'), where('providerId', '==', providerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(bookingFromDoc)))
}

export async function updateBookingStatus(bookingId: string, status: Booking['status']) {
  await apiPost<{ ok: true }>('/api/update-booking', { bookingId, status })
}

export function watchCustomerReviews(customerId: string, callback: (items: Review[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'reviews'), where('customerId', '==', customerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(reviewFromDoc)))
}

export function watchProviderReviews(providerId: string, callback: (items: Review[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'reviews'), where('providerId', '==', providerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(reviewFromDoc)))
}

export async function submitReview(booking: Booking, rating: number, comment: string) {
  const { auth, db } = requireFirebase()
  const user = auth.currentUser
  if (!user || user.uid !== booking.customerId) throw new Error('Only the customer who booked this job can review it.')
  if (booking.status !== 'completed') throw new Error('You can review a job after it is marked completed.')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.')
  await setDoc(doc(db, 'reviews', booking.id), {
    bookingId: booking.id,
    requestId: booking.requestId,
    customerId: booking.customerId,
    providerId: booking.providerId,
    providerName: booking.providerName,
    rating,
    comment: comment.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
