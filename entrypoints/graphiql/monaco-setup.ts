const workerBase = new URL('workers/', document.baseURI).href

window.MonacoEnvironment = {
  getWorkerUrl(_workerId: string, label: string): string {
    if (label === 'graphql') return `${workerBase}graphql.worker.js`
    if (label === 'json') return `${workerBase}json.worker.js`
    return `${workerBase}editor.worker.js`
  },
}
