import Link from "next/link";

import { PublicDocumentShell } from "@/components/public-document-shell";

export default function PrivatePage() {
  return (
    <PublicDocumentShell>
      <h1>This is a private app</h1>
      <p>Runway is available only to its owner.</p>
      <Link href="/">Back to Runway</Link>
    </PublicDocumentShell>
  );
}
