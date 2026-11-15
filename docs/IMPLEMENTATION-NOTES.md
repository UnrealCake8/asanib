# JSV Market implementation notes

Provider approval uses a lightweight KYB workflow. Businesses submit legal and trade-licence details plus private verification documents. Administrative verification controls whether an account can quote.

Customers post one request with the job, location, timing and optional budget. Matching considers service category and area before businesses can reply.

Customer and provider experiences use dedicated responsive shells. The shared journey remains request → replies → quote acceptance → booking.

Approved external provider checkout links may be shown after booking. JSV Market platform checkout uses Network International’s hosted payment page and keeps card data outside the application. Webhooks require the configured `X-JSV-Market-Webhook-Token` header and are stored idempotently by event ID.
