export async function compress(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const stream = new Blob([encoder.encode(text)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.length
  }

  const compressed = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    compressed.set(chunk, offset)
    offset += chunk.length
  }

  let binary = ''
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i])
  }

  return btoa(binary)
}

export async function decompress(base64: string): Promise<string> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let result = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }

  result += decoder.decode()

  return result
}
