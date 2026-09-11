import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  addDoc,
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
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db, firebaseConfigured } from './firebase'
import type {
  Booking,
  ParsedRequest,
  ProviderProfile,
  Quote,
  ServiceRequest,
} from '../types'

function requireFirebase() {
  if (!firebaseConfigured || !auth || !db) {
    throw new Error('Firebase is not configured. Add the Firebase web app values to .env.local.')
  }
  return { auth, db }
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
  const { db } = requireFirebase()
  const user = await ensureCustomerUser()
  const ref = await addDoc(collection(db, 'requests'), {
    customerId: user.uid,
    query: parsed.query,
    location: parsed.location,
    budget: parsed.budget ?? null,
    urgency: parsed.urgency,
    scheduledFor: parsed.scheduledFor ?? null,
    category: parsed.category,
    summary: parsed.summary,
    status: 'open',
    createdAt: serverTimestamp(),
  })
  return ref.id
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
  const { db } = requireFirebase()
  await updateDoc(doc(db, 'providers', uid), { availableNow, updatedAt: serverTimestamp() })
}

export function watchOpenRequests(callback: (items: ServiceRequest[]) => void): () => undefined {
  const { db } = requireFirebase()
  const q = query(collection(db, 'requests'), where('status', '==', 'open'), orderBy('createdAt', 'desc'))
  const stop = onSnapshot(q, (snapshot) => callback(snapshot.docs.map(requestFromDoc)))
  return () => { stop(); return undefined }
}

export function matchingRequests(profile: ProviderProfile, requests: ServiceRequest[]) {
  const categories = new Set(profile.categories.map((item) => item.toLowerCase()))
  const areas = profile.areas.map((item) => item.toLowerCase())
  return requests.filter((request) => {
    const categoryMatch = categories.has(request.category.toLowerCase()) || categories.has('local services')
    const location = request.location.toLowerCase()
    const areaMatch = areas.length === 0 || areas.some((area) => location.includes(area) || area.includes(location))
    return categoryMatch && areaMatch
  })
}

export async function submitQuote(input: {
  requestId: string
  provider: ProviderProfile
  amount: number
  etaMinutes?: number
  message?: string
}) {
  const { db } = requireFirebase()
  if (!input.provider.approved) throw new Error('Your provider account must be approved before quoting.')
  if (input.amount <= 0) throw new Error('Enter a valid quote amount.')
  await addDoc(collection(db, 'quotes'), {
    requestId: input.requestId,
    providerId: input.provider.id,
    providerName: input.provider.businessName,
    amount: input.amount,
    etaMinutes: input.etaMinutes ?? null,
    message: input.message?.trim() || null,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

export function watchMyProviderQuotes(providerId: string, callback: (items: Quote[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'quotes'), where('providerId', '==', providerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(quoteFromDoc)))
}

export async function acceptQuote(request: ServiceRequest, quote: Quote) {
  const { auth, db } = requireFirebase()
  const user = auth.currentUser
  if (!user || user.uid !== request.customerId) throw new Error('Only the customer who created this request can accept a quote.')
  if (request.status !== 'open') throw new Error('This request is no longer open.')
  if (quote.requestId !== request.id) throw new Error('Quote does not belong to this request.')

  const bookingRef = doc(collection(db, 'bookings'))
  const batch = writeBatch(db)
  batch.update(doc(db, 'requests', request.id), {
    status: 'booked',
    acceptedQuoteId: quote.id,
    bookedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'quotes', quote.id), { status: 'accepted' })
  batch.set(bookingRef, {
    requestId: request.id,
    customerId: request.customerId,
    providerId: quote.providerId,
    providerName: quote.providerName,
    quoteId: quote.id,
    amount: quote.amount,
    status: 'booked',
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return bookingRef.id
}

export async function cancelRequest(request: ServiceRequest) {
  const { auth, db } = requireFirebase()
  const user = auth.currentUser
  if (!user || user.uid !== request.customerId) throw new Error('You cannot cancel this request.')
  if (request.status !== 'open') throw new Error('Only open requests can be cancelled.')
  await updateDoc(doc(db, 'requests', request.id), { status: 'cancelled', cancelledAt: serverTimestamp() })
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
  const { db } = requireFirebase()
  await updateDoc(doc(db, 'bookings', bookingId), { status, updatedAt: serverTimestamp() })
}
