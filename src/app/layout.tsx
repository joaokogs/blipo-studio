import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blipo Studio",
  description:
    "Plataforma local-first para gerenciar agentes, subagentes e skills a partir de arquivos fonte.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
