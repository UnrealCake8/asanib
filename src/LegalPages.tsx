type LegalKind = 'privacy' | 'terms' | 'cookies' | 'refunds'

const updated = '12 September 2026'

const sections: Record<LegalKind, { title: string; intro: string; blocks: { heading: string; body: string[] }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This Privacy Policy explains how Asanib collects, uses and protects information when customers and service providers use the platform.',
    blocks: [
      { heading: '1. Who operates Asanib', body: ['Asanib is operated by JS Ventures LLC in the United Arab Emirates. References to “Asanib”, “we”, “us” or “our” in this policy refer to the Asanib service operated by JS Ventures LLC.'] },
      { heading: '2. Information we collect', body: ['We may collect account information such as email address, business name and contact details; service-request information such as the job description, area, budget and timing; location information used to understand the requested service area; provider information such as service categories, service areas, availability, phone and WhatsApp number; booking, quote and review information; and technical information needed to secure and operate the service.', 'For business verification, providers may submit information including legal business name, trade licence number, licensing authority, licence expiry date, authorised representative details and a copy of the trade licence. Customers should avoid putting unnecessary sensitive personal information in service-request descriptions.'] },
      { heading: '3. Location services', body: ['Asanib may use Google Maps Platform services to provide UAE location suggestions and to interpret a neighbourhood, city or emirate so requests can be matched with businesses that cover the wider service area. Location searches may therefore be processed by Google in accordance with its applicable terms and privacy practices.', 'Asanib may store a formatted location, place identifier and geographic coordinates or area components when needed for matching and platform functionality.'] },
      { heading: '4. How we use information', body: ['We use information to operate accounts, verify provider businesses, match customer requests with relevant providers, allow providers to quote, manage bookings, review provider checkout destinations, deliver service notifications, prevent abuse, provide support and improve the reliability of Asanib.', 'Where a provider has supplied a WhatsApp number for job alerts, Asanib may use that number to send service-related notifications from an Asanib-operated WhatsApp channel once that notification channel is enabled.'] },
      { heading: '5. Sharing', body: ['Customer request details are shared only as reasonably necessary with relevant provider accounts so they can decide whether to quote. Provider details may be shown to customers when needed to compare quotes or complete a booking.', 'We may use infrastructure and service providers such as Firebase, Vercel, Cloudflare and Google Maps Platform to operate the platform. They process technical or service data in accordance with their own terms and our configuration. Business-verification documents are intended for Asanib review and are not published as part of the provider’s public profile.'] },
      { heading: '6. Data retention and security', body: ['We retain information for as long as reasonably necessary to operate the service, maintain records, perform provider verification, resolve disputes and meet legal obligations. We use reasonable technical and organisational measures to protect information, but no online system can guarantee absolute security.'] },
      { heading: '7. Your choices', body: ['You may stop using Asanib at any time. Providers can update their business profile, availability and payment settings. Changes to verified business information or checkout destinations may require a new Asanib review. You may contact us to request access, correction or deletion of eligible personal information, subject to applicable legal and operational requirements.'] },
      { heading: '8. Contact', body: ['Privacy and support requests relating to Asanib should be directed to JS Ventures LLC through the contact details published in the Asanib service.'] },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'These Terms & Conditions govern access to and use of Asanib by customers, service providers and other users.',
    blocks: [
      { heading: '1. Operator and platform role', body: ['Asanib is operated by JS Ventures LLC in the United Arab Emirates. Asanib is a technology platform that helps customers describe a service need, receive responses from eligible providers and manage a booking.', 'Unless expressly stated otherwise for a specific service, the service provider is responsible for performing the underlying service. Asanib does not become the provider of a third-party service merely by facilitating a request, quote, booking or link to a provider’s payment system.'] },
      { heading: '2. Accounts and eligibility', body: ['Users must provide accurate information and keep account credentials secure. Provider accounts may require business verification before they can receive or quote on customer requests. Asanib may refuse, suspend or remove accounts where reasonably necessary for safety, misuse, fraud, legal compliance or platform integrity.'] },
      { heading: '3. Provider verification', body: ['Providers must submit accurate business information and must be authorised to act for the business they register. Asanib may review trade-licence information and other reasonable evidence before marking a business as verified.', 'An Asanib verification badge or approval means that Asanib reviewed the provider information requested by the platform. It is not a guarantee of service quality, future conduct, financial standing or the outcome of a customer transaction.'] },
      { heading: '4. Customer requests', body: ['Customers must describe requests accurately and lawfully. Requests must not seek illegal, unsafe or prohibited goods or services. Customers remain responsible for checking whether a provider and proposed service are suitable for their needs.'] },
      { heading: '5. Provider responsibilities', body: ['Providers are responsible for maintaining accurate business information, qualifications, licences, insurance and permits where applicable. Quotes should clearly reflect the expected price and scope. Providers are responsible for the quality, legality and safe delivery of their services.'] },
      { heading: '6. Quotes, bookings and payment', body: ['A quote is an offer from a provider. A booking is formed when the customer accepts a quote through Asanib. A provider may configure an approved external checkout link. If the customer chooses that option, Asanib redirects the customer to the provider or its payment processor and JS Ventures LLC does not collect that service payment.', 'If Asanib later offers an in-platform Asanib Checkout option, the payment processor, fees and applicable payment terms will be shown before payment. External provider checkout and Asanib Checkout are separate payment paths.', 'Any taxes, receipts, invoices or payment obligations relating to a provider’s service remain the responsibility of the relevant parties unless applicable law requires otherwise.'] },
      { heading: '7. Cancellations, disputes and refunds', body: ['Where a customer pays through a provider’s external checkout, refunds for those amounts are normally handled by the provider or its payment processor. See the Refund Policy for more detail.', 'Asanib may assist with platform records or communications, but this does not guarantee a particular dispute outcome.'] },
      { heading: '8. Third-party links and payment systems', body: ['Provider checkout links lead to third-party websites or payment systems controlled by the provider or its payment processor. Asanib may review a checkout destination before enabling it, but the provider remains responsible for its payment page, charges, receipts, refunds and compliance. Customers should check the displayed destination before continuing.'] },
      { heading: '9. Communications', body: ['Users may receive transactional communications needed to operate the service, including request, quote, booking and account notifications. Providers that supply a WhatsApp number may receive operational job alerts from an Asanib-operated WhatsApp channel if and when that feature is enabled.'] },
      { heading: '10. Acceptable use', body: ['Do not interfere with the platform, impersonate others, submit fraudulent requests or quotes, misuse contact information, submit deceptive payment links, scrape protected data, circumvent security controls or use Asanib to facilitate unlawful activity.'] },
      { heading: '11. Availability and liability', body: ['We aim to keep Asanib reliable but do not guarantee uninterrupted availability or that every request will receive a quote. To the extent permitted by applicable law, JS Ventures LLC is not responsible for losses caused by the independent acts or omissions of third-party providers. Nothing in these terms excludes rights or liabilities that cannot legally be excluded.'] },
      { heading: '12. Changes', body: ['We may update these terms as Asanib evolves. The updated date will be shown on this page. Continued use after an update may constitute acceptance where permitted by law.'] },
    ],
  },
  cookies: {
    title: 'Cookie & Storage Policy',
    intro: 'This policy explains how Asanib uses cookies, local storage and similar browser technologies.',
    blocks: [
      { heading: '1. Essential storage', body: ['Asanib uses essential browser and authentication storage to keep users signed in, maintain sessions, secure requests and support core app functionality. Firebase Authentication and related infrastructure may store identifiers needed for these purposes.'] },
      { heading: '2. Notifications and app functionality', body: ['If you enable browser or PWA notifications, Asanib may store a notification registration identifier so service-related alerts can be delivered to your device. Service-worker and PWA storage may also be used to make the app load and function reliably.'] },
      { heading: '3. Location search', body: ['When you actively type a service location, Asanib may send the entered location text to its configured location provider to return suggestions and understand the service area. This is core app functionality rather than cross-site advertising tracking.'] },
      { heading: '4. Analytics and advertising', body: ['Asanib does not currently state that it uses optional behavioural advertising or cross-site tracking. If optional analytics, advertising or other non-essential tracking is introduced, this policy and any consent controls will be updated as appropriate.'] },
      { heading: '5. Managing storage', body: ['You can clear browser storage, sign out or change browser permissions. Blocking essential storage may prevent authentication, notifications or other parts of Asanib from working correctly.'] },
    ],
  },
  refunds: {
    title: 'Refund & Cancellation Policy',
    intro: 'This policy explains how cancellations and refunds work for Asanib bookings and provider payment links.',
    blocks: [
      { heading: '1. Provider external checkout', body: ['A provider may offer its own external checkout link after a customer accepts a quote. When the customer chooses that option, the payment is made through the provider or its payment processor rather than collected by JS Ventures LLC.'] },
      { heading: '2. Refunds for provider payments', body: ['Because JS Ventures LLC does not hold payments made through a provider’s external checkout, Asanib generally cannot directly reverse or refund those payments. Any refund is subject to the provider’s terms, its payment processor, the agreement between the customer and provider, and applicable law.'] },
      { heading: '3. Cancelling an Asanib request', body: ['An open request may be cancelled in the app before a quote is accepted. Once a quote has been accepted and a booking created, cancellation may affect the provider’s time or costs and should be handled promptly with the provider.'] },
      { heading: '4. Asanib Checkout', body: ['If Asanib enables an in-platform checkout option powered by a payment processor, the applicable cancellation, refund and settlement terms will be presented and this policy will be updated as necessary before the feature is made generally available.'] },
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
