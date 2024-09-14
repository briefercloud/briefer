export function readFile(
  file: File,
  encoding: BufferEncoding = 'utf8'
): Promise<string> {
  const fileReader = new FileReader()
  fileReader.readAsArrayBuffer(file)

  return new Promise((resolve) => {
    fileReader.onload = (e) => {
      if (!e.target?.result) {
        return
      }

      if (typeof e.target.result === 'string') {
        return resolve(e.target.result)
      }

      resolve(Buffer.from(e.target.result).toString(encoding))
    }
  })
}

export function downloadFile(url: string, name: string) {
  const downloadLink = document.createElement('a')

  // some browsers don't support the a[download] solution
  if (typeof downloadLink.download === 'undefined') {
    // 'window.location.href = downloadLink' no long works due to some Chrome policies update
    return
  }

  downloadLink.download = name
  downloadLink.href = url

  document.body.appendChild(downloadLink)
  downloadLink.click()
  document.body.removeChild(downloadLink)
}
