const fs = require("fs")

const filePath = "src\\renderer\\src\\stores\\campeonato.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

function applyAnchor(label, anchor, replacement) {
  const count = content.split(anchor).length - 1
  console.log(label + ": encontrada " + count + "x")
  if (count !== 1) {
    console.error("Abortado: " + label + " nao encontrada exatamente 1x.")
    process.exit(1)
  }
  content = content.replace(anchor, replacement)
}

applyAnchor(
  "ancora N1",
  `import { getSocket } from '../services/socket'`,
  `import { getSocket, onSocketRecreated, type Socket } from '../services/socket'

let syncedSocket: Socket | null = null
let subscribedToSyncSocketChanges = false`
)

applyAnchor(
  "ancora N2",
  `    listenToServer() {
      getSocket().on('state:sync', (incoming: LiveState) => {
        this.\$patch((state) => {
          Object.assign(state, incoming)
          if (incoming.presentationFlow) {
            state.presentationFlow = { ...incoming.presentationFlow }
          }
        })
      })
    },`,
  `    attachSyncListener() {
      const socket = getSocket()
      if (syncedSocket === socket) return
      syncedSocket = socket
      socket.on('state:sync', (incoming: LiveState) => {
        this.\$patch((state) => {
          Object.assign(state, incoming)
          if (incoming.presentationFlow) {
            state.presentationFlow = { ...incoming.presentationFlow }
          }
        })
      })
    },
    listenToServer() {
      this.attachSyncListener()
      if (!subscribedToSyncSocketChanges) {
        subscribedToSyncSocketChanges = true
        onSocketRecreated(() => {
          this.attachSyncListener()
        })
      }
    },`
)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: campeonato.ts atualizado.")
