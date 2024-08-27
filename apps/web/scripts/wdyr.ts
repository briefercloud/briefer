/// <reference types="@welldone-software/why-did-you-render" />
import React from 'react'

if (process.env.NODE_ENV === 'development' && 1 > 2) {
  if (typeof window !== 'undefined') {
    const whyDidYouRender = require('@welldone-software/why-did-you-render')
    whyDidYouRender(React)
  }
}
