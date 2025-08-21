import "./globals.css";
import ClientProviders from "../components/ClientProviders";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workload Insights Dashboard",
  description: "A central reporting dashboard for school staff to manage activities, incidents, and maintenance requests.",
  keywords: ["school management", "incident reporting", "maintenance tracking", "staff dashboard"],
  authors: [{ name: "Workload Insights Team" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" }
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ],
  },
  openGraph: {
    title: "Workload Insights Dashboard",
    description: "Streamline school operations with intelligent activity and incident management",
    type: "website",
    locale: "en_US",
  },
  robots: {
    index: false, // Private school dashboard
    follow: false,
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* External CSS dependencies for map functionality */}
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-geosearch@4.0.0/dist/geosearch.css" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="" />
        
        {/* Security headers via meta tags */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="Permissions-Policy" content="geolocation=(), microphone=(), camera=()" />
      </head>
      <body className="bg-background text-foreground transition-colors duration-300 antialiased">
        {/* Client-side providers wrapper handles all React context and state */}
        <ClientProviders>
          {children}
        </ClientProviders>
        
        {/* Service worker registration for offline functionality (future enhancement) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Register service worker for offline functionality (future)
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SW registered: ', registration);
                  }).catch(function(registrationError) {
                    console.log('SW registration failed: ', registrationError);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}