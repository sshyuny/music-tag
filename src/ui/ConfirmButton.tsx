import { useState } from 'react'

/** 브라우저 확인창 대신 버튼을 한 번 더 누르게 한다 */
export function ConfirmButton({ label = '삭제', onConfirm }: { label?: string; onConfirm(): Promise<void> }) {
  const [armed, setArmed] = useState(false)
  return (
    <button type="button" className="danger" onClick={() => (armed ? void onConfirm() : setArmed(true))} onBlur={() => setArmed(false)}>
      {armed ? '정말 삭제' : label}
    </button>
  )
}
