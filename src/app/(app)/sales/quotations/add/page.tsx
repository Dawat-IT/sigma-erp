import { redirect } from "next/navigation";

export default function AddQuotationPage() {
  redirect("/pos?mode=quotation");
}
