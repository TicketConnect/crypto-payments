import type { SignedAuth, Session, SessionStatus } from './types'

type RegisterRequest = {
  burner_address: string
  eip7702_auth: SignedAuth
  destination_address: string
  destination_chain: number
}

type RegisterResponse = {
  id: string
  expires_at: number
  status: string
}

export async function registerSession(
  apiUrl: string,
  burnerAddress: string,
  signedAuth: SignedAuth,
  destinationAddress: string,
  destinationChainId: number,
): Promise<Session> {
  const body: RegisterRequest = {
    burner_address: burnerAddress,
    eip7702_auth: signedAuth,
    destination_address: destinationAddress,
    destination_chain: destinationChainId,
  }

  const res = await fetch(`${apiUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Registration failed: ${text}`)
  }

  const data: RegisterResponse = await res.json()

  return {
    id: data.id,
    expiresAt: data.expires_at,
    status: data.status as SessionStatus,
  }
}

export function connectSSE(
  apiUrl: string,
  sessionId: string,
  onStatus: (status: SessionStatus) => void,
  onError: () => void,
): EventSource {
  const es = new EventSource(`${apiUrl}/sessions/${sessionId}/events`)

  es.addEventListener('status', (event) => {
    try {
      const data = JSON.parse(event.data)
      onStatus(data.status as SessionStatus)
    } catch {
      // ignore parse errors
    }
  })

  es.onerror = () => {
    es.close()
    onError()
  }

  return es
}
