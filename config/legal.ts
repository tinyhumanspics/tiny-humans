/**
 * Privacy Policy and Terms of Service text.
 * Written as a sensible starting point for a small photography business in
 * Florida. Have it reviewed before launch, and update the "lastUpdated"
 * date whenever you change it.
 */

export type LegalBlock = string | { list: string[] };

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

const contactLine =
  "Questions? Email us at hello@tinyhumans.photography, or message us on Instagram at @tinyhumans.photography.";

/** Fills "{notice}" ("48 hours", from /admin) and "{phone}" in a document's text. */
export function fillLegal(doc: LegalDocument, values: Record<string, string>): LegalDocument {
  const f = (t: string) => t.replace(/\{(\w+)\}/g, (all, k: string) => values[k] ?? all);
  return JSON.parse(JSON.stringify(doc), (_k, v) => (typeof v === "string" ? f(v) : v));
}

export const privacyPolicy: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: "October 7, 2026",
  intro:
    "Tiny Humans is a newborn and baby photography studio in Miami, Florida that comes to you. This policy explains what information we collect when you visit our website or book a session, how we use it, and the choices you have. We keep it simple: we only collect what we need to take care of your family's session.",
  sections: [
    {
      heading: "Information we collect",
      body: [
        "When you book a session, you give us:",
        {
          list: [
            "The parent or guardian's name, email address and phone number",
            "Your baby's name (optional) and age",
            "The package, date and time you choose",
            "The home address where we'll set up for your session",
            "Any notes or special requests you share",
            "The portfolio photo you picked as inspiration, if any",
          ],
        },
        "We also note how you found us: the ad, link or website that brought you to our site (for example the campaign name in an ad link) and the first page you visited.",
        "During your session we take photographs of your baby and, depending on your package, your family.",
        "Like most websites, our hosting provider automatically records basic technical information when you visit, such as your browser type, the pages you view and your IP address. We also use advertising measurement tools from Meta (see \"Advertising and measurement\" below).",
      ],
    },
    {
      heading: "How we use your information",
      body: [
        {
          list: [
            "To schedule, prepare for and travel to your session at your home",
            "To contact you about your booking, including reminders and any changes",
            "To edit and deliver your photos through your online gallery",
            "To keep business records we're required to keep",
            "To keep our website working and secure, including limiting repeated requests from the same connection",
            "To understand which ads and links bring families to us, and to measure and improve our ads on Facebook and Instagram",
          ],
        },
        "We never sell or rent your information.",
      ],
    },
    {
      heading: "Photos of your family",
      body: [
        "Your photos belong in your family's memories first. We will only show photos from your session in our portfolio, on this website or on social media (such as Instagram) if you give us permission. You can change your mind at any time, and we'll stop using them for anything new.",
      ],
    },
    {
      heading: "Advertising and measurement (Meta)",
      body: [
        "We advertise on Facebook and Instagram. To measure how our ads work, we use the Meta Pixel on our website and the Meta Conversions API from our server, both provided by Meta Platforms, Inc.",
        {
          list: [
            "When you visit our website, the Meta Pixel may collect the pages you view, actions such as choosing a bundle or starting and completing a booking, and technical information such as your IP address and browser. It uses cookies (see below).",
            "When you complete a booking, we send Meta a booking event with the bundle and price, together with your email address, phone number, name, city, state and ZIP code in hashed (scrambled) form, plus your IP address and browser details, so Meta can match the booking to an ad and show our ads to people more likely to be interested.",
            "We never send your baby's name, age, notes or photos to Meta or any other advertising service.",
          ],
        },
        "Meta uses this information as described in its Privacy Policy (facebook.com/privacy/policy). You can control the ads you see in your Facebook and Instagram ad settings (facebook.com/adpreferences), and you can block or delete cookies in your browser settings.",
      ],
    },
    {
      heading: "Who we share information with",
      body: [
        "We share information only with trusted services that help us run Tiny Humans, and only what they need to do their job:",
        {
          list: [
            "Website hosting and storage (Vercel)",
            "Our booking database (Neon)",
            "Our calendar (Microsoft 365 / Outlook)",
            "Our email delivery service (Resend)",
            "Our payment processor (Stripe), which takes your card payment on its own secure page. We share your email address, bundle, amount due and booking reference with Stripe; we never see or store your card number",
            "A security service that limits repeated requests to our website (Upstash), which briefly processes IP addresses",
            "Meta Platforms, for advertising measurement as described above",
            "The online gallery service we use to deliver your photos",
          ],
        },
        "We may also share information if the law requires it, or to protect the safety of our clients, our team or others.",
      ],
    },
    {
      heading: "Cookies and browser storage",
      body: [
        "Our website uses these cookies:",
        {
          list: [
            "Meta advertising cookies (_fbp and _fbc), set by the Meta Pixel to measure our ads, kept for up to 90 days",
            "Our own cookies (th_src and th_fbc) that remember how you found our website, kept for 90 days",
            "A sign-in cookie, used only for the private owner area of the site",
          ],
        },
        "Our website may also store small settings in your browser so pages work smoothly. You can block or delete cookies in your browser settings; the website and booking will still work.",
      ],
    },
    {
      heading: "Children's privacy",
      body: [
        "Our website is meant for parents and guardians aged 18 or older. We collect information about babies and children only from their parent or guardian, and only to provide the photography session they've booked. We never share information about your baby or child with advertising or analytics services.",
      ],
    },
    {
      heading: "How long we keep information",
      body: [
        "We keep booking information for as long as we need it to provide your session and to meet our legal and accounting obligations. We keep your session photos on file for a limited time after delivery, so we can help if you lose access to your gallery. You can ask us to delete your photos or information sooner at any time.",
      ],
    },
    {
      heading: "Keeping your information safe",
      body: [
        "We use reasonable safeguards to protect your information, including secure connections on our website. No method of storing or sending information online is completely secure, but we work hard to protect yours.",
      ],
    },
    {
      heading: "Your choices",
      body: [
        "You can ask us to show you the information we have about you, correct it, or delete it. You can also ask us to stop sending you messages that aren't about an upcoming session. Just contact us and we'll take care of it.",
      ],
    },
    {
      heading: "Changes to this policy",
      body: ["If we update this policy, we'll post the new version here and change the date at the top."],
    },
    { heading: "Contact us", body: [contactLine] },
  ],
};

