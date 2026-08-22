import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "../styles.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "SIH Team Formation Portal | Sri Eshwar Innovation Studio",
  description:
    "Form your Smart India Hackathon team at Sri Eshwar. Create a team, invite classmates, accept invites — one verified team per student.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        <AuthProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster
            richColors
            position="top-right"
            closeButton
            toastOptions={{
              style: {
                borderRadius: "12px",
                padding: "12px 16px",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
