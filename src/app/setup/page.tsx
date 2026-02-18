import { redirect } from 'next/navigation'
import { getUserEstablishments } from '@/lib/establishment/context'
import { SetupForm } from '@/components/establishment/setup-form'

export default async function SetupPage() {
  const { establishments } = await getUserEstablishments()

  if (establishments.length > 0) {
    redirect('/dashboard')
  }

  return <SetupForm />
}
