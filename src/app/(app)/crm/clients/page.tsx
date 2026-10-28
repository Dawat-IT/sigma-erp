import { redirect } from "next/navigation";

export default function CrmClientsRedirect() {
  redirect("/contacts/customers?stage=amc");
}
