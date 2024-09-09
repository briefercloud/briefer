type Props = {
  title: string
  description: string
}

export default function ExplorerTitle(props: Props) {
  return (
    <div className="px-6 pt-6 pb-2">
      <h3 className="text-lg font-medium leading-6 text-gray-900">
        {props.title}
      </h3>
      <p className="text-gray-500 text-sm pt-1">{props.description}</p>
    </div>
  )
}
