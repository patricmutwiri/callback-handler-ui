import Link from 'next/link'

export default function PaypalButton() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white/90 py-5">
      <div className="mx-auto max-w-md px-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-amber-50 px-4 py-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">Support Callback Handler</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                If this endpoint saved you time, you can chip in for the project from our hosted support page.
              </p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900">
              #Ubuntu
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Hosted PayPal checkout</p>
              <p className="mt-1 text-xs text-slate-500">Open the dedicated support page and continue from there.</p>
            </div>
            <Link
              href="/support"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
            >
              Support Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
