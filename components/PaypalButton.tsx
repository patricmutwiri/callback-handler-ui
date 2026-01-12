import Script from 'next/script'

declare global {
  interface Window {
    paypal: any
  }
}

export default function PaypalButton() {
  return (
    <div className='flex justify-center py-6'>
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
  )
}
