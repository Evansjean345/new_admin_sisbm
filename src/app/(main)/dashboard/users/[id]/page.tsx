import { Suspense } from "react";

import { LoadingRows } from "@/components/query-state";

import { UserDetailView } from "./_components/user-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <UserDetailView id={id} />
    </Suspense>
  );
}
