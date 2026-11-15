import JsvWordmark from './JsvWordmark'

type LegalKind = 'privacy' | 'terms' | 'cookies' | 'refunds'

const updated = '15 November 2026'

const sections: Record<LegalKind, { title: string; intro: string; blocks: { heading: string; body: string[] }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This Privacy Policy explains how JSV Market collects, uses and protects information when customers and service providers use the platform.',
    blocks: [
      { heading: '1. Who operates JSV Market', body: ['JSV Market is operated by JS Ventures LLC in the United Arab Emirates. References to “JSV Market”, “we”, “us” or “our” in this policy refer to the JSV Market service operated by JS Ventures LLC.'] },
      { heading: '2. Information we collect', body: ['We may collect account information such as email address, business name and contact details; service-request information such as the job description, area, budget and timing; provider information such as service categories, service areas, availability, phone and WhatsApp number; booking, quote and review information; and provider-verification information such as legal business name, licence number, licensing authority, expiry date, authorised representative details, a trade-licence document, and front and back images or files of the authorised representative’s Emirates ID.', 'Customers should avoid putting unnecessary sensitive personal information in service-request descriptions.'] },
      { heading: '3. Location information', body: ['JSV Market may use Google Maps Platform services to help users select and standardise service locations. A selected place may be represented using details such as a place identifier, neighbourhood or area, city or emirate, and geographic coordinates. This is used to improve provider matching and location accuracy.'] },
      { heading: '4. Business verification documents', body: ['Provider trade-licence and Emirates ID verification files are stored in private object storage and are not published to customers or other providers. Access is limited to the provider for upload and authorised JSV Market administrators for verification, fraud prevention and support purposes. Administrative access uses short-lived secure links rather than public document URLs.', 'Emirates ID documents are collected for provider identity and authority verification. They should not be uploaded anywhere else in JSV Market. We may retain verification records for account integrity, dispute handling, fraud prevention and legal or operational recordkeeping, and we will limit retention where those records are no longer reasonably required.'] },
      { heading: '5. Payments', body: ['Where JSV Market Checkout is offered, Network International hosts the payment page and processes card information. JSV Market does not receive or store full card details. We retain the order reference, payment status, amount and booking records needed to confirm the transaction and provide support.', 'A business may instead offer an approved external checkout link. Payments made there are handled by that business or its payment provider under their own terms and privacy practices.'] },
      { heading: '6. How we use information', body: ['We use information to operate accounts, match customer requests with relevant providers, allow providers to quote, manage bookings, verify provider businesses and authorised representatives, facilitate available payment options, deliver service notifications, prevent abuse, provide support and improve the reliability of JSV Market.', 'Where a provider has supplied a WhatsApp number for job alerts, JSV Market may use that number to send service-related notifications from a JSV Market-operated WhatsApp channel once that notification channel is enabled.'] },
      { heading: '7. Sharing', body: ['Customer request details are shared only as reasonably necessary with relevant provider accounts so they can decide whether to quote. Provider details may be shown to customers when needed to compare quotes or complete a booking. Emirates ID verification documents are not shared with customers or unrelated providers.', 'We may use infrastructure and service providers such as Firebase, Vercel, Cloudflare, Google Maps Platform and Network International to operate the platform. They process relevant data in accordance with their own terms and our configuration.'] },
      { heading: '8. Data retention and security', body: ['We retain information for as long as reasonably necessary to operate the service, maintain records, resolve disputes and meet legal obligations. Verification documents are kept in private storage with access controls. We use reasonable technical and organisational measures to protect information, but no online system can guarantee absolute security.'] },
      { heading: '9. Your choices', body: ['You may stop using JSV Market at any time. Providers can update their business profile and availability. You may contact us to request access, correction or deletion of eligible personal information, including verification information where deletion is legally and operationally permitted.'] },
      { heading: '10. Contact', body: ['Privacy and support requests relating to JSV Market should be directed to JS Ventures LLC through the contact details published in the JSV Market service.'] },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'These Terms & Conditions govern access to and use of JSV Market by customers, service providers and other users.',
    blocks: [
      { heading: '1. Operator and platform role', body: ['JSV Market is operated by JS Ventures LLC in the United Arab Emirates. JSV Market is a technology platform that helps customers describe a service need, receive responses from eligible providers and manage a booking.', 'Unless expressly stated otherwise for a specific service, the service provider is responsible for performing the underlying service. JSV Market does not become the provider of a third-party service merely by facilitating a request, quote, booking or payment interface.'] },
      { heading: '2. Accounts and eligibility', body: ['Users must provide accurate information and keep account credentials secure. Provider accounts may require business and representative identity verification before they can receive or quote on customer requests. JSV Market may refuse, suspend or remove accounts where reasonably necessary for safety, misuse, fraud, legal compliance or platform integrity.'] },
      { heading: '3. Customer requests', body: ['Customers must describe requests accurately and lawfully. Requests must not seek illegal, unsafe or prohibited goods or services. Customers remain responsible for checking whether a provider and proposed service are suitable for their needs.'] },
      { heading: '4. Provider responsibilities', body: ['Providers are responsible for maintaining accurate business information, qualifications, licences, insurance and permits where applicable. Providers must only submit verification documents they are authorised to provide. Quotes should clearly reflect the expected price and scope. Providers are responsible for the quality, legality and safe delivery of their services.'] },
      { heading: '5. Quotes, bookings and payment', body: ['A quote is an offer from a business. A booking is formed when the customer accepts a quote through JSV Market.', 'Where JSV Market Checkout is offered, Network International hosts and processes the payment for JS Ventures LLC. JSV Market records the result against the booking, while settlement with the business is handled separately.', 'A business may also offer an approved external checkout destination. Customers choosing it leave JSV Market and pay that business or its selected payment provider.'] },
      { heading: '6. Cancellations, disputes and refunds', body: ['Refund responsibility depends on the payment method and the circumstances of the service. Where payment was made through JSV Market Checkout, JS Ventures LLC may process an eligible refund or reversal through Network International, subject to the booking circumstances, provider position, applicable law and processor rules. Where payment was made directly to a provider, the provider is normally responsible for any refund due.', 'JSV Market may assist with platform records or communications, but this does not guarantee a particular dispute outcome.'] },
      { heading: '7. Communications', body: ['Users may receive transactional communications needed to operate the service, including request, quote, booking, payment and account notifications. Providers that supply a WhatsApp number may receive operational job alerts from a JSV Market-operated WhatsApp channel if and when that feature is enabled.'] },
      { heading: '8. Acceptable use', body: ['Do not interfere with the platform, impersonate others, submit fraudulent requests or quotes, misuse contact information, scrape protected data, circumvent security controls or use JSV Market to facilitate unlawful activity.'] },
      { heading: '9. Availability and liability', body: ['We aim to keep JSV Market reliable but do not guarantee uninterrupted availability or that every request will receive a quote. To the extent permitted by applicable law, JS Ventures LLC is not responsible for losses caused by the independent acts or omissions of third-party providers. Nothing in these terms excludes rights or liabilities that cannot legally be excluded.'] },
      { heading: '10. Changes', body: ['We may update these terms as JSV Market evolves. The updated date will be shown on this page. Continued use after an update may constitute acceptance where permitted by law.'] },
    ],
  },
  cookies: {
    title: 'Cookie & Storage Policy',
    intro: 'This policy explains how JSV Market uses cookies, local storage and similar browser technologies.',
    blocks: [
      { heading: '1. Essential storage', body: ['JSV Market uses essential browser and authentication storage to keep users signed in, maintain sessions, secure requests and support core app functionality. Firebase Authentication and related infrastructure may store identifiers needed for these purposes.'] },
      { heading: '2. Notifications and app functionality', body: ['If you enable browser or PWA notifications, JSV Market may store a notification registration identifier so service-related alerts can be delivered to your device. Service-worker and PWA storage may also be used to make the app load and function reliably.'] },
      { heading: '3. Analytics and advertising', body: ['JSV Market does not currently state that it uses optional behavioural advertising or cross-site tracking. If optional analytics, advertising or other non-essential tracking is introduced, this policy and any consent controls will be updated as appropriate.'] },
      { heading: '4. Managing storage', body: ['You can clear browser storage, sign out or change browser permissions. Blocking essential storage may prevent authentication, notifications or other parts of JSV Market from working correctly.'] },
    ],
  },
  refunds: {
    title: 'Refund & Cancellation Policy',
    intro: 'This policy explains how cancellations and refunds work for services arranged through JSV Market.',
    blocks: [
      { heading: '1. Payment methods', body: ['Customers may use JSV Market Checkout processed by Network International where available, an approved external provider checkout, or another payment method agreed directly with the provider.'] },
      { heading: '2. Refunds for provider service payments', body: ['The provider remains responsible for the underlying service. If the customer paid through JSV Market Checkout, JS Ventures LLC may process an eligible refund or reversal through Network International. If the customer paid the provider directly, the provider is normally responsible for any refund due.'] },
      { heading: '3. Cancelling a JSV Market request', body: ['An open request may be cancelled in the app before a quote is accepted. Once cancelled, pending quotes are closed and matched businesses may see that the customer cancelled the request. Once a quote has been accepted and a booking created, cancellation may affect the business’s time or costs and should be handled promptly with that business.'] },
      { heading: '4. JSV Market Checkout', body: ['Network International hosts the JSV Market payment page and processes card information. Provider settlement is handled separately from the customer payment flow. Refunds or reversals depend on the booking circumstances, provider position, Network International’s available payment features and applicable law.'] },
      { heading: '5. Disputes', body: ['If there is a disagreement about a booked service, users should first try to resolve it directly and promptly. JSV Market may review platform records and assist with communications where appropriate, but does not guarantee a refund or specific outcome.'] },
    ],
  },
}

export function LegalFooter() {
  return <footer className="legal-footer"><div><JsvWordmark /><p>Operated by <strong>JS Ventures LLC</strong> in the United Arab Emirates.</p></div><nav><a href="/privacy">Privacy</a><a href="/terms">Terms & Conditions</a><a href="/cookies">Cookie Policy</a><a href="/refunds">Refund Policy</a><a href="/provider">For providers</a></nav></footer>
}

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const page = sections[kind]
  return <main className="legal-shell">
    <header className="legal-topbar"><JsvWordmark /><a href="/">Back to JSV Market</a></header>
    <article className="legal-document">
      <div className="legal-heading"><span>LEGAL · UPDATED {updated.toUpperCase()}</span><h1>{page.title}</h1><p>{page.intro}</p><div className="operator-note">JSV Market is operated by <strong>JS Ventures LLC</strong>.</div></div>
      {page.blocks.map((block) => <section key={block.heading}><h2>{block.heading}</h2>{block.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
    </article>
    <LegalFooter />
  </main>
}
