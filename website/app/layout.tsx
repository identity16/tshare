import type { Metadata } from 'next';
export const metadata: Metadata = {
  title:'tshare — agent reports your team can build on',
  description:'A shared home for agent-generated reports. Team workspace in development; managed Cloud on the waitlist. Try the self-hosted CLI today.',
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
