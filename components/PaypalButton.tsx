import Script from 'next/script'

declare global {
  interface Window {
    paypal: any
  }
}

export default function PaypalButton() {
  return (
    <footer className="mt-12 py-8 bg-gray-50 border-t border-gray-100">
      <div className="max-w-screen-sm mx-auto px-4 text-center">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Buy me a Coffee?</h3>
        <p className="text-xs text-gray-500 mb-6">
          If you found this tool helpful, consider supporting its development.
        </p>
        
        <div className="flex justify-center">
          <div className="w-full max-w-xs min-h-[50px] relative z-10">
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
    </footer>
  )
}
