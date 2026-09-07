import React from "react";
import { Link } from "react-router-dom";
import "../css/SiteFooter.css";

export function TermsPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" to="/">
        ← Back to app
      </Link>
      <h1>Terms of Use</h1>
      <p>
        ColeG Poker is a hand-history study tool provided as-is for personal
        learning and analysis. By using the site you agree not to misuse uploaded
        hand histories or attempt to disrupt the service.
      </p>
      <p>
        Poker is a game of skill and chance. This tool does not guarantee
        results, and you are responsible for complying with the rules of any
        poker site whose hand histories you import.
      </p>
      <p>These terms may be updated as the product evolves.</p>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" to="/">
        ← Back to app
      </Link>
      <h1>Privacy</h1>
      <p>
        Hand histories and tags you add in ColeG Poker are processed in your
        browser. Tags are stored locally on your device (localStorage) and are
        not uploaded to a ColeG Poker server by this version of the app.
      </p>
      <p>
        If you contact us by email, we will use your address only to respond to
        that message.
      </p>
      <p>
        Hosting may involve standard web logs from GitHub Pages or similar
        providers (e.g. IP and user-agent). We do not sell personal data.
      </p>
    </main>
  );
}

export function ContactPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" to="/">
        ← Back to app
      </Link>
      <h1>Contact</h1>
      <p>
        Questions or feedback about ColeG Poker? Reach out at{" "}
        <a href="mailto:ollesl2002@gmail.com">ollesl2002@gmail.com</a>.
      </p>
    </main>
  );
}
