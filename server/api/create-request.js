import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { providerCoversLocation, resolveUaeLocation } from './_locations.js'
import { notifyUser } from './_notify.js'
import { classifyServiceRequest, rankProvidersForRequest } from './_requestIntelligence.js'
import { sendProviderRequestAlert } from './_whatsapp.js'
import { dispatchExternalBatch } from './_externalDispatch.js'

const LIVE_LOCATION_MAX_AGE_MS = 10 * 60 * 1000
const INITIAL_RADIUS_KM = 12
function cleanText(value, max = 500) { return String(value || '').trim().slice(0, max) }
function normalizePhone(value) { const digits = String(value || '').replace(/\D/g, ''); if (digits.length < 8 || digits.length > 15) return ''; return digits }
function timestampMillis(value) { if (!value) return 0; if (typeof value.toMillis === 'function') return value.toMillis(); if (typeof value._seconds === 'number') return value._seconds * 1000; return 0 }
function freshProviderLocation(provider) { const lat=Number(provider.currentLat), lng=Number(provider.currentLng), age=Date.now()-timestampMillis(provider.lastLocationAt); return provider.locationSharingEnabled && Number.isFinite(lat) && Number.isFinite(lng) && age >= 0 && age <= LIVE_LOCATION_MAX_AGE_MS ? { latitude:lat, longitude:lng } : null }
function distanceKm(a,b){const rad=(x)=>x*Math.PI/180;const dLat=rad(b.latitude-a.latitude),dLng=rad(b.longitude-a.longitude);const s=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s))}
function matchesProvider(provider, request, locationData) { if (!provider.approved) return false; if (request.urgency === 'now' && !provider.availableNow) return false; const categories=Array.isArray(provider.categories)?provider.categories.map((item)=>String(item).toLowerCase()):[]; const category=request.category.toLowerCase(); if(!categories.includes(category)&&!categories.includes('local services'))return false; return providerCoversLocation(provider.areas,request.location,locationData) }

export default async function handler(req,res){
  if(req.method!=='POST')return methodNotAllowed(res)
  try{
    const user=await requireUser(req)
    const contactPhone=normalizePhone(req.body?.contactPhone)
    const shareContactConsent=req.body?.shareContactConsent===true
    if(!contactPhone)return res.status(400).json({error:'Enter a valid WhatsApp or mobile number in international format.'})
    if(!shareContactConsent)return res.status(400).json({error:'You must allow Asanib to share your contact number with a matched business.'})
    const baseRequest={query:cleanText(req.body?.query,700),location:cleanText(req.body?.location,160),budget:req.body?.budget==null?null:Number(req.body.budget),urgency:cleanText(req.body?.urgency,20),scheduledFor:req.body?.scheduledFor?cleanText(req.body.scheduledFor,80):null}
    if(baseRequest.query.length<8||baseRequest.location.length<2)return res.status(400).json({error:'Describe the job and area.'})
    if(!['now','today','scheduled'].includes(baseRequest.urgency))return res.status(400).json({error:'Invalid urgency.'})
    if(baseRequest.urgency==='scheduled'&&!baseRequest.scheduledFor)return res.status(400).json({error:'Choose a scheduled time.'})
    if(baseRequest.budget!=null&&(!Number.isFinite(baseRequest.budget)||baseRequest.budget<=0||baseRequest.budget>1000000))return res.status(400).json({error:'Invalid budget.'})
    const classification=await classifyServiceRequest(baseRequest)
    const request={...baseRequest,category:classification.category,summary:classification.summary,serviceTags:classification.serviceTags,routingSource:classification.source,routingConfidence:classification.confidence}
    const locationData=await resolveUaeLocation(request.location)
    const providersSnapshot=await adminDb.collection('providers').where('approved','==',true).get()
    let eligibleProviders=providersSnapshot.docs.map((doc)=>({id:doc.id,...doc.data()})).filter((provider)=>matchesProvider(provider,request,locationData)).slice(0,100)
    const requestPoint=Number.isFinite(Number(locationData?.latitude))&&Number.isFinite(Number(locationData?.longitude))?{latitude:Number(locationData.latitude),longitude:Number(locationData.longitude)}:null
    if(request.urgency==='now'&&requestPoint){
      eligibleProviders=eligibleProviders.map((provider)=>{const point=freshProviderLocation(provider);return {...provider,dispatchDistanceKm:point?distanceKm(requestPoint,point):null,hasFreshLiveLocation:Boolean(point)}}).sort((a,b)=>{if(a.hasFreshLiveLocation!==b.hasFreshLiveLocation)return a.hasFreshLiveLocation?-1:1;return (a.dispatchDistanceKm??9999)-(b.dispatchDistanceKm??9999)})
      const nearby=eligibleProviders.filter((provider)=>provider.hasFreshLiveLocation&&provider.dispatchDistanceKm<=INITIAL_RADIUS_KM)
      if(nearby.length)eligibleProviders=[...nearby,...eligibleProviders.filter((provider)=>!nearby.some((near)=>near.id===provider.id))]
    }
    const providers=await rankProvidersForRequest(request,eligibleProviders)
    const requestRef=adminDb.collection('requests').doc();const batch=adminDb.batch()
    batch.set(requestRef,{...request,locationData,customerId:user.uid,contactPhone,shareContactConsent:true,status:'open',matchCount:providers.length,externalMatchStatus:'needs_match',externalAutoDispatch:true,nextExternalDispatchAt:new Date(),dispatchMode:request.urgency==='now'?'proximity':'coverage',createdAt:FieldValue.serverTimestamp()})
    providers.forEach((provider,index)=>{const matchRef=adminDb.collection('providerMatches').doc(provider.id).collection('requests').doc(requestRef.id);batch.set(matchRef,{id:requestRef.id,requestId:requestRef.id,customerId:user.uid,...request,locationData,status:'open',routingRank:index+1,dispatchDistanceKm:provider.dispatchDistanceKm??null,matchedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()})})
    await batch.commit()
    await Promise.allSettled(providers.flatMap((provider)=>[notifyUser(provider.id,request.urgency==='now'?'Urgent job near you':'New matching Asanib request',`${request.category} in ${request.location}${request.budget?` · up to AED ${request.budget}`:''}`,'/provider'),sendProviderRequestAlert(provider,request,requestRef.id)]))

    let externalDispatch = null
    try {
      externalDispatch = await dispatchExternalBatch(requestRef.id, { force: true })
    } catch (error) {
      console.error('Automatic external dispatch failed:', error)
    }

    return res.status(201).json({id:requestRef.id,matchCount:providers.length,location:locationData,category:request.category,routingSource:request.routingSource,dispatchMode:request.urgency==='now'?'proximity':'coverage',externalDispatch})
  }catch(error){return sendError(res,error)}
}
