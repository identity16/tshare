import type { Metadata } from 'next';
export const metadata: Metadata = {
  title:'tshare — your work, within reach',
  description:'Share artifacts across your own devices with Tailscale. Join the waitlist for managed sharing with other people.',
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
