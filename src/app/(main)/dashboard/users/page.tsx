import { Suspense } from "react";

import { LoadingRows } from "@/components/query-state";

import { Users } from "./_components/users";

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <Users />
    </Suspense>
  );
}
