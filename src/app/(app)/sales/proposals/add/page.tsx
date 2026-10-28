import { redirect } from "next/navigation";

export default function AddProposalPage() {
  redirect("/pos?mode=proposal");
}
