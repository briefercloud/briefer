import {
  ChangeEventHandler,
  FormEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import { useLogin, useSession } from '@/hooks/useAuth'
import Link from 'next/link'
import Spin from '@/components/Spin'
import Cookies from 'js-cookie'
import useProperties from '@/hooks/useProperties'

export default function SignIn() {
  const properties = useProperties()
  const router = useRouter()
  const session = useSession()
  const tokenExists = Cookies.get('sessionExpiry')

  useEffect(() => {
    if (session.data && tokenExists) {
      router.replace('/')
    }
  }, [session])

  const [email, setEmail] = useState('')
  const onChangeEmail: ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      setEmail(e.target.value)
    },
    [setEmail]
  )

  const [password, setPassword] = useState('')
  const onChangePassword: ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      setPassword(e.target.value)
    },
    [setPassword]
  )

  const [auth, { loginWithEmail, loginWithPassword }] = useLogin()
  const onPasswordAuth: FormEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault()

      loginWithPassword(email, password)
    },
    [email, password, loginWithEmail]
  )

  useEffect(() => {
    if (properties.data?.needsSetup) {
      router.replace('/setup')
    }
  }, [properties, router])

  useEffect(() => {
    if (auth.data?.loginLink) {
      router.push(auth.data.loginLink)
    }
  }, [auth.data, router])

  if (!properties.data) {
    if (properties.isLoading) {
      return null
    }

    return <h4>Something went wrong. Please try again or contact support.</h4>
  }

  return (
    <div className="relative h-full w-100vw overflow-hidden">
      <img
        className="absolute t-0 l-0 opacity-10"
        src="/images/zebra-pattern.svg"
        alt="background pattern"
      />
      <div className="relative font-syne h-full flex bg-ceramic-100/90 items-center justify-center sm:justify-around">
        <div className="">
          <h1 className="font-trap tracking-tight font-bold text-7xl lg:text-[96px] text-hunter-950 leading-[6rem]">
            briefer
          </h1>
          <p className="pl-1 text-lg lg:text-2xl text-hunter-900">
            The collaborative data platform.
          </p>
        </div>

        {/*
         * This padding must match the sum of the paddings of the messages at
         * the bottom of the box so that the box is centered with the logo on
         * the left.
         */}
        <div className="pt-12">
          <div className={clsx(auth.error ? 'visible' : 'hidden', 'py-8')}>
            <div className="sm:w-[380px] lg:w-[480px] py-4 bg-ceramic-50 shadow rounded-sm border border-red-300">
              <div className="text-center text-md text-red-700">
                {auth.error === 'unexpected' &&
                  'Something went wrong. Please contact support.'}
                {auth.error === 'invalid-creds' &&
                  'Invalid credentials. Please try again.'}
              </div>
            </div>
          </div>

          <div
            className={clsx(
              'sm:w-[380px] lg:w-[480px] bg-ceramic-50 shadow rounded-lg p-12 flex flex-col',
              'gap-y-6'
            )}
          >
            <h2 className="text-4xl tracking-tight font-bold text-hunter-900">
              Sign in
            </h2>

            <form onSubmit={onPasswordAuth}>
              <div>
                <div className="pb-4">
                  <label
                    htmlFor="email"
                    className="block text-sm leading-6 text-gray-500 pb-2"
                  >
                    Email address
                  </label>
                  <div>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      disabled={auth.data !== undefined || auth.loading}
                      required
                      value={email}
                      onChange={onChangeEmail}
                      className="block w-full rounded-md border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 text-sm leading-6 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pb-4">
                  <label
                    htmlFor="email"
                    className="block text-sm leading-6 text-gray-500 pb-2"
                  >
                    Password
                  </label>
                  <div>
                    <input
                      name="password"
                      type="password"
                      autoComplete="password"
                      disabled={auth.data !== undefined || auth.loading}
                      required
                      value={password}
                      onChange={onChangePassword}
                      className="block w-full rounded-md border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 text-sm leading-6 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className={clsx('pt-3')}>
                  <button
                    type="submit"
                    disabled={auth.data !== undefined || auth.loading}
                    className={clsx(
                      'bg-primary-200 disabled:bg-gray-200 disabled:hover:cursor-not-allowed flex justify-center items-center rounded-sm shadow-sm px-6 py-3 font-medium w-full text-sm hover:bg-primary-300 rounded-sm'
                    )}
                  >
                    <span>Continue</span>
                    {auth.loading && <Spin wrapperClassName="pl-2" />}
                  </button>
                </div>
              </div>
            </form>
          </div>
          <div className="pt-8 text-center text-slate-500">
            <p className="text-xs text-slate-500">
              By logging in, you agree to our{' '}
              <Link
                href="https://briefer.cloud/terms-and-conditions"
                target="_blank"
                className="underline hover:text-gray-900"
              >
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link
                href="https://briefer.cloud/privacy"
                target="_blank"
                className="underline hover:text-gray-900"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
