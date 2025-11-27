import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3AuthProvider } from "@/lib/web3auth/provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "SESAP - Smart Social Agreement Protocol",
    description: "Create and manage smart social agreements",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Web3AuthProvider>
                    {children}
                    <Toaster />
                </Web3AuthProvider>
            </body>
        </html>
    );
}
