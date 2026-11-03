import type { Metadata } from 'next';
export const metadata: Metadata = {
  title:'tshare — a shared home for agent reports',
  description:'A shared home for agent-generated reports. Team workspace in development; managed Cloud on the waitlist. Try the self-hosted CLI today.',
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
