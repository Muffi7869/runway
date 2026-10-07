import Link from "next/link";

export const metadata = {
  title: "Privacy Policy – Runway",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-6 py-12">
      <h1 className="text-3xl font-semibold">Privacy Policy – Runway</h1>

      <p>Runway is a personal app used by one person, its owner.</p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Calendar access</h2>
        <p>
          With permission, Runway reads events from the Google calendars the
          owner chooses. It creates and manages one calendar named
          &quot;Runway&quot;. It cannot edit or delete events on any other
          calendar.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">How data is used</h2>
        <p>
          Data is stored in the owner&apos;s private database and used only to
          run Runway&apos;s features. Nothing is sold, shared, or used for
          advertising.
        </p>
        <p>
          Google Calendar data is never sent to AI services. Assignment text
          the owner pastes in is sent to OpenAI to break it into steps.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Google API data</h2>
        <p>
          Runway&apos;s use and transfer of information received from Google
          APIs adheres to the{` `}
          <a
            className="underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Access and contact</h2>
        <p>
          Access can be revoked at any time at{` `}
          <a className="underline" href="https://myaccount.google.com/">
            myaccount.google.com
          </a>
          . Open Security, then Third-party connections.
        </p>
        <p>
          Contact is available through the project&apos;s{` `}
          <a
            className="underline"
            href="https://github.com/Muffi7869/runway"
          >
            GitHub repository
          </a>
          .
        </p>
      </section>

      <p>Last updated: October 6, 2026</p>

      <Link className="underline" href="/">
        Back to Runway
      </Link>
    </main>
  );
}
