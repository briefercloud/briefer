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