export const termsOfService: LegalDocument = {
  title: "Terms of Service",
  lastUpdated: "October 6, 2026",
  intro:
    "These terms explain how booking and sessions work with Tiny Humans, a newborn and baby photography studio in Miami, Florida. By using our website or booking a session, you agree to them. If anything is unclear, please ask before you book.",
  sections: [
    {
      heading: "Booking a session",
      body: [
        "You can book a session through our website. You'll receive a confirmation with your booking details. Nothing is paid at booking: payment for your bundle is due once your photoshoot is completed.",
        "The person booking must be the baby's parent or legal guardian and at least 18 years old.",
      ],
    },
    {
      heading: "Packages and prices",
      body: [
        "Packages and prices are listed on our website. Once your booking is confirmed, your price won't change, even if our prices change later. Each package includes the session length, setups and number of edited digital photos described at the time you book.",
      ],
    },
    {
      heading: "Baby-led sessions",
      body: [
        "Our sessions are baby-led. Time is allowed for feeding, changing and comforting your little one whenever needed. Your baby's safety and comfort always come first: we never force a pose, and a parent or guardian must stay present for the whole session.",
      ],
    },
    {
      heading: "Rescheduling and cancellations",
      body: [
        "Babies keep their own schedules, and we understand. If your baby or anyone in your family is unwell, please let us know and we'll find a new date.",
        "You're free to reschedule or cancel online, using the links in your confirmation email, up to {notice} before your session. Inside {notice}, just text us at {phone} and we'll help.",
        "If you need to cancel or reschedule, please tell us as early as possible, so we can offer the time to another family. If you miss a session without telling us, we may ask for a deposit to rebook.",
        "If we ever need to cancel because of illness or an emergency, we'll find a new date with you at no cost.",
      ],
    },
    {
      heading: "We bring the studio to you",
      body: [
        "Every session takes place at your home, so your little one can stay comfortable. We bring the lights, backdrops and props. Please provide a warm, safe space with room for our setup, ideally near a window, and let us know in advance about pets, parking or anything else we should be aware of.",
      ],
    },
    {
      heading: "Your photos",
      body: [
        "We carefully choose and edit your photos and deliver them through a private online gallery. The number of edited photos depends on your package. Editing style is part of our artistic work, and we don't provide unedited or raw files.",
      ],
    },
    {
      heading: "Copyright and how you can use your photos",
      body: [
        "Tiny Humans keeps the copyright to the photos. You receive a personal license to use them, which means you can:",
        {
          list: [
            "Print them for yourself and your family",
            "Share them with friends and family, including on your personal social media (a tag is always appreciated)",
          ],
        },
        "Please don't sell the photos, use them for commercial purposes, or add filters or edits and present them as our work without asking us first.",
      ],
    },
    {
      heading: "Showing your photos",
      body: [
        "We only show photos from your session in our portfolio, website or social media with your permission. See our Privacy Policy for details.",
      ],
    },
    {
      heading: "Our responsibility",
      body: [
        "We take great care of every session and every file. In the unlikely event that we can't deliver your photos because of something within our control, such as equipment failure, our responsibility is limited to refunding what you paid for that session. We aren't responsible for indirect losses.",
      ],
    },
    {
      heading: "Using our website",
      body: [
        "The photos, drawings and text on this website belong to Tiny Humans. Please don't copy or reuse them without permission.",
      ],
    },
    {
      heading: "Governing law",
      body: ["These terms are governed by the laws of the State of Florida."],
    },
    {
      heading: "Changes to these terms",
      body: [
        "We may update these terms from time to time. The version on our website when you book is the one that applies to your session.",
      ],
    },
    { heading: "Contact us", body: [contactLine] },
  ],
};
