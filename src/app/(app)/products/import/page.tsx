"use client";

import { ImportPage } from "@/components/ImportPage";

export default function ImportProductsPage() {
  return (
    <ImportPage
      type="products"
      titleBn="পণ্য ইমপোর্ট"
      titleEn="Import Products"
      sample={`name,sku,sellPrice,purchasePrice,brand
Door operator 2-speed,SIG-101,24800,18500,Fermator
VVVF drive 5.5 kW,SIG-105,36500,28500,Monarch`}
    />
  );
}
