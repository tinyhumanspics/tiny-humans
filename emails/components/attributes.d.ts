import "react";

/** Legacy HTML attributes that email clients (Outlook) still rely on. React renders them as-is. */
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match React's own declaration to merge with it
  interface HTMLAttributes<T> {
    bgcolor?: string | undefined;
  }
}
