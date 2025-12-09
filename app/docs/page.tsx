import type { Metadata } from "next"
import DocsClient from "./DocsClient"

export const metadata: Metadata = {
  title: "EMS Documentation",
  description: "Comprehensive project reference for the Employee Management System",
  keywords: ["EMS", "Employee", "Attendance", "Leave", "Supabase", "Next.js", "Documentation", "Guide"],
  openGraph: {
    title: "EMS Documentation",
    description: "Comprehensive project reference for the Employee Management System",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EMS Documentation",
    description: "Comprehensive project reference for the Employee Management System",
  },
}

export default function DocsPage() {
  return <DocsClient />
}

