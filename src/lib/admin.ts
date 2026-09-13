import { collection, doc, onSnapshot, orderBy, query, updateDoc, type Unsubscribe } from 'firebase/firestore'
import { auth, db, firebaseConfigured } from './firebase'
import type { ExternalLeadDispatch, ExternalProvider, ProviderProfile, ServiceRequest } from '../types'

function requireFirebase() {
  if (!firebaseConfigured || !auth || !db) throw new Error('Firebase is not configured.')
  return { auth, db }
}

export function watchAdminAccess(uid: string, callback: (allowed: boolean) => void): Unsubscribe {
  const { db } = requireFirebase()
  return onSnapshot(doc(db, 'admins', uid), (snapshot) => callback(snapshot.exists()))
}

export function watchAllProviders(callback: (items: ProviderProfile[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'providers'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ProviderProfile, 'id'>) }))))
}

export function watchAllRequests(callback: (items: ServiceRequest[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ServiceRequest, 'id'>) }))))
}

export function watchExternalProviders(callback: (items: ExternalProvider[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'externalProviders'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ExternalProvider, 'id'>) })).filter((item) => !item.archived)))
}

export function watchExternalDispatches(callback: (items: ExternalLeadDispatch[]) => void): Unsubscribe {
  const { db } = requireFirebase()
  const q = query(collection(db, 'externalLeadDispatches'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ExternalLeadDispatch, 'id'>) })).slice(0, 100)))
}

export async function setProviderApproved(providerId: string, approved: boolean) {
  const { db } = requireFirebase()
  await updateDoc(doc(db, 'providers', providerId), { approved })
}
