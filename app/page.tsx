import dynamic from "next/dynamic"
import { Suspense } from "react"

const DynamicHome = dynamic(() => import("./components/Home"), {
  loading: () => <p>Loading...</p>,
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DynamicHome />
    </Suspense>
  )
}

