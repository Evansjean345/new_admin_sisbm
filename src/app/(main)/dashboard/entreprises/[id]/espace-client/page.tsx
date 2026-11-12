 import { Suspense } from "react";

import { LoadingRows } from "@/components/query-state";

import { ClientWorkspace } from "./_components/client-workspace";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingRows rows={8} />}>
      <ClientWorkspace organizationId={id} />
    </Suspense>
  );
}
