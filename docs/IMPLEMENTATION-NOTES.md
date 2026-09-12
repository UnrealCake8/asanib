# Implementation notes

## External provider checkout

Provider checkout links are validated server-side and must use HTTPS. Localhost and private-network destinations are rejected. New or changed checkout links enter `pending_review`; only `approved` links are copied onto a quote. The checkout URL is then snapshotted again onto the accepted booking so later provider profile changes cannot silently alter an already accepted customer's payment destination.

## Business verification

Provider approval is now tied to a lightweight Asanib KYB workflow. The provider supplies business and trade-licence details and uploads a PDF/image to private Firebase Storage. A successful admin verification sets `kybStatus=verified` and `approved=true`, which preserves the existing server-side quote protection.

## Location matching

Requests are geocoded server-side when Google Maps Platform is configured. Matching compares the provider's service-area strings with structured request area/city/emirate data. The text fallback remains available if the API is temporarily unavailable or the key has not yet been configured.

## Mobile PWA

The customer and provider experiences now have dedicated mobile app shells and bottom navigation rather than simply compressing desktop navigation. The goal is one consistent Asanib journey across different service categories, while keeping the request -> quote -> booking flow the same.
