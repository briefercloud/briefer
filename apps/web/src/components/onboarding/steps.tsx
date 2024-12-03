import { Dialog } from '@headlessui/react'
import { DataSourceIcons } from '../DataSourceIcons'
import { useStringQuery } from '@/hooks/useQueryArgs'
import { useDataSources } from '@/hooks/useDatasources'
import { InlineWidget } from 'react-calendly'
import { useSession } from '@/hooks/useAuth'
import { useState } from 'react'

export const WelcomeStep = () => {
  return (
    <div className="flex flex-col gap-y-2">
      <Dialog.Title
        as="h2"
        className="text-lg font-semibold leading-6 text-gray-900"
      >
        Welcome to Briefer!
      </Dialog.Title>
      <Dialog.Description className="flex flex-col gap-y-2 text-sm text-gray-500">
        <p>
          Hey there! I&apos;m Lucas, founder of Briefer, and I&apos;m excited to
          have you on board.
        </p>
        <p>
          Here&apos;s a quick video to help you get started with Briefer.
          I&apos;d highly recommend watching it before you dive in.
        </p>

        <div
          className="mt-4"
          style={{
            position: 'relative',
            paddingBottom: '62.5%',
            height: 0,
          }}
        >
          <iframe
            src="https://www.loom.com/embed/b8387e51fab1463d85d7ca6efd78bbaa?sid=c058f20f-5487-48d3-a2c3-c3cf837ddc1c&hideEmbedTopBar=true&hide_share=true&hide_owner=true"
            frameBorder="0"
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          ></iframe>
        </div>
      </Dialog.Description>
    </div>
  )
}

export const DataSourceStep = () => {
  const workspaceId = useStringQuery('workspaceId') ?? ''
  const [isUsingCsv, setIsUsingCsv] = useState(false)

  const [{ datasources: dataSources }] = useDataSources(workspaceId)

  if (dataSources.size > 0) {
    return (
      <div className="flex flex-col gap-y-2">
        <Dialog.Title
          as="h2"
          className="text-lg font-semibold leading-6 text-gray-900"
        >
          Your data source is connected
        </Dialog.Title>
        <Dialog.Description className="flex flex-col gap-y-2 text-sm text-gray-500">
          <p>You&apos;ve connected a data source to Briefer. Great job!</p>
          <p>
            You will be able to query this data source using Briefer&apos;s
            query blocks.
          </p>

          <div
            className="mt-4"
            style={{
              position: 'relative',
              paddingBottom: '62.5%',
              height: 0,
            }}
          >
            <iframe
              src="https://www.loom.com/embed/c1c16fa926c546f3b9e416843f6d4e10?sid=2909a383-bb98-4e35-892e-2f0e01560ea8&hideEmbedTopBar=true&hide_share=true&hide_owner=true"
              frameBorder="0"
              allowFullScreen
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            ></iframe>
          </div>
        </Dialog.Description>
      </div>
    )
  }

  if (isUsingCsv) {
    return (
      <div className="flex flex-col gap-y-2">
        <Dialog.Title
          as="h2"
          className="text-lg font-semibold leading-6 text-gray-900"
        >
          Here is how to use CSV files
        </Dialog.Title>
        <Dialog.Description className="flex flex-col gap-y-2 text-sm text-gray-500">
          <p>
            You can upload files directly into your pages by using the file
            upload block.
          </p>
          <p>Here&apos;s a quick video on how to use files in your pages.</p>

          <div
            className="mt-4"
            style={{
              position: 'relative',
              paddingBottom: '62.5%',
              height: 0,
            }}
          >
            <iframe
              src="https://www.loom.com/embed/db98b8c3b43641478bf2a90816274bf7?sid=29188922-78b1-4d4a-b232-f5575edc19ed&hideEmbedTopBar=true&hide_share=true&hide_owner=true"
              frameBorder="0"
              allowFullScreen
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            ></iframe>
          </div>
        </Dialog.Description>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Dialog.Title
        as="h2"
        className="text-lg font-semibold leading-6 text-gray-900"
      >
        Let&apos;s connect to a data source
      </Dialog.Title>
      <Dialog.Description className="flex flex-col gap-y-2 text-sm text-gray-500">
        <p>
          Briefer works better when it&apos;s connected to your data sources.
        </p>
        <p>Which of these data sources would you like to connect first?</p>

        <div className="mt-4 flex items-center justify-center">
          <DataSourceIcons
            workspaceId={workspaceId}
            onCSV={() => setIsUsingCsv(true)}
          />
        </div>
      </Dialog.Description>
    </div>
  )
}

export const ActivateTrialStep = () => {
  const session = useSession({ redirectToLogin: true })
  const email = session.data?.email

  return (
    <div className="flex flex-col gap-y-2">
      <Dialog.Title
        as="h2"
        className="text-lg font-semibold leading-6 text-gray-900"
      >
        Now, let&apos;s get you some extra features
      </Dialog.Title>
      <Dialog.Description className="flex flex-col gap-y-2 text-sm text-gray-500">
        <p>
          Let&apos;s be honest, you&apos;re probably tired of these onboarding
          screens and just want to get to the good stuff, but hear me out.
        </p>
        <p>
          If you hop on a 15-minute call with me, I&apos;ll give you a free
          trial of our professional plan for 30 days.
        </p>
        <div className="mt-4 flex items-center justify-center">
          <InlineWidget
            url="https://calendly.com/lucasfcosta/briefer-intro-call?hide_event_type_details=1"
            styles={{ width: '100%', height: '500px' }}
            prefill={{ email }}
          />
        </div>
        <p>
          I&apos;m doing this is because I want to hear about your use cases and
          help you get the most out of Briefer.
        </p>
      </Dialog.Description>
    </div>
  )
}

export const JoinSlackStep = () => {
  return (
    <div className="flex flex-col gap-y-2">
      <Dialog.Title
        as="h2"
        className="text-lg font-semibold leading-6 text-gray-900"
      >
        Join Slack
      </Dialog.Title>
      <Dialog.Description className="flex flex-col gap-y-2 text-sm text-gray-500">
        <p>
          Briefer&apos;s Slack community is the perfect place to get help, share
          feedback, and connect with other people in the data community.
        </p>
        <p>
          If you hop in and say hi, I&apos;ll be there to welcome you
          personally, and you can ask me anything you want.
        </p>
        <div className="py-6 flex items-center justify-center">
          <a
            href="https://briefercommunity.slack.com/join/shared_invite/zt-2geo5vlh2-RxEOwCRrVEz6JDkrPHuf0g#/shared-invite/email"
            target="_blank"
            rel="noreferrer"
            className="bg-primary-200 text-gray-900 px-5 py-3 rounded-md text-md font-semibold shadow-sm flex gap-x-3 items-center"
          >
            <img src="/icons/slack.png" alt="Slack Logo" className="w-6 h-6" />
            Join Briefer&apos;s Slack Community
          </a>
        </div>
        <p>
          I&apos;m doing this is because I want to hear about your use cases and
          help you get the most out of Briefer.
        </p>
      </Dialog.Description>
    </div>
  )
}
