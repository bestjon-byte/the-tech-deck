import { createClient, LiveList, LiveObject } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'

const client = createClient({
  publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY,
  // Send moves after 16ms instead of the default 100ms — the fastest Liveblocks
  // allows. Every move reaches the other phones up to ~0.08s sooner.
  throttle: 16,
})

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
  useSelf,
  useUpdateMyPresence,
  useStatus,
  useSyncStatus,
} = createRoomContext(client)

export { LiveList, LiveObject }
