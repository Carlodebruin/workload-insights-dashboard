import "./globals.css";
import ClientProviders from "../components/ClientProviders";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workload Insights Dashboard",
  description: "A central reporting dashboard for school staff.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-geosearch@4.0.0/dist/geosearch.css" />
      </head>
      <body className="bg-background text-foreground transition-colors duration-300">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
