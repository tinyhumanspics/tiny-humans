import "server-only";
import { graphFetch } from "./graph";
import { microsoftConfig } from "./config";

export interface OutgoingEmail {
  to: { address: string; name?: string };
  subject: string;
  html: string;
}

/** Sends from the Tiny Humans mailbox (replies go back to it) and keeps a copy in Sent Items. */
export async function sendMail(email: OutgoingEmail): Promise<void> {
  const { mailbox } = microsoftConfig();
  await graphFetch(`/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: "POST",
    scope: "graph.mail",
    body: JSON.stringify({
      message: {
        subject: email.subject,
        body: { contentType: "HTML", content: email.html },
        toRecipients: [{ emailAddress: { address: email.to.address, name: email.to.name } }],
        replyTo: [{ emailAddress: { address: mailbox, name: "Tiny Humans" } }],
      },
      saveToSentItems: true,
    }),
  });
}
