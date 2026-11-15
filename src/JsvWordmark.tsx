export function JsvMark() {
  return <svg className="jsv-mark" viewBox="0 0 44 44" aria-hidden="true"><path d="M5 7h13v13H5zM26 7h13v13H26zM5 28h13v9H5z" /><path d="M26 28h13v9H26z" className="jsv-mark-signal" /><path d="M18 13h8M12 20v8M32 20v8" className="jsv-mark-route" /></svg>
}

export default function JsvWordmark() {
  return <a className="jsv-wordmark" href="/" aria-label="JSV Market home"><JsvMark /><span>JSV Market</span></a>
}
