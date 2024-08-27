import RotateLoader from 'react-spinners/RotateLoader'
import { CSSProperties } from 'react'

const override: CSSProperties = {
  display: 'block',
  margin: '0 auto',
}

type LargeSpinnerProps = {
  color?: string
}

function LargeSpinner({ color }: LargeSpinnerProps) {
  return (
    <RotateLoader
      color={
        color ? color : '#e4eed9' // primary-300
      }
      loading
      cssOverride={override}
      size={20}
    />
  )
}

export default LargeSpinner
