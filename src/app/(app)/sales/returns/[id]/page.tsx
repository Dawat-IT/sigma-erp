"use client";

import { use } from "react";
import { SellReturnForm } from "../SellReturnForm";

export default function SellReturnEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SellReturnForm editId={id} />;
}
