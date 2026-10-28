import { redirect } from "next/navigation";

export default function NewWorkOrderRedirect() {
  redirect("/services/new");
}
