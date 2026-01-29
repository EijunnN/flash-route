"use client";

import { ProtectedPage } from "@/components/auth/protected-page";
import { OrdersProvider, OrdersListView } from "@/components/orders";

export default function OrdersPage() {
  return (
    <ProtectedPage requiredPermission="orders:VIEW">
      <OrdersProvider>
        <OrdersListView />
      </OrdersProvider>
    </ProtectedPage>
  );
}
