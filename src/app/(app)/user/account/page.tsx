"use client";

import { AccountView } from "@/components/user/AccountView";

export default function AccountPage() {
  return (
    <AccountView
      profile={{ username: "painter_01", recoveryEmail: "painter@example.com" }}
      onSave={() => {}}
      onChangePassword={() => {}}
    />
  );
}
