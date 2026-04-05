import Script from 'next/script'

declare global {
  interface Window {
    paypal: any
  }
}

export default function PaypalButton() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white/90 py-5">
      <div className="mx-auto max-w-md px-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-amber-50 px-4 py-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">Support Callback Handler</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                If this endpoint saved you time, you can chip in for the project.
              </p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900">
              #Ubuntu
            </span>
          </div>

          <div className="flex justify-center">
            <div className="relative z-10 min-h-[44px] w-full max-w-[270px]">
            <div id="paypal-container-G54BFVLVSBVKS"></div>
            <Script
              src="https://www.paypal.com/sdk/js?client-id=BAA7SXiQaL-A_jp8ePUhCXzT7knA0nUA_tjULut3dWzqiKog27dgaIrk-qW-x3IVPUl2zrJ5rnOxHblPiA&components=hosted-buttons&disable-funding=venmo&currency=USD"
              onLoad={() => {
                if (window.paypal) {
                  window.paypal.HostedButtons({
                    hostedButtonId: "G54BFVLVSBVKS",
                  }).render("#paypal-container-G54BFVLVSBVKS")
                }
              }}
            />
          </div>
        </div>
        </div>
      </div>
    </footer>
  )
}
