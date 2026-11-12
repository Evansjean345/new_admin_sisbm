import { Suspense } from "react";

import { LoadingRows } from "@/components/query-state";

import { Roles } from "./_components/roles";

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <Roles />
    </Suspense>
  );
}
