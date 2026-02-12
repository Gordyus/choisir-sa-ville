import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
    title: "Choisir sa ville | Exploration cartographique",
    description:
        "Application Next.js pour explorer les territoires français, préparer les requêtes carte et afficher les futures analyses.",
    metadataBase: new URL("https://choisir-sa-ville.local")
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
    return (
        <html lang="fr" className="h-full">
            <body className={`${spaceGrotesk.className} h-full bg-transparent text-slate-900`}>
                <div className="flex h-dvh flex-col overflow-hidden bg-transparent">
                    <Header />
                    <main className="flex min-h-0 w-full flex-1 flex-col bg-transparent">
                        <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
                    </main>
                    <Footer />
                </div>
            </body>
        </html>
    );
}
