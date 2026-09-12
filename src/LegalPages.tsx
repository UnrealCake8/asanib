type LegalKind = 'privacy' | 'terms' | 'cookies' | 'refunds'

const updated = '12 September 2026'

const sections: Record<LegalKind, { title: string; intro: string; blocks: { heading: string; body: string[] }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This Privacy Policy explains how Asanib collects, uses and protects information when customers and service providers use the platform.',
    blocks: [
      { heading: '1. Who operates Asanib', body: ['Asanib is operated by JS Ventures LLC in the United Arab Emirates. References to “Asanib”, “we”, “us” or “our” in this policy refer to the Asanib service operated by JS Ventures LLC.'] },
      { heading: '2. Information we collect', body: ['We may collect account information such as email address, business name and contact details; service-request information such as the job description, area, budget and timing; provider information such as service categories, service areas, availability, phone and WhatsApp number; booking, quote and review information; provider-verification information such as legal business name, licence number, licensing authority, expiry date, authorised representative details and a trade-licence document; and technical information needed to secure and operate the service.', 'Customers should avoid putting unnecessary sensitive personal information in service-request descriptions.'] },
      { heading: '3. Location information', body: ['Asanib may use Google Maps Platform services to help users select and standardise service locations. A selected place may be represented using details such as a place identifier, neighbourhood or area, city or emirate, and geographic coordinates. This is used to improve provider matching and location accuracy.'] },
      { heading: '4. Business verification documents', body: ['Provider trade-licence files are stored in private object storage and are not published to customers. Access is limited to the provider for upload and authorised Asanib administrators for verification and support purposes. Asanib may retain verification records for account integrity, dispute handling and legal or operational recordkeeping.'] },
      { heading: '5. Payments', body: ['Where Asanib Checkout is available, the payment interface may be provided by Ziina. Payment-card details entered into the Ziina checkout are processed by Ziina and are not stored by Asanib. Asanib may retain payment references, status, amount and related booking records so the platform can confirm whether a booking has been paid.', 'Some providers may also offer an external checkout link. If you choose that option, you leave Asanib and the destination provider or payment processor handles the payment under its own terms and privacy practices.'] },
      { heading: '6. How we use information', body: ['We use information to operate accounts, match customer requests with relevant providers, allow providers to quote, manage bookings, verify provider businesses, facilitate available payment options, deliver service notifications, prevent abuse, provide support and improve the reliability of Asanib.', 'Where a provider has supplied a WhatsApp number for job alerts, Asanib may use that number to send service-related notifications from an Asanib-operated WhatsApp channel once that notification channel is enabled.'] },
      { heading: '7. Sharing', body: ['Customer request details are shared only as reasonably necessary with relevant provider accounts so they can decide whether to quote. Provider details may be shown to customers when needed to compare quotes or complete a booking.', 'We may use infrastructure and service providers such as Firebase, Vercel, Cloudflare, Google Maps Platform and Ziina to operate the platform. They process relevant data in accordance with their own terms and our configuration.'] },
      { heading: '8. Data retention and security', body: ['We retain information for as long as reasonably necessary to operate the service, maintain records, resolve disputes and meet legal obligations. We use reasonable technical and organisational measures to protect information, but no online system can guarantee absolute security.'] },
      { heading: '9. Your choices', body: ['You may stop using Asanib at any time. Providers can update their business profile and availability. You may contact us to request access, correction or deletion of eligible personal information, subject to applicable legal and operational requirements.'] },
      { heading: '10. Contact', body: ['Privacy and support requests relating to Asanib should be directed to JS Ventures LLC through the contact details published in the Asanib service.'] },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'These Terms & Conditions govern access to and use of Asanib by customers, service providers and other users.',
    blocks: [
      { heading: '1. Operator and platform role', body: ['Asanib is operated by JS Ventures LLC in the United Arab Emirates. Asanib is a technology platform that helps customers describe a service need, receive responses from eligible providers and manage a booking.', 'Unless expressly stated otherwise for a specific service, the service provider is responsible for performing the underlying service. Asanib does not become the provider of a third-party service merely by facilitating a request, quote, booking or payment interface.'] },
      { heading: '2. Accounts and eligibility', body: ['Users must provide accurate information and keep account credentials secure. Provider accounts may require business verification before they can receive or quote on customer requests. Asanib may refuse, suspend or remove accounts where reasonably necessary for safety, misuse, fraud, legal compliance or platform integrity.'] },
      { heading: '3. Customer requests', body: ['Customers must describe requests accurately and lawfully. Requests must not seek illegal, unsafe or prohibited goods or services. Customers remain responsible for checking whether a provider and proposed service are suitable for their needs.'] },
      { heading: '4. Provider responsibilities', body: ['Providers are responsible for maintaining accurate business information, qualifications, licences, insurance and permits where applicable. Quotes should clearly reflect the expected price and scope. Providers are responsible for the quality, legality and safe delivery of their services.'] },
      { heading: '5. Quotes, bookings and payment', body: ['A quote is an offer from a provider. A booking is formed when the customer accepts a quote through Asanib.', 'Where Asanib Checkout is available, Ziina may provide an embedded payment interface inside Asanib. The connected provider’s Ziina Business account receives the service payment; JS Ventures LLC does not hold that underlying provider service payment in this flow. Asanib may record the payment status and reference against the booking.', 'A provider may also offer an approved external checkout destination. Customers choosing an external checkout leave Asanib and pay through the provider or its selected payment processor.'] },
      { heading: '6. Cancellations, disputes and refunds', body: ['Refund responsibility depends on the payment method and the provider’s service terms. Where a payment is made to the provider through Ziina or another provider payment method, the provider remains responsible for the underlying service and any refund due, subject to applicable law.', 'Asanib may assist with platform records or communications, but this does not guarantee a particular dispute outcome.'] },
      { heading: '7. Communications', body: ['Users may receive transactional communications needed to operate the service, including request, quote, booking, payment and account notifications. Providers that supply a WhatsApp number may receive operational job alerts from an Asanib-operated WhatsApp channel if and when that feature is enabled.'] },
      { heading: '8. Acceptable use', body: ['Do not interfere with the platform, impersonate others, submit fraudulent requests or quotes, misuse contact information, scrape protected data, circumvent security controls or use Asanib to facilitate unlawful activity.'] },
      { heading: '9. Availability and liability', body: ['We aim to keep Asanib reliable but do not guarantee uninterrupted availability or that every request will receive a quote. To the extent permitted by applicable law, JS Ventures LLC is not responsible for losses caused by the independent acts or omissions of third-party providers. Nothing in these terms excludes rights or liabilities that cannot legally be excluded.'] },
      { heading: '10. Changes', body: ['We may update these terms as Asanib evolves. The updated date will be shown on this page. Continued use after an update may constitute acceptance where permitted by law.'] },
    ],
  },
  cookies: {
    title: 'Cookie & Storage Policy',
    intro: 'This policy explains how Asanib uses cookies, local storage and similar browser technologies.',
    blocks: [
      { heading: '1. Essential storage', body: ['Asanib uses essential browser and authentication storage to keep users signed in, maintain sessions, secure requests and support core app functionality. Firebase Authentication and related infrastructure may store identifiers needed for these purposes.'] },
      { heading: '2. Notifications and app functionality', body: ['If you enable browser or PWA notifications, Asanib may store a notification registration identifier so service-related alerts can be delivered to your device. Service-worker and PWA storage may also be used to make the app load and function reliably.'] },
      { heading: '3. Analytics and advertising', body: ['Asanib does not currently state that it uses optional behavioural advertising or cross-site tracking. If optional analytics, advertising or other non-essential tracking is introduced, this policy and any consent controls will be updated as appropriate.'] },
      { heading: '4. Managing storage', body: ['You can clear browser storage, sign out or change browser permissions. Blocking essential storage may prevent authentication, notifications or other parts of Asanib from working correctly.'] },
    ],
  },
  refunds: {
    title: 'Refund & Cancellation Policy',
    intro: 'This policy explains how cancellations and refunds work for services arranged through Asanib.',
    blocks: [
      { heading: '1. Payment methods', body: ['Customers may pay a provider using Asanib Checkout powered by Ziina where available, an approved external provider checkout, or another payment method agreed directly with the provider.'] },
      { heading: '2. Refunds for provider service payments', body: ['The provider is responsible for the underlying service and for any refund that is due for that service, subject to applicable law and the agreement between the customer and provider. Asanib may provide booking and payment-status records to help the parties resolve a dispute.'] },
      { heading: '3. Cancelling an Asanib request', body: ['An open request may be cancelled in the app before a quote is accepted. Once a quote has been accepted and a booking created, cancellation may affect the provider’s time or costs and should be handled promptly with the provider.'] },
      { heading: '4. Asanib Checkout', body: ['Where a customer pays through Asanib Checkout, the payment interface is provided by Ziina and the service payment is received by the connected provider’s Ziina Business account. Any refund or reversal may depend on the provider, Ziina’s available payment features and applicable law.'] },
      { heading: '5. Disputes', body: ['If there is a disagreement about a booked service, users should first try to resolve it directly and promptly. Asanib may review platform records and assist with communications where appropriate, but does not guarantee a refund or specific outcome.'] },
    ],
  },
}

export function LegalFooter() {
  return <footer className="legal-footer"><div><a className="brand small-brand" href="/">asanib<span>.</span></a><p>Operated by <strong>JS Ventures LLC</strong> in the United Arab Emirates.</p></div><nav><a href="/privacy">Privacy</a><a href="/terms">Terms & Conditions</a><a href="/cookies">Cookie Policy</a><a href="/refunds">Refund Policy</a><a href="/provider">For providers</a></nav></footer>
}

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const page = sections[kind]
  return <main className="legal-shell">
    <header className="legal-topbar"><a className="brand" href="/">asanib<span>.</span></a><a href="/">Back to Asanib</a></header>
    <article className="legal-document">
      <div className="legal-heading"><span>LEGAL · UPDATED {updated.toUpperCase()}</span><h1>{page.title}</h1><p>{page.intro}</p><div className="operator-note">Asanib is operated by <strong>JS Ventures LLC</strong>.</div></div>
      {page.blocks.map((block) => <section key={block.heading}><h2>{block.heading}</h2>{block.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
      <div className="legal-disclaimer">These platform policies describe Asanib’s current operating model and are intended to be clear to users. They do not replace rights or obligations imposed by applicable law.</div>
    </article>
    <LegalFooter />
  </main>
}
