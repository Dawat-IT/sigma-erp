"use client";

import { ImportPage } from "@/components/ImportPage";

export default function ImportContactsPage() {
  return (
    <ImportPage
      type="customers"
      titleBn="যোগাযোগ ইমপোর্ট"
      titleEn="Import Contacts"
      sample={`name,mobile,email,contactPerson,location,city,address,group
Karim Electronics,01710000001,karim@example.com,Karim,Dhanmondi,Dhaka,House 12 Road 5,Corporate`}
    />
  );
}
